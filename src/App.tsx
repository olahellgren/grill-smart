import { useState, useEffect, useRef } from 'react'
import { useGrillDevice } from './ble/useGrillDevice'
import { useEta } from './hooks/useEta'
import { useThrottledEta } from './hooks/useThrottledEta'
import ConnectButton from './components/ConnectButton'
import ProbeDisplay from './components/ProbeDisplay'
import PresetPicker from './components/PresetPicker'
import TempAlert from './components/TempAlert'
import TempGraph from './components/TempGraph'
import InfoButton from './components/InfoButton'
import ResumePrompt from './components/ResumePrompt'
import { loadSession, saveSession, clearSession } from './storage/sessionStore'
import type { MeatPreset, TempUnit, ProbeReading } from './types'

export default function App() {
  const [unit, setUnit] = useState<TempUnit>('C')
  const device = useGrillDevice(unit)

  const [activeProbe, setActiveProbe] = useState<0 | 1>(0)
  const [targets, setTargets] = useState<[number | null, number | null]>([null, null])
  const [foods, setFoods] = useState<[number, number]>([0, 0])
  const [doneness, setDoneness] = useState<[number, number]>([0, 0])
  const [alertDismissed, setAlertDismissed] = useState<[boolean, boolean]>([false, false])
  const [readings1, setReadings1] = useState<ProbeReading[]>([])
  const [readings2, setReadings2] = useState<ProbeReading[]>([])
  const [graphReadings1, setGraphReadings1] = useState<ProbeReading[]>([])
  const [graphReadings2, setGraphReadings2] = useState<ProbeReading[]>([])
  const [ovenTempC, setOvenTempC] = useState(180)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const cookStartTempRef = useRef<[number | null, number | null]>([null, null])
  const cookStartedRef = useRef<[boolean, boolean]>([false, false])

  // Session resume state — null = not yet decided, undefined = no saved session
  const [pendingSession, setPendingSession] = useState<ReturnType<typeof loadSession> | undefined>(undefined)

  // Load saved session on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const saved = loadSession()
    if (saved && (saved.readings1.length > 0 || saved.readings2.length > 0)) {
      setPendingSession(saved)
    } else {
      setPendingSession(undefined)
    }
  }, [])

  function handleResume() {
    if (!pendingSession) return
    setTargets(pendingSession.targets)
    setReadings1(pendingSession.readings1)
    setReadings2(pendingSession.readings2)
    setOvenTempC(pendingSession.ovenTempC)
    setUnit(pendingSession.unit)
    setPendingSession(undefined)
  }

  function handleClear() {
    clearSession()
    setPendingSession(undefined)
  }

  // Auto-save session whenever readings or settings change
  useEffect(() => {
    if (readings1.length === 0 && readings2.length === 0) return
    saveSession({ targets, readings1, readings2, ovenTempC, unit, savedAt: Date.now() })
  }, [readings1, readings2, targets, ovenTempC, unit])

  // Screen wake lock — keep display on while connected
  useEffect(() => {
    if (device.status !== 'connected' || !('wakeLock' in navigator)) return
    let released = false

    async function acquire() {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch { /* denied or not supported */ }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible' && !released) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      wakeLockRef.current?.release()
      wakeLockRef.current = null
    }
  }, [device.status])

  // Accumulate readings per probe; graph state samples at 1-per-minute
  useEffect(() => {
    if (!device.probe1) return
    const r = { probeId: 0 as const, tempC: device.probe1.tempC, batteryPct: device.probe1.batteryPct, timestamp: Date.now() }
    setReadings1((prev) => [...prev.slice(-300), r])
    setGraphReadings1((prev) => {
      const last = prev[prev.length - 1]
      if (last && r.timestamp - last.timestamp < 60_000) return prev
      return [...prev.slice(-300), r]
    })
  }, [device.probe1])

  useEffect(() => {
    if (!device.probe2) return
    const r = { probeId: 1 as const, tempC: device.probe2.tempC, batteryPct: device.probe2.batteryPct, timestamp: Date.now() }
    setReadings2((prev) => [...prev.slice(-300), r])
    setGraphReadings2((prev) => {
      const last = prev[prev.length - 1]
      if (last && r.timestamp - last.timestamp < 60_000) return prev
      return [...prev.slice(-300), r]
    })
  }, [device.probe2])

  // Clear readings on disconnect but keep targets — user will reconnect to same cook
  useEffect(() => {
    if (device.status === 'disconnected') {
      setAlertDismissed([false, false])
      cookStartTempRef.current = [null, null]
      cookStartedRef.current = [false, false]
    }
  }, [device.status])

  // Push cooking settings whenever target or unit changes while connected.
  useEffect(() => {
    if (device.status !== 'connected') return
    ;(async () => {
      if (targets[0] !== null) await device.setTarget(0, targets[0], unit, foods[0], doneness[0])
      if (targets[1] !== null) await device.setTarget(1, targets[1], unit, foods[1], doneness[1])
    })()
  }, [targets, foods, doneness, unit, device.status, device.setTarget]) // eslint-disable-line react-hooks/exhaustive-deps

  // Send 0xa9 STARTED once probe has risen ≥10°C from cook start or is within 10°C of target.
  useEffect(() => {
    if (!device.probe1 || targets[0] === null || cookStartedRef.current[0]) return
    const t = device.probe1.tempC
    if (cookStartTempRef.current[0] === null) { cookStartTempRef.current[0] = t; return }
    if (t - cookStartTempRef.current[0] >= 10 || targets[0] - t <= 10) {
      cookStartedRef.current[0] = true
      device.startCooking(0)
    }
  }, [device.probe1, targets, device.startCooking])

  useEffect(() => {
    if (!device.probe2 || targets[1] === null || cookStartedRef.current[1]) return
    const t = device.probe2.tempC
    if (cookStartTempRef.current[1] === null) { cookStartTempRef.current[1] = t; return }
    if (t - cookStartTempRef.current[1] >= 10 || targets[1] - t <= 10) {
      cookStartedRef.current[1] = true
      device.startCooking(1)
    }
  }, [device.probe2, targets, device.startCooking])

  function handlePreset(preset: MeatPreset) {
    cookStartTempRef.current[activeProbe] = null
    cookStartedRef.current[activeProbe] = false
    setTargets((prev) => prev.map((t, i) => (i === activeProbe ? preset.targetTempC : t)) as [number | null, number | null])
    setFoods((prev) => prev.map((f, i) => (i === activeProbe ? preset.foodCode : f)) as [number, number])
    setDoneness((prev) => prev.map((d, i) => (i === activeProbe ? preset.doneness : d)) as [number, number])
    setAlertDismissed((prev) => prev.map((d, i) => (i === activeProbe ? false : d)) as [boolean, boolean])
  }

  function handleCustom(tempC: number) {
    cookStartTempRef.current[activeProbe] = null
    cookStartedRef.current[activeProbe] = false
    setTargets((prev) => prev.map((t, i) => (i === activeProbe ? tempC : t)) as [number | null, number | null])
    setFoods((prev) => prev.map((f, i) => (i === activeProbe ? 5 : f)) as [number, number])
    setDoneness((prev) => prev.map((d, i) => (i === activeProbe ? 3 : d)) as [number, number])
    setAlertDismissed((prev) => prev.map((d, i) => (i === activeProbe ? false : d)) as [boolean, boolean])
  }

  const probe1Ready = targets[0] !== null && device.probe1 !== null && device.probe1.tempC >= targets[0]
  const probe2Ready = targets[1] !== null && device.probe2 !== null && device.probe2.tempC >= targets[1]!
  const alertProbe: 1 | 2 | null =
    probe1Ready && !alertDismissed[0] ? 1 : probe2Ready && !alertDismissed[1] ? 2 : null

  const eta = useEta({ readings: readings1, targetTempC: targets[0] ?? 75, ovenTempC })
  const throttledEta = useThrottledEta(eta)
  const hasHistory = graphReadings1.length >= 2 || graphReadings2.length >= 2

  return (
    <div className="app">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ color: 'var(--accent)', fontSize: '1.4rem', fontWeight: 'bold', margin: 0 }}>
          🔥 GrillSmart Thermometer
        </h1>
        <InfoButton />
      </div>

      <ConnectButton
        status={device.status}
        onConnect={device.connect}
        onDisconnect={device.disconnect}
        error={device.error}
      />

      {pendingSession && device.status === 'disconnected' && (
        <ResumePrompt
          session={pendingSession}
          unit={unit}
          onResume={handleResume}
          onClear={handleClear}
        />
      )}

      {(device.probe1 || device.probe2) && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <ProbeDisplay label="Probe 1" data={device.probe1} targetTempC={targets[0]} unit={unit} etaSecs={throttledEta} />
          <ProbeDisplay label="Probe 2" data={device.probe2} targetTempC={targets[1]} unit={unit} />
        </div>
      )}

      {hasHistory && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {graphReadings1.length >= 2 && device.probe1 && (
            <TempGraph readings={graphReadings1} targetTempC={targets[0]} unit={unit} label="Probe 1" />
          )}
          {graphReadings2.length >= 2 && device.probe2 && (
            <TempGraph readings={graphReadings2} targetTempC={targets[1]} unit={unit} label="Probe 2" />
          )}
        </div>
      )}

      <div style={{
        background: 'var(--surface)', borderRadius: '10px',
        padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
      }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Oven temp:</span>
        <input
          type="number"
          value={unit === 'F' ? Math.round((ovenTempC * 9) / 5 + 32) : ovenTempC}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) setOvenTempC(unit === 'F' ? ((v - 32) * 5) / 9 : v)
          }}
          style={{
            width: '70px', background: 'var(--bg)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: '6px',
            padding: '0.25rem 0.5rem', fontSize: '0.95rem',
          }}
        />
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>°{unit} — used for ETA</span>
      </div>


      <PresetPicker
        unit={unit}
        activeProbe={activeProbe}
        activeTempC={targets[activeProbe]}
        onProbeChange={setActiveProbe}
        onSelect={handlePreset}
        onCustom={handleCustom}
        onUnitChange={setUnit}
      />

      <TempAlert
        probeNum={alertProbe}
        onDismiss={() =>
          alertProbe !== null &&
          setAlertDismissed(
            (prev) => prev.map((d, i) => (i === alertProbe - 1 ? true : d)) as [boolean, boolean],
          )
        }
      />
    </div>
  )
}
