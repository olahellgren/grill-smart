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
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '2rem',
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          color: '#111',
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div style={{ fontSize: '4rem', lineHeight: 1 }}>✅</div>
        <h2 style={{ margin: '0.75rem 0 0.4rem', fontSize: '1.5rem', color: '#111' }}>
          Probe {probeNum} is ready!
        </h2>
        <p style={{ color: '#555', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Target temperature reached.
        </p>
        <button
          onClick={onDismiss}
          style={{
            background: '#4caf50',
            color: '#fff',
            border: 'none',
            padding: '0.85rem 0',
            borderRadius: '12px',
            fontSize: '1.05rem',
            cursor: 'pointer',
            width: '100%',
            fontWeight: 'bold',
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  )
}
