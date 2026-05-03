import { useMemo } from 'react'
import type { ProbeReading } from '../types'

interface EtaInput {
  readings: ProbeReading[]
  targetTempC: number
  ovenTempC: number
}

export function useEta({ readings, targetTempC, ovenTempC }: EtaInput): number | null {
  return useMemo(() => {
    if (readings.length < 4) return null
    const now = Date.now()
    const recent = readings.filter((r) => now - r.timestamp < 10 * 60 * 1000)
    if (recent.length < 4) return null

    const current = recent[recent.length - 1].tempC
    if (current >= targetTempC) return 0
    if (ovenTempC <= current) return null

    const points = recent.map((r) => ({
      t: (r.timestamp - recent[0].timestamp) / 1000,
      y: Math.log(Math.max(ovenTempC - r.tempC, 0.1)),
    }))
    const n = points.length
    const sumT = points.reduce((s, p) => s + p.t, 0)
    const sumY = points.reduce((s, p) => s + p.y, 0)
    const sumTY = points.reduce((s, p) => s + p.t * p.y, 0)
    const sumT2 = points.reduce((s, p) => s + p.t * p.t, 0)
    const denom = n * sumT2 - sumT * sumT
    if (denom === 0) return null
    const k = -(n * sumTY - sumT * sumY) / denom
    if (k <= 0) return null

    const secsRemaining = Math.log((ovenTempC - current) / (ovenTempC - targetTempC)) / k
    return secsRemaining > 0 ? secsRemaining : 0
  }, [readings, targetTempC, ovenTempC])
}
