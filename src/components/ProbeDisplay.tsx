import type { StatusPacket } from '../ble/packets'
import type { TempUnit } from '../types'

interface Props {
  label: string
  data: StatusPacket | null
  targetTempC: number | null
  unit: TempUnit
  etaSecs?: number | null
}

function toDisplay(tempC: number, unit: TempUnit): string {
  const val = unit === 'F' ? Math.round((tempC * 9) / 5 + 32) : Math.round(tempC)
  return `${val}°${unit}`
}

export default function ProbeDisplay({ label, data, targetTempC, unit, etaSecs }: Props) {
  const surface: React.CSSProperties = {
    background: 'var(--surface)',
    borderRadius: '12px',
    padding: '1.5rem',
    flex: 1,
  }

  if (!data) return null

  const pct = targetTempC ? Math.min(100, Math.round((data.tempC / targetTempC) * 100)) : null
  const done = pct !== null && pct >= 100

  return (
    <div style={surface}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{label}</span>
        <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>🔋 {data.batteryPct}%</span>
      </div>
      <div
        style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          color: done ? 'var(--green)' : 'var(--accent)',
        }}
      >
        {toDisplay(data.tempC, unit)}
      </div>
      {targetTempC && (
        <>
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Target: {toDisplay(targetTempC, unit)}
          </div>
          <div
            style={{
              marginTop: '0.5rem',
              height: '6px',
              background: 'var(--border)',
              borderRadius: '3px',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: '3px',
                transition: 'width 0.5s',
                background: done ? 'var(--green)' : 'var(--accent)',
              }}
            />
          </div>
          {etaSecs !== undefined && etaSecs !== null && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              {etaSecs === 0
                ? <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>✓ Ready!</span>
                : <>ETA <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>~{Math.ceil(etaSecs / 60)} min</span></>
              }
            </div>
          )}
        </>
      )}
    </div>
  )
}
