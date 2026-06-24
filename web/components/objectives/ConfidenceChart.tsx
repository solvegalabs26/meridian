'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface ConfidenceChartProps {
  scores: { score: number; created_at: string }[]
}

function getColor(score: number): string {
  if (score <= 40) return '#A32D2D'
  if (score <= 65) return '#BA7517'
  if (score <= 84) return '#2E7CB8'
  return '#0F6E56'
}

export default function ConfidenceChart({ scores }: ConfidenceChartProps) {
  if (scores.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-[12px] text-[var(--text3)]">
        Run more sweeps to see the confidence trajectory.
      </div>
    )
  }

  const data = scores.map(s => ({
    date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: s.score,
  }))

  const latest = scores[scores.length - 1]?.score ?? 50
  const color = getColor(latest)

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8098B4' }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#8098B4' }} tickLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, border: '1px solid #E2E0DA', borderRadius: 8 }}
          formatter={(v) => [`${v}%`, 'Confidence']}
        />
        <ReferenceLine y={50} stroke="#E2E0DA" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="score"
          stroke={color}
          strokeWidth={2.5}
          dot={{ fill: color, strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
