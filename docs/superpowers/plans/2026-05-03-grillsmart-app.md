# GrillSmart App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Web Bluetooth PWA that connects to the Claes Ohlson 44-1794 / A550 BLE thermometer, displays live dual-probe temperatures, and alerts when the target is reached.

**Architecture:** Single-page React app running in Chrome on Windows. Web Bluetooth API handles BLE directly — no backend, no WSL gap. All state lives in React hooks; localStorage persists the device token and cook history.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Web Bluetooth API, localStorage, Recharts (graphs)

---

## File Map

```
grill-smart/
  index.html
  vite.config.ts
  tsconfig.json
  package.json
  src/
    main.tsx                    entry point
    App.tsx                     root component, layout
    types.ts                    shared TS interfaces
    presets.ts                  meat/doneness target temps
    ble/
      constants.ts              UUIDs, packet headers
      packets.ts                packet builders + decoders
      handshake.ts              5-step auth sequence (async generator)
      useGrillDevice.ts         React hook — connect, poll, state
    hooks/
      useEta.ts                 Newton's law ETA computation
    storage/
      tokenStore.ts             save/load 6-byte token keyed by MAC
      sessionStore.ts           cook session history in localStorage
    components/
      ConnectButton.tsx         scan + connect UI
      ProbeDisplay.tsx          big temp number for one probe
      PresetPicker.tsx          meat type + doneness selector
      EtaDisplay.tsx            time-remaining countdown
      TempAlert.tsx             modal/sound alert on target reached
      TempGraph.tsx             Recharts line graph, both probes
    styles/
      app.css                   dark theme, CSS variables
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/app.css`

- [ ] **Step 1: Scaffold Vite project**

```bash
cd /home/ola/git/grill-smart
npm create vite@latest . -- --template react-ts --yes 2>/dev/null || \
  (npm create vite@latest app-tmp -- --template react-ts && \
   cp -r app-tmp/src app-tmp/index.html app-tmp/vite.config.ts app-tmp/tsconfig*.json app-tmp/package.json . && \
   rm -rf app-tmp)
npm install
npm install recharts
npm install -D @types/web-bluetooth
```

- [ ] **Step 2: Configure Vite for WSL access**

Replace `vite.config.ts` content:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
```

- [ ] **Step 3: Replace src/App.tsx with placeholder**

```tsx
export default function App() {
  return <div className="app"><h1>GrillSmart</h1></div>
}
```

- [ ] **Step 4: Replace src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```

- [ ] **Step 5: Create src/styles/app.css**

```css
:root {
  --bg: #1a1a1a;
  --surface: #2a2a2a;
  --border: #3a3a3a;
  --accent: #ff6b35;
  --text: #f0f0f0;
  --muted: #888;
  --green: #4caf50;
  --red: #f44336;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; }
.app { max-width: 480px; margin: 0 auto; padding: 1rem; min-height: 100dvh; display: flex; flex-direction: column; gap: 1rem; }
```

- [ ] **Step 6: Start dev server and verify it loads**

```bash
cd /home/ola/git/grill-smart
WSL_IP=$(ip route show | grep -oP '(?<=src )\S+' | tail -1)
echo "Open in Windows Chrome: http://$WSL_IP:5173"
npm run dev -- --host 0.0.0.0 &
sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```
Expected: `200`

- [ ] **Step 7: Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold Vite React TS project"
```

---

## Task 2: Types, Constants, Presets

**Files:**
- Create: `src/types.ts`, `src/ble/constants.ts`, `src/presets.ts`

- [ ] **Step 1: Create src/types.ts**

```ts
export interface ProbeReading {
  probeId: 0 | 1
  tempC: number
  batteryPct: number
  timestamp: number   // Date.now()
}

export interface CookSession {
  id: string
  startedAt: number
  meatLabel: string
  targetTempC: number
  readings: ProbeReading[]
  endedAt?: number
  peakTempC?: number
}

export interface MeatPreset {
  meat: string
  label: string
  targetTempC: number
}

export type TempUnit = 'C' | 'F'

