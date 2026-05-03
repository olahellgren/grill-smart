import type { SavedSession } from '../storage/sessionStore'
import type { TempUnit } from '../types'

interface Props {
  session: SavedSession
  unit: TempUnit
  onResume: () => void
  onClear: () => void
}

function timeAgo(ts: number) {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function toDisplay(tempC: number, unit: TempUnit) {
  return unit === 'F' ? `${Math.round((tempC * 9) / 5 + 32)}°F` : `${Math.round(tempC)}°C`
}

export default function ResumePrompt({ session, unit, onResume, onClear }: Props) {
  const pts1 = session.readings1.length
  const pts2 = session.readings2.length

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--accent)',
      borderRadius: '12px',
      padding: '1rem',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.4rem' }}>
        Previous session found
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.6rem' }}>
        Saved {timeAgo(session.savedAt)}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.9rem', fontSize: '0.85rem' }}>
        {pts1 > 0 && (
          <div>
            <span style={{ color: 'var(--muted)' }}>Probe 1 · </span>
            {pts1} pts
            {session.targets[0] !== null && (
              <span style={{ color: 'var(--muted)' }}> · target {toDisplay(session.targets[0], unit)}</span>
            )}
          </div>
        )}
        {pts2 > 0 && (
          <div>
            <span style={{ color: 'var(--muted)' }}>Probe 2 · </span>
            {pts2} pts
            {session.targets[1] !== null && (
              <span style={{ color: 'var(--muted)' }}> · target {toDisplay(session.targets[1], unit)}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onResume}
          style={{
            flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
          }}
        >
          Continue
        </button>
        <button
          onClick={onClear}
          style={{
            flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
          }}
        >
          Start fresh
        </button>
      </div>
    </div>
  )
}
