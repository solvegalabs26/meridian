'use client'

import { useState } from 'react'
import type { PortfolioMetricsData } from '@/lib/enterprise/objectives-queries'

type Props = {
  data: PortfolioMetricsData
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// Inline SVG bar sparkline — 40px tall, full width
function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return <div className="h-10 flex items-center justify-center text-gray-700 text-xs">—</div>

  const W = 80, H = 40, gap = 2
  const barW = Math.max(4, Math.floor((W - (values.length - 1) * gap) / values.length))
  const max = Math.max(...values, 0.01)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ flexShrink: 0 }}>
      {values.map((v, i) => {
        const barH = Math.max(2, (v / max) * H)
        const x = i * (barW + gap)
        const y = H - barH
        const isLast = i === values.length - 1
        return (
          <rect key={i} x={x} y={y} width={barW} height={barH}
            fill={isLast ? '#C9A227' : '#5a3e00'} rx="1" />
        )
      })}
    </svg>
  )
}

type ThresholdLevel = 'green' | 'amber' | 'red' | 'neutral'

function thresholdDot(level: ThresholdLevel) {
  const colors: Record<ThresholdLevel, string> = {
    green: 'bg-green-400',
    amber: 'bg-amber-400',
    red: 'bg-red-500',
    neutral: 'bg-gray-600',
  }
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[level]}`} />
}

interface MetricCardProps {
  label: string
  value: string | null
  suffix?: string
  sparkValues: number[]
  level: ThresholdLevel
  note?: string
}

function MetricCard({ label, value, suffix, sparkValues, level, note }: MetricCardProps) {
  const isPending = value === null

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-400 mb-1">{label}</div>
          {isPending ? (
            <div className="text-2xl font-black text-gray-600">—</div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">{value}</span>
              {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
            </div>
          )}
          {note && <div className="text-[10px] text-gray-600 mt-1 leading-tight">{note}</div>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {thresholdDot(level)}
          <Sparkline values={sparkValues} />
        </div>
      </div>
    </div>
  )
}

// Collapsible section wrapper
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/30 transition"
      >
        <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">{title}</span>
        <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// Drift section — 30 / 90 / 180 day comparison
function DriftSection({ history }: { history: PortfolioMetricsData['driftHistory'] }) {
  const [window, setWindow] = useState<30 | 90 | 180>(30)

  if (history.length < 2) {
    return (
      <div className="py-3 text-center text-gray-600 text-xs">
        Baseline established — drift visible after next sweep
      </div>
    )
  }

  const now = new Date(history[history.length - 1].computedAt).getTime()
  const targetMs = window * 86400000
  const baseline = history.reduce((best, r) => {
    const diff = Math.abs(now - new Date(r.computedAt).getTime() - targetMs)
    const bestDiff = Math.abs(now - new Date(best.computedAt).getTime() - targetMs)
    return diff < bestDiff ? r : best
  }, history[0])

  const current = history[history.length - 1]

  const rows = [
    { label: 'Health Score', curr: current.healthScore, base: baseline.healthScore, fmt: (v: number) => String(Math.round(v)), higher: true },
    { label: 'Delinquency Rate', curr: current.delinquencyRate, base: baseline.delinquencyRate, fmt: (v: number) => `${v.toFixed(1)}%`, higher: false },
    { label: 'Critical Accounts', curr: current.criticalCount, base: baseline.criticalCount, fmt: (v: number) => String(v), higher: false },
  ]

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {([30, 90, 180] as const).map(w => (
          <button key={w} onClick={() => setWindow(w)}
            className={`text-xs px-2 py-1 rounded transition ${window === w ? 'bg-blue-900/60 text-blue-300 font-semibold' : 'text-gray-600 hover:text-gray-400'}`}>
            {w}d
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map(r => {
          const delta = r.curr - r.base
          const improved = r.higher ? delta > 0 : delta < 0
          const worsened = r.higher ? delta < 0 : delta > 0
          const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '→'
          const color = delta === 0 ? 'text-gray-500' : improved ? 'text-green-400' : worsened ? 'text-red-400' : 'text-gray-500'
          return (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{r.label}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">{r.fmt(r.base)} → {r.fmt(r.curr)}</span>
                <span className={`font-semibold ${color}`}>
                  {arrow} {Math.abs(delta) < 0.05 ? '—' : (delta > 0 ? '+' : '') + (typeof r.curr === 'number' && r.curr % 1 !== 0 ? delta.toFixed(1) : Math.round(delta))}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Quarterly performance section
function QuarterlySection({ history }: { history: PortfolioMetricsData['driftHistory'] }) {
  const currentYear = new Date().getFullYear()
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']

  const byQuarter = new Map<string, number[]>()
  for (const r of history) {
    const d = new Date(r.computedAt)
    if (d.getFullYear() !== currentYear) continue
    const q = `Q${Math.floor(d.getMonth() / 3) + 1}`
    const existing = byQuarter.get(q) ?? []
    existing.push(r.delinquencyRate)
    byQuarter.set(q, existing)
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {quarters.map(q => {
        const values = byQuarter.get(q)
        const avg = values ? values.reduce((s, v) => s + v, 0) / values.length : null
        const color = avg === null ? 'bg-gray-800/60 text-gray-600'
          : avg >= 25 ? 'bg-red-900/30 text-red-400'
          : avg >= 15 ? 'bg-amber-900/30 text-amber-400'
          : 'bg-green-900/20 text-green-400'
        return (
          <div key={q} className={`rounded-lg p-3 text-center ${color}`}>
            <div className="text-xs font-bold mb-1">{q}</div>
            {avg !== null
              ? <div className="text-sm font-bold">{avg.toFixed(1)}%</div>
              : <div className="text-xs text-gray-600">No data</div>}
          </div>
        )
      })}
    </div>
  )
}

// Vintage delinquency heatmap
function VintageHeatmap({ data }: { data: PortfolioMetricsData['vintageHeatmap'] }) {
  if (data.length === 0) {
    return <div className="text-center text-gray-600 text-xs py-4">No case origination data available</div>
  }

  const rows = [
    { key: 'current',      label: 'Current',     get: (v: typeof data[0]) => v.current },
    { key: 'dpd30',        label: '30 DPD',       get: (v: typeof data[0]) => v.dpd30 },
    { key: 'dpd60',        label: '60 DPD',       get: (v: typeof data[0]) => v.dpd60 },
    { key: 'dpd90',        label: '90 DPD',       get: (v: typeof data[0]) => v.dpd90 },
    { key: 'defaultCount', label: 'Default',      get: (v: typeof data[0]) => v.defaultCount },
    { key: 'chargedOff',   label: 'Charged Off',  get: (v: typeof data[0]) => v.chargedOff },
  ]

  function cellColor(count: number, total: number, isDelinquent: boolean): string {
    if (!isDelinquent || total === 0) return 'bg-gray-800/40 text-gray-600'
    const pct = count / total
    if (pct === 0) return 'bg-gray-800/40 text-gray-600'
    if (pct >= 0.4) return 'bg-red-900/60 text-red-400 font-bold'
    if (pct >= 0.2) return 'bg-amber-900/40 text-amber-400 font-semibold'
    return 'bg-yellow-900/20 text-yellow-600'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse" style={{ minWidth: 320 }}>
        <thead>
          <tr>
            <th className="text-left text-gray-600 font-semibold py-1.5 pr-3 whitespace-nowrap">Status</th>
            {data.map(v => (
              <th key={v.sortKey} className="text-center text-gray-500 font-semibold py-1.5 px-1.5 whitespace-nowrap">
                {v.quarter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <td className="text-gray-500 py-1 pr-3 whitespace-nowrap">{row.label}</td>
              {data.map(v => {
                const count = row.get(v)
                const isDelinquent = row.key !== 'current'
                const cls = cellColor(count, v.total, isDelinquent)
                return (
                  <td key={v.sortKey} className={`text-center py-1 px-1.5 rounded ${cls}`}>
                    {count > 0 ? count : <span className="text-gray-700">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="border-t border-gray-800">
            <td className="text-gray-600 text-[10px] py-1 pr-3">Total</td>
            {data.map(v => (
              <td key={v.sortKey} className="text-center text-gray-600 text-[10px] py-1 px-1.5">{v.total}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function PortfolioMetricsPanel({ data }: Props) {
  const { total, delinquencyRate, repoRate, avgLTV, avgFICO, approvalRate, declineRate,
    computedAt, sparklines, vintageHeatmap, driftHistory } = data

  function delinquencyLevel(): ThresholdLevel {
    if (delinquencyRate >= 25) return 'red'
    if (delinquencyRate >= 15) return 'amber'
    return 'green'
  }

  function ficoLevel(): ThresholdLevel {
    if (avgFICO <= 640) return 'red'
    if (avgFICO <= 660) return 'amber'
    return 'green'
  }

  function repoLevel(): ThresholdLevel {
    if (repoRate >= 10) return 'red'
    if (repoRate >= 5) return 'amber'
    return 'green'
  }

  function ltvLevel(): ThresholdLevel {
    if (avgLTV >= 112) return 'red'
    if (avgLTV >= 105) return 'amber'
    return 'green'
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="font-semibold text-sm text-white">Portfolio Health Metrics</div>
        <div className="text-xs text-gray-500 mt-0.5">
          Based on {total} accounts · Last computed {timeAgo(computedAt)}
        </div>
      </div>

      {/* Six metric cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <MetricCard
          label="Portfolio Delinquency Rate"
          value={delinquencyRate.toFixed(1)}
          suffix="%"
          sparkValues={sparklines.delinquency.map(s => s.value)}
          level={delinquencyLevel()}
        />
        <MetricCard
          label="Average FICO Score"
          value={String(avgFICO)}
          sparkValues={[]}
          level={ficoLevel()}
        />
        <MetricCard
          label="Repo Rate"
          value={repoRate.toFixed(1)}
          suffix="%"
          sparkValues={sparklines.repoRate.map(s => s.value)}
          level={repoLevel()}
        />
        <MetricCard
          label="Average LTV %"
          value={avgLTV.toFixed(1)}
          suffix="%"
          sparkValues={[]}
          level={ltvLevel()}
        />
        <MetricCard
          label="Loan Approval Rate"
          value={approvalRate}
          sparkValues={[]}
          level="neutral"
          note="Available after decline dataset is ingested (E-05)"
        />
        <MetricCard
          label="Loan Decline Rate"
          value={declineRate}
          sparkValues={[]}
          level="neutral"
          note="Available after decline dataset is ingested (E-05)"
        />
      </div>

      {/* Collapsible drift sections */}
      <CollapsibleSection title={`Portfolio Drift — 30 / 90 / 180 Day`}>
        <DriftSection history={driftHistory} />
      </CollapsibleSection>

      <CollapsibleSection title={`Quarterly Performance — ${new Date().getFullYear()}`}>
        <QuarterlySection history={driftHistory} />
      </CollapsibleSection>

      <CollapsibleSection title="Vintage Delinquency Heatmap">
        <div className="mb-2 text-xs text-gray-600">Origination quarter × DPD status. Red = 40%+ delinquent, amber = 20–40%.</div>
        <VintageHeatmap data={vintageHeatmap} />
      </CollapsibleSection>
    </div>
  )
}
