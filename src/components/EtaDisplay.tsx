interface Props {
  etaSecs: number | null
}

export default function EtaDisplay({ etaSecs }: Props) {
  if (etaSecs === null) return (
    <div style={{ color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center' }}>
      ETA: calculating…
    </div>
  )
  if (etaSecs === 0) return (
    <div style={{ color: 'var(--green)', fontWeight: 'bold', textAlign: 'center', fontSize: '1.1rem' }}>
      ✓ Target reached!
    </div>
  )
  const mins = Math.ceil(etaSecs / 60)
  return (
    <div style={{ textAlign: 'center' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>ETA </span>
      <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>~{mins} min</span>
    </div>
  )
}