export interface DeviceState {
  status: 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error'
  mac?: string
  deviceNonce?: number
  token?: Uint8Array
  errorMessage?: string
}
```

- [ ] **Step 2: Create src/ble/constants.ts**

```ts
export const SERVICE_UUID       = '00006301-0000-0041-4c50-574953450000'
export const NOTIFY_CHAR_UUID   = '00006302-0000-0041-4c50-574953450000'
export const WRITE_CHAR_UUID    = '00006303-0000-0041-4c50-574953450000'
export const CCCD_UUID          = '00002902-0000-1000-8000-00805f9b34fb'

export const HDR_SECURITY_KEY   = 0xA0
export const HDR_REQ_TOKEN      = 0xA1
export const HDR_REQ_SETTINGS   = 0xA2
export const HDR_POLL_STATUS    = 0xA4
export const HDR_SET_SETTINGS   = 0xA6
export const HDR_CLOCK_SYNC     = 0xAA
export const HDR_VERIFY_TOKEN   = 0xAC

export const HDR_DEVICE_STATE   = 0x80
export const HDR_TOKEN_REPLY    = 0x81
export const HDR_SETTINGS_REPLY = 0x82
export const HDR_STATUS_REPLY   = 0x84
export const HDR_CLOCK_ACK      = 0x8A
export const HDR_TOKEN_VERIFY_ACK = 0x8C
export const HDR_ERROR          = 0xFF
```

- [ ] **Step 3: Create src/presets.ts**

```ts
import type { MeatPreset } from './types'

export const PRESETS: MeatPreset[] = [
  { meat: 'Beef',    label: 'Rare',        targetTempC: 52 },
  { meat: 'Beef',    label: 'Medium-rare', targetTempC: 57 },
  { meat: 'Beef',    label: 'Medium',      targetTempC: 63 },
  { meat: 'Beef',    label: 'Medium-well', targetTempC: 68 },
  { meat: 'Beef',    label: 'Well-done',   targetTempC: 74 },
  { meat: 'Pork',    label: 'Medium',      targetTempC: 63 },
  { meat: 'Pork',    label: 'Well-done',   targetTempC: 71 },
  { meat: 'Chicken', label: 'Done',        targetTempC: 74 },
  { meat: 'Lamb',    label: 'Rare',        targetTempC: 55 },
  { meat: 'Lamb',    label: 'Medium-rare', targetTempC: 60 },
  { meat: 'Lamb',    label: 'Well-done',   targetTempC: 72 },
  { meat: 'Bread',   label: 'Standard',    targetTempC: 93 },
  { meat: 'Bread',   label: 'Sourdough',   targetTempC: 96 },
]

export const MEAT_TYPES = [...new Set(PRESETS.map(p => p.meat))]

