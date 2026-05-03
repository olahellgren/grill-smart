import type { ConnectionStatus } from '../ble/useGrillDevice'

interface Props {
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
  error: string | null
}

export default function ConnectButton({ status, onConnect, onDisconnect, error }: Props) {
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <button
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isConnecting}
        style={{
          padding: '0.75rem 1.5rem',
          background: isConnected ? 'var(--red)' : 'var(--accent)',
          color: '#fff', border: 'none', borderRadius: '8px',
          fontSize: '1rem', cursor: isConnecting ? 'wait' : 'pointer',
          opacity: isConnecting ? 0.7 : 1,
        }}
      >
        {isConnecting ? 'Connecting…' : isConnected ? 'Disconnect' : 'Connect to Grill'}
      </button>
      {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem' }}>{error}</p>}
    </div>
  )
}
