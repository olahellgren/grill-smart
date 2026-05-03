import { useState } from 'react'
import { MEAT_TYPES, presetsForMeat } from '../presets'
import type { MeatPreset, TempUnit } from '../types'

interface Props {
  unit: TempUnit
  activeProbe: 0 | 1
  activeTempC: number | null
  onProbeChange: (probe: 0 | 1) => void
  onSelect: (preset: MeatPreset) => void
  onCustom: (tempC: number) => void
  onUnitChange: (unit: TempUnit) => void
}

function toDisplay(tempC: number, unit: TempUnit) {
  return unit === 'F' ? Math.round((tempC * 9) / 5 + 32) : tempC
}

function fromDisplay(val: number, unit: TempUnit): number {
  return unit === 'F' ? ((val - 32) * 5) / 9 : val
}

export default function PresetPicker({
  unit,
  activeProbe,
  activeTempC,
  onProbeChange,
  onSelect,
  onCustom,
  onUnitChange,
}: Props) {
  const [meat, setMeat] = useState(MEAT_TYPES[0])
  const [customInput, setCustomInput] = useState('')

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--border)',
    color: 'var(--text)',
    fontWeight: active ? 'bold' : 'normal',
  })

  const isActivePreset = (p: MeatPreset) =>
    activeTempC !== null && Math.abs(p.targetTempC - activeTempC) < 0.5

  function handleCustomSet() {
    const num = parseFloat(customInput)
    if (isNaN(num)) return
    onCustom(fromDisplay(num, unit))
    setCustomInput('')
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1rem' }}>
      {/* Header row: probe tabs + unit toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => onProbeChange(0)}
            style={{ ...btn(activeProbe === 0), fontSize: '0.85rem' }}
          >
            Probe 1
          </button>
          <button
            onClick={() => onProbeChange(1)}
            style={{ ...btn(activeProbe === 1), fontSize: '0.85rem' }}
          >
            Probe 2
          </button>
        </div>
        <button
          onClick={() => onUnitChange(unit === 'C' ? 'F' : 'C')}
          style={{ ...btn(false), padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
        >
          °{unit === 'C' ? 'C → °F' : 'F → °C'}
        </button>
      </div>

      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.6rem' }}>
        Probe {activeProbe + 1} target temperature
      </div>

      {/* Meat type selector */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {MEAT_TYPES.map((m) => (
          <button key={m} onClick={() => setMeat(m)} style={btn(meat === m)}>
            {m}
          </button>
        ))}
      </div>

      {/* Doneness presets */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {presetsForMeat(meat).map((p) => (
          <button
            key={p.label}
            onClick={() => onSelect(p)}
            style={{
              ...btn(isActivePreset(p)),
              border: `1px solid ${isActivePreset(p) ? 'var(--accent)' : 'var(--border)'}`,
              background: isActivePreset(p) ? 'var(--accent)' : 'transparent',
            }}
          >
            {p.label} · {toDisplay(p.targetTempC, unit)}°{unit}
          </button>
        ))}
      </div>

      {/* Custom temp input */}
      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          Custom:
        </span>
        <input
          type="number"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCustomSet()}
          placeholder={`e.g. ${unit === 'C' ? '65' : '149'}`}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.35rem 0.6rem',
            fontSize: '1rem',
          }}
        />
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>°{unit}</span>
        <button
          onClick={handleCustomSet}
          style={{
            ...btn(false),
            background: 'var(--accent)',
            color: '#fff',
            padding: '0.35rem 0.9rem',
          }}
        >
          Set
        </button>
      </div>
    </div>
  )
}
