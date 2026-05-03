import type { ProbeReading, TempUnit } from '../types'

const KEY = 'grill-smart-session'

export interface SavedSession {
  targets: [number | null, number | null]
  readings1: ProbeReading[]
  readings2: ProbeReading[]
  ovenTempC: number
  unit: TempUnit
  savedAt: number
}

export function saveSession(s: SavedSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* storage full */ }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as SavedSession
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
