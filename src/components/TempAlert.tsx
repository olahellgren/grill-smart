import { useEffect } from 'react'

interface Props {
  probeNum: 1 | 2 | null
  onDismiss: () => void
}

function playBeeps() {
  try {
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
    ctx.resume().then(() => {
      beep(ctx.currentTime)
      beep(ctx.currentTime + 0.5)
      beep(ctx.currentTime + 1.0)
    })
  } catch {
    /* audio not available */
  }
}

export default function TempAlert({ probeNum, onDismiss }: Props) {
  useEffect(() => {
    if (!probeNum) return
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🔥 GrillSmart — Ready!', {
          body: `Probe ${probeNum} has reached target temperature.`,
        })
      }
    } catch {
      /* notifications not available */
    }
    playBeeps()
  }, [probeNum])

  if (!probeNum) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '1rem',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        background: '#4caf50',
      }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>✓</div>
        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.1rem' }}>
          Probe {probeNum} is ready!
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Target temperature reached
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: '#fff',
            color: '#4caf50',
            border: 'none',
            padding: '0.7rem 2.5rem',
            borderRadius: '10px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  )
}
