'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface ConfidenceMeterProps {
  score: number
  prev?: number
  history?: number[]
  size?: 'sm' | 'md' | 'lg'
}

function getColor(score: number): string {
  if (score <= 40) return '#A32D2D'
  if (score <= 65) return '#BA7517'
  if (score <= 84) return '#2E7CB8'
  return '#0F6E56'
}

function getLabel(score: number): string {
  if (score <= 40) return 'Low'
  if (score <= 65) return 'Moderate'
  if (score <= 84) return 'Good'
  return 'Strong'
}

export default function ConfidenceMeter({ score, prev, history, size = 'md' }: ConfidenceMeterProps) {
  const color = getColor(score)
  const delta = prev !== undefined ? score - prev : null
  const chartData = history?.map((v) => ({ v })) ?? []

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[13px] font-semibold" style={{ color }}>
          {score}%
        </span>
      </div>
    )
  }

  if (size === 'md') {
    return (
      <div className="flex items-center gap-2.5">
        <span className="text-[14px] font-semibold" style={{ color }}>{score}%</span>
        <div className="flex-1 h-1.5 rounded-full bg-[var(--gray-lt)] overflow-hidden" style={{ minWidth: 60 }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
        {delta !== null && (
          <span className="text-[11px] font-medium" style={{ color: delta >= 0 ? '#0F6E56' : '#A32D2D' }}>
            {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}
          </span>
        )}
      </div>
    )
  }

  // lg
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <span className="text-[48px] font-light leading-none" style={{ color }}>
          {score}
          <span className="text-[24px]">%</span>
        </span>
        <div className="pb-2 flex flex-col items-start gap-0.5">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color, backgroundColor: `${color}18` }}
          >
            {getLabel(score)}
          </span>
          {delta !== null && (
            <span
              className="text-[13px] font-medium"
              style={{ color: delta >= 0 ? '#0F6E56' : '#A32D2D' }}
            >
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} pts vs last sweep
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[var(--gray-lt)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>

      {/* Sparkline */}
      {chartData.length > 1 && (
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
