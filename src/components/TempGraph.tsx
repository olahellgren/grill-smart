import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import type { ProbeReading } from '../types'
import type { TempUnit } from '../types'

interface Props {
  readings: ProbeReading[]
  targetTempC: number | null
  unit: TempUnit
  label: string
}

function toDisplay(tempC: number, unit: TempUnit) {
  return unit === 'F' ? Math.round((tempC * 9) / 5 + 32) : Math.round(tempC * 10) / 10
}

function formatElapsed(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TempGraph({ readings, targetTempC, unit, label }: Props) {
  if (readings.length < 2) return null

  const t0 = readings[0].timestamp
  const data = readings.map((r) => ({
    elapsed: Math.round((r.timestamp - t0) / 1000),
    temp: toDisplay(r.tempC, unit),
  }))

  const targetDisplay = targetTempC !== null ? toDisplay(targetTempC, unit) : null
  const temps = data.map((d) => d.temp)
  const lo = Math.min(...temps, targetDisplay ?? Infinity)
  const hi = Math.max(...temps, targetDisplay ?? -Infinity)
  const pad = Math.max((hi - lo) * 0.15, 2)
  const domain: [number, number] = [Math.floor(lo - pad), Math.ceil(hi + pad)]

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '0.75rem', flex: 1 }}>
      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -12 }}>
          <XAxis
            dataKey="elapsed"
            tickFormatter={formatElapsed}
            tick={{ fontSize: 9, fill: 'var(--muted)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 9, fill: 'var(--muted)' }}
            width={34}
            tickFormatter={(v) => `${v}°`}
          />
          {targetDisplay !== null && (
            <ReferenceLine
              y={targetDisplay}
              stroke="var(--green)"
              strokeDasharray="4 2"
              strokeWidth={1.5}
            />
          )}
          <Line
            type="monotone"
            dataKey="temp"
            stroke="var(--accent)"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              padding: '0.2rem 0.5rem',
            }}
            formatter={(v) => [`${v}°${unit}`, 'Temp']}
            labelFormatter={(secs) => formatElapsed(Number(secs))}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
