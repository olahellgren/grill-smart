import { useState, useEffect, useRef } from 'react'
import { useGrillDevice } from './ble/useGrillDevice'
import { useEta } from './hooks/useEta'
import ConnectButton from './components/ConnectButton'
import ProbeDisplay from './components/ProbeDisplay'
import PresetPicker from './components/PresetPicker'
import EtaDisplay from './components/EtaDisplay'
import TempAlert from './components/TempAlert'
import TempGraph from './components/TempGraph'
import InfoButton from './components/InfoButton'
import type { MeatPreset, TempUnit, ProbeReading } from './types'

export default function App() {
  const [unit, setUnit] = useState<TempUnit>('C')
  const device = useGrillDevice(unit)

  const [activeProbe, setActiveProbe] = useState<0 | 1>(0)
  const [targets, setTargets] = useState<[number | null, number | null]>([null, null])
  const [alertDismissed, setAlertDismissed] = useState<[boolean, boolean]>([false, false])
  const [readings1, setReadings1] = useState<ProbeReading[]>([])
  const [readings2, setReadings2] = useState<ProbeReading[]>([])
  const [ovenTempC, setOvenTempC] = useState(180)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Request notification permission on first load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Screen wake lock — keep display on while connected
  useEffect(() => {
    if (device.status !== 'connected' || !('wakeLock' in navigator)) return
    let released = false

    async function acquire() {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        /* denied or not supported */
      }
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

  // Accumulate readings per probe
  useEffect(() => {
    if (!device.probe1) return
    setReadings1((prev) => [
      ...prev.slice(-300),
      { probeId: 0, tempC: device.probe1!.tempC, batteryPct: device.probe1!.batteryPct, timestamp: Date.now() },
    ])
  }, [device.probe1])

  useEffect(() => {
    if (!device.probe2) return
    setReadings2((prev) => [
      ...prev.slice(-300),
      { probeId: 1, tempC: device.probe2!.tempC, batteryPct: device.probe2!.batteryPct, timestamp: Date.now() },
    ])
  }, [device.probe2])

  // Reset on disconnect
  useEffect(() => {
    if (device.status === 'disconnected') {
      setReadings1([])
      setReadings2([])
      setAlertDismissed([false, false])
    }
  }, [device.status])

  // Push cooking settings whenever target or unit changes while connected
  useEffect(() => {
    if (device.status !== 'connected') return
    device.setTarget(0, targets[0] ?? 75, unit)
    device.setTarget(1, targets[1] ?? 75, unit)
  }, [targets, unit, device.status, device.setTarget]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePreset(preset: MeatPreset) {
    setTargets((prev) => prev.map((t, i) => (i === activeProbe ? preset.targetTempC : t)) as [number | null, number | null])
    setAlertDismissed((prev) => prev.map((d, i) => (i === activeProbe ? false : d)) as [boolean, boolean])
  }

  function handleCustom(tempC: number) {
    setTargets((prev) => prev.map((t, i) => (i === activeProbe ? tempC : t)) as [number | null, number | null])
    setAlertDismissed((prev) => prev.map((d, i) => (i === activeProbe ? false : d)) as [boolean, boolean])
  }

  const probe1Ready = targets[0] !== null && device.probe1 !== null && device.probe1.tempC >= targets[0]
  const probe2Ready = targets[1] !== null && device.probe2 !== null && device.probe2.tempC >= targets[1]!

  // Show one alert at a time — probe 1 takes priority
  const alertProbe: 1 | 2 | null =
    probe1Ready && !alertDismissed[0] ? 1 : probe2Ready && !alertDismissed[1] ? 2 : null

  const eta = useEta({ readings: readings1, targetTempC: targets[0] ?? 75, ovenTempC })

  const hasHistory = readings1.length >= 2 || readings2.length >= 2

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

      {(device.probe1 || device.probe2) && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <ProbeDisplay label="Probe 1" data={device.probe1} targetTempC={targets[0]} unit={unit} />
          <ProbeDisplay label="Probe 2" data={device.probe2} targetTempC={targets[1]} unit={unit} />
        </div>
      )}

      {hasHistory && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {readings1.length >= 2 && device.probe1 && (
            <TempGraph readings={readings1} targetTempC={targets[0]} unit={unit} label="Probe 1" />
          )}
          {readings2.length >= 2 && device.probe2 && (
            <TempGraph readings={readings2} targetTempC={targets[1]} unit={unit} label="Probe 2" />
          )}
        </div>
      )}

      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '10px',
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          Oven temp:
        </span>
        <input
          type="number"
          value={unit === 'F' ? Math.round((ovenTempC * 9) / 5 + 32) : ovenTempC}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) setOvenTempC(unit === 'F' ? ((v - 32) * 5) / 9 : v)
          }}
          style={{
            width: '70px',
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.25rem 0.5rem',
            fontSize: '0.95rem',
          }}
        />
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>°{unit} — used for ETA</span>
      </div>

      {device.status === 'connected' && targets[0] !== null && <EtaDisplay etaSecs={eta} />}

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
