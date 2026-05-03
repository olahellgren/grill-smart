import { useState, useEffect } from 'react'
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

  // Accumulate probe 1 readings for ETA
  useEffect(() => {
    if (!device.probe1) return
    setReadings(prev => [...prev.slice(-300), {
      probeId: 0,
      tempC: device.probe1!.tempC,
      batteryPct: device.probe1!.batteryPct,
      timestamp: Date.now(),
    }])
  }, [device.probe1])

  // Reset on disconnect
  useEffect(() => {
    if (device.status === 'disconnected') {
      setReadings([])
      setAlertDismissed(false)
    }
  }, [device.status])

  // Push cooking settings to device whenever target or unit changes
  useEffect(() => {
    if (device.status !== 'connected' || !selectedPreset) return
    device.setTarget(0, selectedPreset.targetTempC, unit)
    device.setTarget(1, selectedPreset.targetTempC, unit)
  }, [selectedPreset, unit, device.status])

  const ovenTempC = device.probe2?.tempC ?? 220
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
      <h1 style={{ color: 'var(--accent)', fontSize: '1.4rem', fontWeight: 'bold' }}>
        🔥 GrillSmart
      </h1>

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
        onSelect={preset => { setSelectedPreset(preset); setAlertDismissed(false) }}
        onUnitChange={setUnit}
      />

      <TempAlert
        triggered={targetReached && !alertDismissed}
        meatLabel={selectedPreset ? `${selectedPreset.meat} — ${selectedPreset.label}` : ''}
        onDismiss={() => setAlertDismissed(true)}
      />
    </div>
  )
}
