export interface ProbeReading {
  probeId: 0 | 1
  tempC: number
  batteryPct: number
  timestamp: number
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