export function presetsForMeat(meat: string): MeatPreset[] {
  return PRESETS.filter(p => p.meat === meat)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/ble/constants.ts src/presets.ts
git commit -m "feat: add types, BLE constants, meat presets"
```

---

## Task 3: Packet Builders and Decoders

**Files:**
- Create: `src/ble/packets.ts`

- [ ] **Step 1: Create src/ble/packets.ts**

```ts
function xorChecksum(bytes: Uint8Array, len: number): number {
  let cs = 0
  for (let i = 0; i < len; i++) cs ^= bytes[i]
  return cs
}

export function buildSecurityKey(): Uint8Array {
  const p = new Uint8Array([0xA0, 0x04, 0x0F, 0x00])
  p[3] = xorChecksum(p, 3)
  return p
}

export function buildRequestToken(nonce: number): Uint8Array {
  const p = new Uint8Array([0xA1, 0x04, nonce, 0x00])
  p[3] = xorChecksum(p, 3)
  return p
}

export function buildVerifyToken(token: Uint8Array, nonce: number): Uint8Array {
  const p = new Uint8Array([
    0xAC, 0x0A,
    token[4], token[3], token[0], token[5], token[1], token[2],
    nonce, 0x00,
  ])
  p[9] = xorChecksum(p, 9)
  return p
}

export function buildClockSync(nonce: number): Uint8Array {
  const ts = Math.floor(Date.now() / 1000)
  const p = new Uint8Array([
    0xAA, 0x08,
    ts & 0xFF, (ts >> 8) & 0xFF, (ts >> 16) & 0xFF, (ts >> 24) & 0xFF,
    nonce, 0x00,
  ])
  p[7] = xorChecksum(p, 7)
  return p
}

export function buildPollStatus(probeId: 0 | 1, nonce: number): Uint8Array {
  const p = new Uint8Array([0xA4, 0x05, probeId, nonce, 0x00])
  p[4] = xorChecksum(p, 4)
  return p
}

export function buildSetCookingSettings(
  nonce: number,
  probeId: 0 | 1,
  targetTempC: number,
  tempUnit: 'C' | 'F',
  foodSelection = 0,
  doneness = 0,
): Uint8Array {
  const tRaw = targetTempC + 100
  const eRaw = tRaw   // pre-alert same as target
  const unit = tempUnit === 'F' ? 1 : 0
  const p = new Uint8Array(10)
  p[0] = 0xA6
  p[1] = 10
  p[2] = (0 << 7) | ((doneness & 7) << 4) | (eRaw & 0x0F)
  p[3] = ((foodSelection & 0x7F) << 1) | unit
  p[4] = tRaw & 0xFF
  p[5] = ((tRaw & 0x300) >> 3) | ((eRaw & 0x1F0) >> 4)
  p[6] = ((eRaw & 0x200) >> 2) | 0
  p[7] = probeId & 0x0F
  p[8] = nonce
  p[9] = xorChecksum(p, 9)
  return p
}

export interface StatusPacket {
  probeId: 0 | 1
  tempC: number
  batteryPct: number
  remainingSecs: number
  elapsedSecs: number
}

export function decodeStatusPacket(data: DataView): StatusPacket | null {
  if (data.byteLength < 12) return null
  if (data.getUint8(0) !== 0x84) return null
  const b2 = data.getUint8(2)
  const b3 = data.getUint8(3)
  const b6 = data.getUint8(6)
  const b7 = data.getUint8(7)
  const b8 = data.getUint8(8)
  const b9 = data.getUint8(9)
  const raw = ((b9 & 0xFF) << 2) | (b8 & 0x03)
  const tempC = raw - 100
  const batteryPct = b2 & 0x7F
  const probeId = ((b3 & 0xF0) >> 4) as 0 | 1
  const remainingSecs = ((b8 & 0xE0) << 11) | ((b7 & 0xFF) << 8) | (b6 & 0xFF)
  const b4 = data.getUint8(4)
  const b5 = data.getUint8(5)
  const elapsedSecs = ((b5 & 0xFF) << 8) | ((b8 & 0x1C) << 14) | (b4 & 0xFF)
  return { probeId, tempC, batteryPct, remainingSecs, elapsedSecs }
}

export function decodeDeviceState(data: DataView): { state: number; nonce: number } | null {
  if (data.byteLength < 6) return null
  if (data.getUint8(0) !== 0x80) return null
  return { state: data.getUint8(2), nonce: data.getUint8(3) }
}

export function decodeTokenReply(data: DataView): { token: Uint8Array } | null {
  if (data.byteLength < 10) return null
  if (data.getUint8(0) !== 0x81) return null
  return { token: new Uint8Array([
    data.getUint8(2), data.getUint8(3), data.getUint8(4),
    data.getUint8(5), data.getUint8(6), data.getUint8(7),
  ])}
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ble/packets.ts
git commit -m "feat: BLE packet builders and decoders"
```

---

## Task 4: Token Storage

**Files:**
- Create: `src/storage/tokenStore.ts`

- [ ] **Step 1: Create src/storage/tokenStore.ts**

```ts
const KEY = (mac: string) => `gs_token_${mac.replace(/:/g, '')}`

export function saveToken(mac: string, token: Uint8Array): void {
  localStorage.setItem(KEY(mac), Array.from(token).join(','))
}

export function loadToken(mac: string): Uint8Array | null {
  const raw = localStorage.getItem(KEY(mac))
  if (!raw) return null
  const nums = raw.split(',').map(Number)
  if (nums.length !== 6) return null
  return new Uint8Array(nums)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/storage/tokenStore.ts
git commit -m "feat: token persistence in localStorage"
```

---

## Task 5: BLE Device Hook

**Files:**
- Create: `src/ble/useGrillDevice.ts`

- [ ] **Step 1: Create src/ble/useGrillDevice.ts**

```ts
import { useState, useRef, useCallback } from 'react'
import { SERVICE_UUID, NOTIFY_CHAR_UUID, WRITE_CHAR_UUID } from './constants'
import {
  buildSecurityKey, buildRequestToken, buildVerifyToken,
  buildClockSync, buildPollStatus, buildSetCookingSettings,
  decodeDeviceState, decodeTokenReply, decodeStatusPacket,
  StatusPacket,
} from './packets'
import { saveToken, loadToken } from '../storage/tokenStore'
import type { TempUnit } from '../types'

export interface GrillDevice {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  probe1: StatusPacket | null
  probe2: StatusPacket | null
  connect: () => Promise<void>
  disconnect: () => void
  setTarget: (probeId: 0 | 1, targetTempC: number, unit: TempUnit, food?: number, doneness?: number) => void
  error: string | null
}

export function useGrillDevice(): GrillDevice {
  const [status, setStatus] = useState<GrillDevice['status']>('disconnected')
  const [probe1, setProbe1] = useState<StatusPacket | null>(null)
  const [probe2, setProbe2] = useState<StatusPacket | null>(null)
  const [error, setError] = useState<string | null>(null)

  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const nonceRef = useRef<number>(0)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deviceRef = useRef<BluetoothDevice | null>(null)

  const write = useCallback(async (bytes: Uint8Array) => {
    if (!writeCharRef.current) throw new Error('Not connected')
    await writeCharRef.current.writeValueWithResponse(bytes)
  }, [])

  const waitForNotification = useCallback(
    (char: BluetoothRemoteGATTCharacteristic, header: number, timeoutMs = 5000): Promise<DataView> => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          char.removeEventListener('characteristicvaluechanged', handler)
          reject(new Error(`Timeout waiting for header 0x${header.toString(16)}`))
        }, timeoutMs)
        function handler(e: Event) {
          const val = (e.target as BluetoothRemoteGATTCharacteristic).value!
          if (val.getUint8(0) === header) {
            clearTimeout(timer)
            char.removeEventListener('characteristicvaluechanged', handler)
            resolve(val)
          }
        }
        char.addEventListener('characteristicvaluechanged', handler)
      })
    }, [])

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

      const server = await device.gatt!.connect()
      const service = await server.getPrimaryService(SERVICE_UUID)
      const notifyChar = await service.getCharacteristic(NOTIFY_CHAR_UUID)
      const writeChar = await service.getCharacteristic(WRITE_CHAR_UUID)
      writeCharRef.current = writeChar

      await notifyChar.startNotifications()

      // Handshake
      const p1 = waitForNotification(notifyChar, 0x80)
      await write(buildSecurityKey())
      const stateData = await p1
      const stateInfo = decodeDeviceState(stateData)
      if (!stateInfo) throw new Error('Bad device state reply')

      const { state, nonce } = stateInfo
      nonceRef.current = nonce
      const mac = device.id  // use device.id as MAC key (browser hides real MAC)

      let token = loadToken(mac)

      if (state !== 0 || !token) {
        // Request new token
        const p2 = waitForNotification(notifyChar, 0x81)
        await write(buildRequestToken(nonce))
        const tokenData = await p2
        const tokenInfo = decodeTokenReply(tokenData)
        if (!tokenInfo) throw new Error('Bad token reply')
        token = tokenInfo.token
        saveToken(mac, token)
      }

      // Verify token
      const p3 = waitForNotification(notifyChar, 0x8C)
      await write(buildVerifyToken(token, nonce))
      await p3

      // Clock sync
      const p4 = waitForNotification(notifyChar, 0x8A)
      await write(buildClockSync(nonce))
      await p4

      // Handle live notifications for temperature polling responses
      notifyChar.addEventListener('characteristicvaluechanged', (e) => {
        const val = (e.target as BluetoothRemoteGATTCharacteristic).value!
        if (val.getUint8(0) === 0x84) {
          const decoded = decodeStatusPacket(val)
          if (!decoded) return
          if (decoded.probeId === 0) setProbe1(decoded)
          else setProbe2(decoded)
        }
      })

      setStatus('connected')

      // Poll both probes every 2 seconds
      pollIntervalRef.current = setInterval(async () => {
        try {
          await write(buildPollStatus(0, nonceRef.current))
          await new Promise(r => setTimeout(r, 200))
          await write(buildPollStatus(1, nonceRef.current))
        } catch { /* device disconnected */ }
      }, 2000)

    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [write, waitForNotification])

  const disconnect = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    deviceRef.current?.gatt?.disconnect()
  }, [])

  const setTarget = useCallback(async (
    probeId: 0 | 1, targetTempC: number, unit: TempUnit,
    food = 0, doneness = 0,
  ) => {
    await write(buildSetCookingSettings(nonceRef.current, probeId, targetTempC, unit, food, doneness))
  }, [write])

  return { status, probe1, probe2, connect, disconnect, setTarget, error }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ble/useGrillDevice.ts
