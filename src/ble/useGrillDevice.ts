import { useState, useRef, useCallback } from 'react'
import { SERVICE_UUID, NOTIFY_CHAR_UUID, WRITE_CHAR_UUID } from './constants'
import {
  buildSecurityKey,
  buildRequestToken,
  buildVerifyToken,
  buildClockSync,
  buildPollStatus,
  buildSetCookingSettings,
  decodeDeviceState,
  decodeTokenReply,
  decodeStatusPacket,
} from './packets'
import type { StatusPacket } from './packets'
import { saveToken, loadToken } from '../storage/tokenStore'
import type { TempUnit } from '../types'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface GrillDevice {
  status: ConnectionStatus
  probe1: StatusPacket | null
  probe2: StatusPacket | null
  connect: () => Promise<void>
  disconnect: () => void
  setTarget: (
    probeId: 0 | 1,
    targetTempC: number,
    unit: TempUnit,
    food?: number,
    doneness?: number,
  ) => Promise<void>
  error: string | null
}

export function useGrillDevice(preferredUnit: TempUnit = 'C'): GrillDevice {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [probe1, setProbe1] = useState<StatusPacket | null>(null)
  const [probe2, setProbe2] = useState<StatusPacket | null>(null)
  const [error, setError] = useState<string | null>(null)

  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const nonceRef = useRef<number>(0)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deviceRef = useRef<BluetoothDevice | null>(null)

  const write = useCallback(async (bytes: Uint8Array) => {
    if (!writeCharRef.current) throw new Error('Not connected')
    await writeCharRef.current.writeValueWithResponse(bytes as Uint8Array<ArrayBuffer>)
  }, [])

  const waitForNotification = useCallback(
    (
      char: BluetoothRemoteGATTCharacteristic,
      header: number,
      timeoutMs = 5000,
    ): Promise<DataView> => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          char.removeEventListener('characteristicvaluechanged', handler as EventListener)
          reject(new Error(`Timeout waiting for 0x${header.toString(16).toUpperCase()}`))
        }, timeoutMs)
        function handler(e: Event) {
          const val = (e.target as BluetoothRemoteGATTCharacteristic).value!
          if (val.getUint8(0) === header) {
            clearTimeout(timer)
            char.removeEventListener('characteristicvaluechanged', handler as EventListener)
            resolve(val)
          }
        }
        char.addEventListener('characteristicvaluechanged', handler as EventListener)
      })
    },
    [],
  )

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'GS_' }],
        optionalServices: [SERVICE_UUID],
      })
      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
        setStatus('disconnected')
        setProbe1(null)
        setProbe2(null)
      })

      // Retry GATT connect up to 5 times — Windows sometimes needs a moment to release
      // a prior bonded state, and the device needs ~1s after any previous connection
      let server: BluetoothRemoteGATTServer | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          server = await device.gatt!.connect()
          // Give Windows BLE stack a moment to settle before accessing services
          await new Promise((r) => setTimeout(r, 500))
          if (!server.connected) throw new Error('Disconnected after connect')
          break
        } catch (e) {
          if (attempt === 4) throw e
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
      if (!server!.connected) throw new Error('Device disconnected before service discovery')
      const service = await server!.getPrimaryService(SERVICE_UUID)
      const notifyChar = await service.getCharacteristic(NOTIFY_CHAR_UUID)
      const writeChar = await service.getCharacteristic(WRITE_CHAR_UUID)
      writeCharRef.current = writeChar

      await notifyChar.startNotifications()

      // Step 1: security key → device state
      const p1 = waitForNotification(notifyChar, 0x80)
      await write(buildSecurityKey())
      const stateData = await p1
      const stateInfo = decodeDeviceState(stateData)
      if (!stateInfo) throw new Error('Bad device state reply')

      const { state, nonce } = stateInfo
      nonceRef.current = nonce
      const mac = device.id

      let token = loadToken(mac)

      if (state !== 0 || !token) {
        // Step 2: request new token
        const p2 = waitForNotification(notifyChar, 0x81)
        await write(buildRequestToken(nonce))
        const tokenData = await p2
        const tokenInfo = decodeTokenReply(tokenData)
        if (!tokenInfo) throw new Error('Bad token reply')
        token = tokenInfo.token
        saveToken(mac, token)
      }

      // Step 3: verify token
      const p3 = waitForNotification(notifyChar, 0x8c)
      await write(buildVerifyToken(token, nonce))
      await p3

      // Step 4: clock sync
      const p4 = waitForNotification(notifyChar, 0x8a)
      await write(buildClockSync(nonce))
      await p4

      // Step 5: push unit preference to device so probe display and readings use the right unit
      await write(buildSetCookingSettings(nonce, 0, 75, preferredUnit))
      await new Promise((r) => setTimeout(r, 200))
      await write(buildSetCookingSettings(nonce, 1, 75, preferredUnit))

      // Live temperature notifications
      notifyChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const val = (e.target as BluetoothRemoteGATTCharacteristic).value!
        const header = val.getUint8(0)
        if (header !== 0x84) {
          console.debug(
            `[BLE] rx 0x${header.toString(16).padStart(2, '0')}`,
            Array.from(new Uint8Array(val.buffer)).map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
          )
          return
        }
        const decoded = decodeStatusPacket(val)
        const probeId = (val.getUint8(3) >> 4) & 0x0f
        if (probeId === 0) setProbe1(decoded)
        else setProbe2(decoded)
      })

      setStatus('connected')

      // Poll both probes every 2 seconds
      pollIntervalRef.current = setInterval(async () => {
        try {
          await write(buildPollStatus(0, nonceRef.current))
          await new Promise((r) => setTimeout(r, 300))
          await write(buildPollStatus(1, nonceRef.current))
        } catch {
          /* disconnected */
        }
      }, 2000)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [write, waitForNotification, preferredUnit])

  const disconnect = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    deviceRef.current?.gatt?.disconnect()
  }, [])

  const setTarget = useCallback(
    async (probeId: 0 | 1, targetTempC: number, unit: TempUnit, food = 0, doneness = 0) => {
      console.debug(`[BLE] setTarget probe${probeId} → ${targetTempC}°${unit} food=${food} doneness=${doneness}`)
      await write(
        buildSetCookingSettings(nonceRef.current, probeId, targetTempC, unit, food, doneness),
      )
    },
    [write],
  )

  return { status, probe1, probe2, connect, disconnect, setTarget, error }
}
