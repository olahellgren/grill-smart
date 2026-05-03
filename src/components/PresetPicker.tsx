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

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--border)', color: 'var(--text)',
  })

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 'bold' }}>Target temp</span>
        <button onClick={() => onUnitChange(unit === 'C' ? 'F' : 'C')}
          style={{ ...btn(false), padding: '0.25rem 0.75rem' }}>
          °{unit === 'C' ? 'C → F' : 'F → C'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {MEAT_TYPES.map(m => (
          <button key={m} onClick={() => setMeat(m)} style={btn(meat === m)}>{m}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {presetsForMeat(meat).map(p => (
          <button key={p.label} onClick={() => onSelect(p)}
            style={{ ...btn(false), border: '1px solid var(--border)', background: 'transparent' }}>
            {p.label} · {toDisplay(p.targetTempC, unit)}°{unit}
          </button>
        ))}
      </div>
    </div>
  )
}
