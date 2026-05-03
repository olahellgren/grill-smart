import { useState } from 'react'

export default function InfoButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title="About"
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          color: 'var(--muted)',
          borderRadius: '50%',
          width: '28px',
          height: '28px',
          cursor: 'pointer',
          fontSize: '0.85rem',
          flexShrink: 0,
        }}
      >
        ℹ
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '340px',
              width: '90%',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', color: 'var(--accent)' }}>
              🔥 GrillSmart Thermometer
            </h2>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Unofficial companion app for the{' '}
              <strong>Claes Ohlson Bluetooth Meat Thermometer</strong>.
            </p>
            <table
              style={{
                fontSize: '0.85rem',
                borderCollapse: 'collapse',
                width: '100%',
                marginBottom: '0.75rem',
              }}
            >
              {[
                ['Article', '44-1794'],
                ['Model', 'A550'],
                ['Connection', 'Bluetooth LE'],
                ['Probes', 'Up to 2'],
                ['App', 'Chrome on Windows / Android'],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td
                    style={{
                      color: 'var(--muted)',
                      padding: '0.2rem 0.75rem 0.2rem 0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {k}
                  </td>
                  <td style={{ color: 'var(--text)' }}>{v}</td>
                </tr>
              ))}
            </table>
            <p
              style={{
                margin: '0 0 1rem',
                fontSize: '0.8rem',
                color: 'var(--muted)',
                lineHeight: 1.4,
              }}
            >
              The original GrillSmart app was discontinued. This app reverse-engineered the BLE
              protocol to bring it back.
            </p>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: '100%',
                padding: '0.6rem',
                background: 'var(--border)',
                color: 'var(--text)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
