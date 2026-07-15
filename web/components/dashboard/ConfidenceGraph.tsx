'use client'

// FF-016 (future): 7-day Accelerator trial for Explorer users
// When enabled: Explorer users get full multi-line graph for 7 days
// after which the view gates back with an upgrade prompt.
// Gate: profile.ff016_accelerator_trial_expires_at > now()
// DB column needed: ff016_accelerator_trial_expires_at (timestamptz, nullable)
// Upsell trigger: on trial expiry, show in-graph modal with Accelerator pricing.

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getEffectiveTier } from '@/lib/tiers'

const OBJ_COLORS: Record<string, string> = {
  'OBJ-01': '#C9A227',
  'OBJ-06': '#2E7CB8',
  'OBJ-12': '#4CAF82',
  'OBJ-13': '#9B59B6',
  'OBJ-14': '#E07B39',
  'OBJ-17': '#1AB8A0',
}

const FALLBACK_PALETTE = [
  '#C9A227', '#2E7CB8', '#4CAF82', '#9B59B6',
  '#E07B39', '#1AB8A0', '#E74C3C', '#3498DB',
]

function getColor(objId: string, idx: number): string {
  return OBJ_COLORS[objId] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length]
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface EpisodePoint {
  episode_number: number
  confidence_end: number
  created_at: string
  narrative: string | null
}

export interface ObjectiveSeries {
  objectiveId: string
  objId: string
  title: string
  episodes: EpisodePoint[]
}

interface ConfidenceGraphProps {
  series: ObjectiveSeries[]
  tier: string
  accountType: string | null
}

interface TooltipItem {
  dataKey: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: number
  series: ObjectiveSeries[]
}) {
  if (!active || !payload?.length || label == null) return null
  return (
    <div
      style={{
        backgroundColor: '#111d35',
        border: '1px solid rgba(46,124,184,0.25)',
        borderRadius: 10,
        padding: '10px 14px',
        maxWidth: 260,
        fontSize: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <p style={{ color: 'rgba(232,237,245,0.4)', fontSize: 11, marginBottom: 6 }}>
        Sweep {label}
      </p>
      {payload.map(p => {
        const obj = series.find(s => s.objectiveId === p.dataKey)
        const ep = obj?.episodes.find(e => e.episode_number === label)
        if (!ep) return null
        return (
          <div key={p.dataKey} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: p.color,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#E8EDF5', fontWeight: 600 }}>{p.value}%</span>
              <span style={{ color: 'rgba(232,237,245,0.4)', fontSize: 11 }}>
                · {fmtDate(ep.created_at)}
              </span>
            </div>
            {ep.narrative && (
              <p
                style={{
                  color: 'rgba(232,237,245,0.6)',
                  fontSize: 11,
                  marginTop: 3,
                  lineHeight: 1.4,
                  paddingLeft: 13,
                }}
              >
                {ep.narrative.slice(0, 120)}
                {ep.narrative.length > 120 ? '…' : ''}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ConfidenceGraph({ series, tier, accountType }: ConfidenceGraphProps) {
  const effectiveTier = getEffectiveTier({ tier, account_type: accountType })
  const isFullAccess = effectiveTier === 'accelerator' || effectiveTier === 'command'
  const isTrial = effectiveTier === 'trial'

  // Trial: cap to last 3 episodes per objective
  const cappedSeries = useMemo(
    () => isTrial ? series.map(s => ({ ...s, episodes: s.episodes.slice(-3) })) : series,
    [series, isTrial]
  )

  // Explorer/trial: single-objective selector
  const [selectedId, setSelectedId] = useState<string>(cappedSeries[0]?.objectiveId ?? '')
  // Full access: legend toggle
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const totalEpisodes = series.reduce((sum, s) => sum + s.episodes.length, 0)

  if (totalEpisodes === 0) {
    return (
      <p className="text-[13px]" style={{ color: 'var(--ov-text-dim)' }}>
        Run your first sweep to start building your confidence trajectory.
      </p>
    )
  }

  const activeSeries = isFullAccess
    ? cappedSeries.filter(s => !hidden.has(s.objectiveId))
    : cappedSeries.filter(s => s.objectiveId === selectedId)

  // Pivot: one row per unique episode_number across all active series
  const allEpisodeNums = Array.from(new Set(
    activeSeries.flatMap(s => s.episodes.map(e => e.episode_number))
  )).sort((a, b) => a - b)

  const chartData = allEpisodeNums.map(epNum => {
    const point: Record<string, number | null> = { episode_number: epNum }
    for (const s of activeSeries) {
      const ep = s.episodes.find(e => e.episode_number === epNum)
      point[s.objectiveId] = ep?.confidence_end ?? null
    }
    return point
  })

  // Y-axis domain with padding
  const allScores = activeSeries.flatMap(s => s.episodes.map(e => e.confidence_end))
  const yMin = allScores.length ? Math.max(0, Math.min(...allScores) - 10) : 0
  const yMax = allScores.length ? Math.min(100, Math.max(...allScores) + 10) : 100

  function toggleHidden(id: string) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <div>
      {/* Explorer / Trial: objective picker + upsell */}
      {!isFullAccess && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="text-[12px] px-2.5 py-1.5 rounded-lg focus:outline-none"
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              border: '1px solid var(--ov-border-md)',
              color: '#E8EDF5',
            }}
          >
            {cappedSeries.map(s => (
              <option key={s.objectiveId} value={s.objectiveId}>
                {s.title.length > 30 ? s.title.slice(0, 30) + '…' : s.title}
              </option>
            ))}
          </select>
          <p className="text-[11px] leading-snug" style={{ color: 'rgba(232,237,245,0.4)' }}>
            See all your goals move together —{' '}
            <a href="/settings" className="underline" style={{ color: 'var(--gold)' }}>
              upgrade to Accelerator
            </a>
          </p>
        </div>
      )}

      {/* Chart */}
      {activeSeries.length === 0 ? (
        <p className="text-[12px] py-10 text-center" style={{ color: 'var(--ov-text-dim)' }}>
          All objectives hidden — click a chip below to show one.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 6, right: 6, bottom: 4, left: -20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.15)"
              vertical={false}
            />
            <XAxis
              dataKey="episode_number"
              tickFormatter={(v: number) => `Sweep ${v}`}
              tick={{ fill: 'rgba(232,237,245,0.4)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: 'rgba(232,237,245,0.4)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              content={(props) => (
                <CustomTooltip
                  active={props.active}
                  payload={props.payload as unknown as TooltipItem[] | undefined}
                  label={props.label as number | undefined}
                  series={cappedSeries}
                />
              )}
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            />
            {activeSeries.map((s, idx) => {
              const color = getColor(s.objId, idx)
              return (
                <Line
                  key={s.objectiveId}
                  type="monotone"
                  dataKey={s.objectiveId}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: color }}
                  connectNulls={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Legend — full access only */}
      {isFullAccess && cappedSeries.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {cappedSeries.map((s, idx) => {
            const color = getColor(s.objId, idx)
            const isHidden = hidden.has(s.objectiveId)
            return (
              <button
                key={s.objectiveId}
                onClick={() => toggleHidden(s.objectiveId)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-opacity"
                style={{
                  border: `1px solid ${isHidden ? 'rgba(255,255,255,0.12)' : color}`,
                  backgroundColor: isHidden ? 'transparent' : `${color}1a`,
                  color: isHidden ? 'rgba(232,237,245,0.3)' : 'rgba(232,237,245,0.85)',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: isHidden ? 'rgba(255,255,255,0.2)' : color,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {s.title.length > 20 ? s.title.slice(0, 20) + '…' : s.title}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