git commit -m "feat: BLE device hook with full handshake and polling"
```

---

## Task 6: ETA Hook

**Files:**
- Create: `src/hooks/useEta.ts`

- [ ] **Step 1: Create src/hooks/useEta.ts**

```ts
import { useMemo } from 'react'

interface EtaInput {
  readings: Array<{ tempC: number; timestamp: number }>
  targetTempC: number
  ovenTempC: number  // probe2 (ambient)
}

export function useEta({ readings, targetTempC, ovenTempC }: EtaInput): number | null {
  return useMemo(() => {
    // Need at least 3 minutes of readings
    if (readings.length < 4) return null
    const now = Date.now()
    const windowMs = 10 * 60 * 1000
    const recent = readings.filter(r => now - r.timestamp < windowMs)
    if (recent.length < 4) return null

    const T_oven = ovenTempC
    const current = recent[recent.length - 1].tempC
    if (current >= targetTempC) return 0
    if (T_oven <= current) return null  // oven not hotter than meat

    // Fit k via linear regression on ln(T_oven - T_meat) vs time
    const points = recent.map(r => ({
      t: (r.timestamp - recent[0].timestamp) / 1000,
      y: Math.log(Math.max(T_oven - r.tempC, 0.1)),
    }))
    const n = points.length
    const sumT = points.reduce((s, p) => s + p.t, 0)
    const sumY = points.reduce((s, p) => s + p.y, 0)
    const sumTY = points.reduce((s, p) => s + p.t * p.y, 0)
    const sumT2 = points.reduce((s, p) => s + p.t * p.t, 0)
    const slope = (n * sumTY - sumT * sumY) / (n * sumT2 - sumT * sumT)
    const k = -slope  // k > 0 means heating

    if (k <= 0) return null

    const D_now = T_oven - current
    const D_target = T_oven - targetTempC
    if (D_target <= 0) return 0

    const secsRemaining = Math.log(D_now / D_target) / k
    return secsRemaining > 0 ? secsRemaining : 0
  }, [readings, targetTempC, ovenTempC])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEta.ts
git commit -m "feat: Newton law ETA hook with linear regression"
```

---

## Task 7: UI Components

**Files:**
- Create: `src/components/ConnectButton.tsx`, `src/components/ProbeDisplay.tsx`, `src/components/PresetPicker.tsx`, `src/components/EtaDisplay.tsx`, `src/components/TempAlert.tsx`

- [ ] **Step 1: Create src/components/ConnectButton.tsx**

```tsx
interface Props {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  onConnect: () => void
  onDisconnect: () => void
  error: string | null
}

export default function ConnectButton({ status, onConnect, onDisconnect, error }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <button
        onClick={status === 'connected' ? onDisconnect : onConnect}
        disabled={status === 'connecting'}
        style={{
          padding: '0.75rem 1.5rem',
          background: status === 'connected' ? 'var(--red)' : 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1rem',
          cursor: status === 'connecting' ? 'wait' : 'pointer',
          opacity: status === 'connecting' ? 0.7 : 1,
        }}
      >
        {status === 'connecting' ? 'Connecting…' :
         status === 'connected' ? 'Disconnect' : 'Connect to Grill'}
      </button>
      {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem' }}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create src/components/ProbeDisplay.tsx**

```tsx
import type { StatusPacket } from '../ble/packets'
import type { TempUnit } from '../types'

interface Props {
  label: string
  data: StatusPacket | null
  targetTempC: number | null
  unit: TempUnit
}

function toDisplay(tempC: number, unit: TempUnit): string {
  const val = unit === 'F' ? tempC * 9 / 5 + 32 : tempC
  return `${Math.round(val)}°${unit}`
}

export default function ProbeDisplay({ label, data, targetTempC, unit }: Props) {
  if (!data) return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1.5rem', flex: 1 }}>
      <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ fontSize: '3rem', color: 'var(--muted)' }}>—</div>
    </div>
  )

  const pct = targetTempC
    ? Math.min(100, Math.round((data.tempC / targetTempC) * 100))
    : null

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1.5rem', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{label}</span>
        <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>🔋 {data.batteryPct}%</span>
      </div>
      <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent)' }}>
        {toDisplay(data.tempC, unit)}
      </div>
      {targetTempC && (
        <>
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Target: {toDisplay(targetTempC, unit)}
          </div>
          <div style={{ marginTop: '0.5rem', height: '6px', background: 'var(--border)', borderRadius: '3px' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: pct! >= 100 ? 'var(--green)' : 'var(--accent)',
              borderRadius: '3px', transition: 'width 0.5s',
            }} />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create src/components/PresetPicker.tsx**

```tsx
import { useState } from 'react'
import { MEAT_TYPES, presetsForMeat } from '../presets'
import type { MeatPreset, TempUnit } from '../types'

interface Props {
  unit: TempUnit
  onSelect: (preset: MeatPreset) => void
  onUnitChange: (unit: TempUnit) => void
}

function toDisplay(tempC: number, unit: TempUnit) {
  return unit === 'F' ? Math.round(tempC * 9 / 5 + 32) : tempC
}

export default function PresetPicker({ unit, onSelect, onUnitChange }: Props) {
  const [meat, setMeat] = useState(MEAT_TYPES[0])

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 'bold' }}>Target</span>
        <button
          onClick={() => onUnitChange(unit === 'C' ? 'F' : 'C')}
          style={{ background: 'var(--border)', border: 'none', color: 'var(--text)', padding: '0.25rem 0.75rem', borderRadius: '6px', cursor: 'pointer' }}
        >
          °C / °F
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {MEAT_TYPES.map(m => (
          <button key={m} onClick={() => setMeat(m)}
            style={{
              padding: '0.35rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: meat === m ? 'var(--accent)' : 'var(--border)',
              color: 'var(--text)',
            }}
          >{m}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {presetsForMeat(meat).map(p => (
          <button key={p.label} onClick={() => onSelect(p)}
            style={{
              padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', cursor: 'pointer',
            }}
          >
            {p.label} {toDisplay(p.targetTempC, unit)}°{unit}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create src/components/EtaDisplay.tsx**

```tsx
interface Props {
  etaSecs: number | null
}

export default function EtaDisplay({ etaSecs }: Props) {
  if (etaSecs === null) return (
    <div style={{ color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center' }}>
      ETA: calculating…
    </div>
  )
  if (etaSecs === 0) return (
    <div style={{ color: 'var(--green)', fontWeight: 'bold', textAlign: 'center' }}>
      ✓ Target reached!
    </div>
  )
  const mins = Math.ceil(etaSecs / 60)
  return (
    <div style={{ textAlign: 'center', color: 'var(--text)' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>ETA </span>
      <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>~{mins} min</span>
    </div>
  )
}
```

- [ ] **Step 5: Create src/components/TempAlert.tsx**

```tsx
import { useEffect, useRef } from 'react'

interface Props {
  triggered: boolean
  meatLabel: string
  onDismiss: () => void
}

export default function TempAlert({ triggered, meatLabel, onDismiss }: Props) {
  const audioCtx = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!triggered) return
    // Simple beep via Web Audio API
    const ctx = new AudioContext()
    audioCtx.current = ctx
    const beep = (startTime: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4)
      osc.start(startTime)
      osc.stop(startTime + 0.4)
    }
    beep(ctx.currentTime)
    beep(ctx.currentTime + 0.5)
    beep(ctx.currentTime + 1.0)
  }, [triggered])

  if (!triggered) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px', padding: '2rem',
        textAlign: 'center', maxWidth: '320px', border: '2px solid var(--green)',
      }}>
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 style={{ marginTop: '1rem' }}>{meatLabel} is ready!</h2>
        <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1.5rem' }}>Target temperature reached.</p>
        <button onClick={onDismiss} style={{
          background: 'var(--green)', color: '#fff', border: 'none',
          padding: '0.75rem 2rem', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer',
        }}>OK</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: UI components — connect, probes, presets, ETA, alert"
```

---

## Task 8: Wire Up App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace src/App.tsx**

```tsx
import { useState, useEffect, useRef } from 'react'
import { useGrillDevice } from './ble/useGrillDevice'
import { useEta } from './hooks/useEta'
import ConnectButton from './components/ConnectButton'
import ProbeDisplay from './components/ProbeDisplay'
import PresetPicker from './components/PresetPicker'
import EtaDisplay from './components/EtaDisplay'
import TempAlert from './components/TempAlert'
import type { MeatPreset, TempUnit, ProbeReading } from './types'

export default function App() {
  const device = useGrillDevice()
  const [unit, setUnit] = useState<TempUnit>('C')
  const [selectedPreset, setSelectedPreset] = useState<MeatPreset | null>(null)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [readings, setReadings] = useState<ProbeReading[]>([])

  // Collect probe1 readings for ETA
  useEffect(() => {
    if (!device.probe1) return
    setReadings(prev => [...prev.slice(-300), {
      probeId: 0,
      tempC: device.probe1!.tempC,
      batteryPct: device.probe1!.batteryPct,
      timestamp: Date.now(),
    }])
  }, [device.probe1])

  // Reset readings on disconnect
  useEffect(() => {
    if (device.status === 'disconnected') {
      setReadings([])
      setAlertDismissed(false)
    }
  }, [device.status])

  // Send cooking settings when target changes and connected
  useEffect(() => {
    if (device.status !== 'connected' || !selectedPreset) return
    device.setTarget(0, selectedPreset.targetTempC, unit)
    device.setTarget(1, selectedPreset.targetTempC, unit)
  }, [selectedPreset, unit, device.status])

  const ovenTempC = device.probe2?.tempC ?? 200
  const eta = useEta({
    readings,
    targetTempC: selectedPreset?.targetTempC ?? 75,
    ovenTempC,
  })

  const targetReached = !!(
    selectedPreset &&
    device.probe1 &&
    device.probe1.tempC >= selectedPreset.targetTempC
  )

  return (
    <div className="app">
      <h1 style={{ color: 'var(--accent)', fontSize: '1.5rem' }}>🔥 GrillSmart</h1>

      <ConnectButton
        status={device.status}
        onConnect={device.connect}
        onDisconnect={device.disconnect}
        error={device.error}
      />

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <ProbeDisplay
          label="Probe 1 — Meat"
          data={device.probe1}
          targetTempC={selectedPreset?.targetTempC ?? null}
          unit={unit}
        />
        <ProbeDisplay
          label="Probe 2 — Oven"
          data={device.probe2}
          targetTempC={null}
          unit={unit}
        />
      </div>

      {device.status === 'connected' && selectedPreset && (
        <EtaDisplay etaSecs={eta} />
      )}

      <PresetPicker
        unit={unit}
        onSelect={(preset) => { setSelectedPreset(preset); setAlertDismissed(false) }}
        onUnitChange={(u) => setUnit(u)}
      />

      <TempAlert
        triggered={targetReached && !alertDismissed}
        meatLabel={selectedPreset ? `${selectedPreset.meat} (${selectedPreset.label})` : ''}
        onDismiss={() => setAlertDismissed(true)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up full app — connect, probes, presets, ETA, alert"
```

---

## Task 9: Verify End-to-End

- [ ] **Step 1: Run type check**

```bash
cd /home/ola/git/grill-smart && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 2: Check dev server is running and accessible**

```bash
WSL_IP=$(ip route show | grep -oP '(?<=src )\S+' | tail -1)
echo "Open in Chrome on Windows: http://$WSL_IP:5173"
```

- [ ] **Step 3: Manual test checklist**
  - Click "Connect to Grill" → browser BLE picker shows GS_XXXX device
  - Select device → status changes to Connected
  - Both probe temps appear within 3 seconds
  - Select Beef → Medium-rare → target line and progress bar appear on Probe 1
  - Toggle °C/°F → temperatures update everywhere
  - After ~3 min of readings, ETA appears
  - When probe reaches target → alert modal + beep

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: GrillSmart MVP complete"
```
