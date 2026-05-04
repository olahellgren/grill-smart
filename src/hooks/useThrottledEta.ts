import { useState, useEffect, useRef } from 'react'

// Updates at most once per minute and only when ETA has shifted by ≥60 seconds.
export function useThrottledEta(eta: number | null): number | null {
  const [displayed, setDisplayed] = useState<number | null>(null)
  const etaRef = useRef<number | null>(eta)
  const lastRef = useRef<number | null>(null)

  // Keep ref current so the interval always sees the latest value.
  useEffect(() => {
    etaRef.current = eta
  }, [eta])

  // Show first available value immediately.
  useEffect(() => {
    if (eta !== null && lastRef.current === null) {
      setDisplayed(eta)
      lastRef.current = eta
    }
  }, [eta])

  // After that, check once per minute and update only if changed by ≥1 min.
  useEffect(() => {
    const id = setInterval(() => {
      const current = etaRef.current
      const last = lastRef.current
      if (current === null) return
      if (last === null || Math.abs(current - last) >= 60) {
        setDisplayed(current)
        lastRef.current = current
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  return displayed
}
