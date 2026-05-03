import { useEffect } from 'react'

interface Props {
  probeNum: 1 | 2 | null
  onDismiss: () => void
}

export default function TempAlert({ probeNum, onDismiss }: Props) {
  useEffect(() => {
    if (!probeNum) return
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🔥 GrillSmart — Ready!', {
        body: `Probe ${probeNum} has reached target temperature.`,
      })
    }
    const ctx = new AudioContext()
    const beep = (t: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t)
      osc.stop(t + 0.4)
    }
    beep(ctx.currentTime)
    beep(ctx.currentTime + 0.5)
    beep(ctx.currentTime + 1.0)
  }, [probeNum])

  if (!probeNum) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '320px',
          border: '2px solid var(--green)',
        }}
      >
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 style={{ margin: '1rem 0 0.5rem' }}>Probe {probeNum} is ready!</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>Target temperature reached.</p>
        <button
          onClick={onDismiss}
          style={{
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 2rem',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  )
}
