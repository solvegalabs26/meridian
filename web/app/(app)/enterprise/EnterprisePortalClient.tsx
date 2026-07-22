'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const OBJECTIVE_ID = 'b2c3d4e5-0000-0000-0000-000000000001'

interface Props {
  institutionId: string
  institutionName: string
}

type DriftDirection = 'CRITICAL' | 'ALERT' | 'CAUTION' | 'STABLE'

interface Sweep {
  id: string
  status: string
  trigger_type: string
  cases_swept: number
  critical_count: number
  alert_count: number
  caution_count: number
  stable_count: number
  signals_used: number
  patterns_matched: number
  completed_at: string
  started_at: string
}

interface Prediction {
  id: string
  case_id: string
  predicted_direction: DriftDirection
  drift_score: number
  confidence_pct: number
  top_signals: string[]
  recommended_action: string
  enterprise_cases: {
    case_ref: string
    region: string
    fico_band: string
    vehicle_class: string
    loan_status: string
  }
}

interface Signal {
  signal_id: string
  source: string
  direction_score: number
  direction: string
  magnitude: string
  event_text: string
  effective_date: string
}

const DRIFT_COLORS: Record<DriftDirection, string> = {
  CRITICAL: '#ef4444',
  ALERT:    '#f97316',
  CAUTION:  '#f59e0b',
  STABLE:   '#10b981',
}

const DRIFT_BG: Record<DriftDirection, string> = {
  CRITICAL: 'rgba(239,68,68,.15)',
  ALERT:    'rgba(249,115,22,.15)',
  CAUTION:  'rgba(245,158,11,.15)',
  STABLE:   'rgba(16,185,129,.12)',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// SVG line chart for portfolio drift trend
function TrendChart({ sweeps }: { sweeps: Sweep[] }) {
  if (sweeps.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm gap-2">
        <div className="text-2xl">📈</div>
        <div>Trend data accumulates after 4+ weekly sweeps</div>
        <div className="text-xs text-gray-700">Chart will populate automatically each Monday</div>
      </div>
    )
  }

  const W = 560, H = 130, PL = 28, PR = 12, PT = 8, PB = 20
  const IW = W - PL - PR, IH = H - PT - PB
  const maxTotal = Math.max(...sweeps.map(s => s.cases_swept || 5), 1)

  const xScale = (i: number) => PL + (i / (sweeps.length - 1)) * IW
  const yScale = (v: number) => PT + IH - (v / maxTotal) * IH

  const series: Array<{ key: keyof Sweep; color: string; label: string }> = [
    { key: 'critical_count', color: '#ef4444', label: 'Critical' },
    { key: 'alert_count',    color: '#f97316', label: 'Alert' },
    { key: 'caution_count',  color: '#f59e0b', label: 'Caution' },
    { key: 'stable_count',   color: '#10b981', label: 'Stable' },
  ]

  const makePath = (key: keyof Sweep) =>
    sweeps.map((s, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(s[key] as number).toFixed(1)}`).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150 }}>
        {[0, 0.33, 0.67, 1].map(p => (
          <line key={p} x1={PL} x2={W - PR} y1={yScale(maxTotal * p)} y2={yScale(maxTotal * p)}
            stroke="#1f2937" strokeWidth="1" />
        ))}
        {series.map(s => (
          <path key={s.key} d={makePath(s.key)} fill="none" stroke={s.color} strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map(s => sweeps.map((sw, i) => (
          <circle key={`${s.key}-${i}`} cx={xScale(i)} cy={yScale(sw[s.key] as number)} r="3.5"
            fill={s.color} stroke="#111827" strokeWidth="1.5" />
        )))}
        {sweeps.map((s, i) => (
          <text key={i} x={xScale(i)} y={H - 3} textAnchor="middle" fontSize="9" fill="#4b5563">
            {fmtShort(s.completed_at)}
          </text>
        ))}
      </svg>
      <div className="flex gap-4 mt-1 flex-wrap">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded-full" style={{ background: s.color }} />
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Portfolio composition donut
function CompositionRing({ sweep }: { sweep: Sweep }) {
  const total = sweep.cases_swept || (sweep.critical_count + sweep.alert_count + sweep.caution_count + sweep.stable_count) || 0
  if (!total) return <div className="text-gray-600 text-sm">No data</div>

  const segments = [
    { count: sweep.critical_count, color: '#ef4444', label: 'Critical' },
    { count: sweep.alert_count,    color: '#f97316', label: 'Alert' },
    { count: sweep.caution_count,  color: '#f59e0b', label: 'Caution' },
    { count: sweep.stable_count,   color: '#10b981', label: 'Stable' },
  ]

  const R = 44, CX = 58, CY = 58, SW = 16
  const circ = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 116 116" style={{ width: 116, height: 116, flexShrink: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1f2937" strokeWidth={SW} />
        {segments.map((seg, i) => {
          const dash = (seg.count / total) * circ
          const el = (
            <circle key={i} cx={CX} cy={CY} r={R} fill="none"
              stroke={seg.color} strokeWidth={SW}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          )
          offset += dash
          return el
        })}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="22" fontWeight="800" fill="white">{total}</text>
        <text x={CX} y={CY + 11} textAnchor="middle" fontSize="8" fill="#6b7280" letterSpacing="1">CASES</text>
      </svg>
      <div className="space-y-2.5 flex-1">
        {segments.map(seg => (
          <div key={seg.label}>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: seg.color }} className="font-semibold">{seg.label}</span>
              <span className="text-gray-400 font-mono">{seg.count} · {total > 0 ? Math.round(seg.count / total * 100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(seg.count / total) * 100}%`, background: seg.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Parse signal into label / value / delta (matches HTML fusion card format)
function parseSignalDisplay(s: Signal): { label: string; value: string; delta: string; isNeg: boolean } {
  const text = s.event_text || ''
  const colon = text.indexOf(':')
  let label = colon > -1 ? text.slice(0, colon).trim() : s.signal_id.replace(/^(FRED|EIA|BLS|GDELT):/, '').replace(/_/g, ' ')
  const rest = colon > -1 ? text.slice(colon + 1).trim() : text
  if (label.length > 42) label = label.slice(0, 40) + '…'
  const parenMatch = rest.match(/^(.+?)\s*\((.+)\)/)
  const value = parenMatch ? parenMatch[1].trim() : rest.slice(0, 22)
  const delta = parenMatch ? parenMatch[2].trim() : s.magnitude || ''
  const isNeg = s.direction_score < 0
  const arrow = isNeg ? '▼' : s.direction_score > 0 ? '▲' : '→'
  return { label, value, delta: delta ? `${arrow} ${delta}` : `${arrow} Score: ${s.direction_score}`, isNeg }
}

// Fusion signal card — matches HTML light-blue style
function FusionCard({ signal }: { signal: Signal }) {
  const { label, value, delta, isNeg } = parseSignalDisplay(signal)
  return (
    <div style={{ background: '#EAF0FB', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#2D6BE4', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1A1A2E', fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 10, marginTop: 3, color: isNeg ? '#D35400' : '#1E8449' }}>{delta}</div>
    </div>
  )
}

export default function EnterprisePortalClient({ institutionId, institutionName }: Props) {
  const supabase = createClient()
  const [sweep, setSweep] = useState<Sweep | null>(null)
  const [sweepHistory, setSweepHistory] = useState<Sweep[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [keySignals, setKeySignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [sweeping, setSweeping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<number>(30)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Latest complete sweep
      const { data: sweeps } = await supabase
        .from('enterprise_sweeps')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('status', 'complete')
        .order('completed_at', { ascending: false })
        .limit(1)
      const latestSweep = sweeps?.[0] ?? null
      setSweep(latestSweep)

      // Trend history (up to 13 sweeps = ~quarter)
      const { data: hist } = await supabase
        .from('enterprise_sweeps')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('status', 'complete')
        .order('completed_at', { ascending: false })
        .limit(13)
      setSweepHistory([...(hist ?? [])].reverse())

      // Predictions for regional movers
      if (latestSweep) {
        const { data: preds } = await supabase
          .from('enterprise_predictions')
          .select('*, enterprise_cases(case_ref, region, fico_band, vehicle_class, loan_status)')
          .eq('institution_id', institutionId)
          .eq('sweep_id', latestSweep.id)
          .order('drift_score', { ascending: false })
        setPredictions((preds ?? []) as Prediction[])
      }

      // Key fusion signals: diverse sources, most negative first
      const since = new Date()
      since.setDate(since.getDate() - 60)
      const { data: sigs } = await supabase
        .from('market_signals')
        .select('signal_id, source, direction_score, direction, magnitude, event_text, effective_date')
        .gte('effective_date', since.toISOString().split('T')[0])
        .order('direction_score', { ascending: true })
        .limit(200)

      const seen = new Map<string, Signal>()
      for (const s of (sigs ?? [])) {
        if (!seen.has(s.signal_id)) seen.set(s.signal_id, s)
      }

      // Pick top 6 with source diversity
      const all = Array.from(seen.values()).sort((a, b) => a.direction_score - b.direction_score)
      const sourceSeen = new Set<string>()
      const top6: Signal[] = []
      for (const s of all) {
        if (top6.length >= 6) break
        if (!sourceSeen.has(s.source)) { top6.push(s); sourceSeen.add(s.source) }
      }
      for (const s of all) {
        if (top6.length >= 6) break
        if (!top6.includes(s)) top6.push(s)
      }
      setKeySignals(top6)

    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [institutionId, supabase])

  useEffect(() => { loadAll() }, [loadAll])

  const runSweep = async () => {
    setSweeping(true)
    setError(null)
    try {
      const res = await fetch('/api/enterprise/trigger-sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution_id: institutionId, objective_id: OBJECTIVE_ID }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sweep failed')
      await loadAll()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSweeping(false)
    }
  }

  // Regional movers: group predictions by region, rank by avg drift score
  const regionalData = (() => {
    const dirOrder: Record<DriftDirection, number> = { CRITICAL: 4, ALERT: 3, CAUTION: 2, STABLE: 1 }
    const map = new Map<string, { count: number; totalScore: number; worst: DriftDirection }>()
    for (const p of predictions) {
      const region = p.enterprise_cases?.region ?? 'Unknown'
      const cur = map.get(region) ?? { count: 0, totalScore: 0, worst: 'STABLE' as DriftDirection }
      map.set(region, {
        count: cur.count + 1,
        totalScore: cur.totalScore + p.drift_score,
        worst: dirOrder[p.predicted_direction] > dirOrder[cur.worst] ? p.predicted_direction : cur.worst,
      })
    }
    return Array.from(map.entries())
      .map(([region, d]) => ({ region, ...d, avgScore: Math.round(d.totalScore / d.count) }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)
  })()

  // Meridian Fusion Insight — auto-generated narrative from signals + sweep
  const fusionInsight = (() => {
    if (!sweep || keySignals.length === 0) return null
    const neg = keySignals.filter(s => s.direction_score < 0)
    const top = neg[0]
    const { critical_count: crit, caution_count: caut, cases_swept } = sweep

    if (crit > 0 && top) {
      return `FF-016 has flagged ${crit} account${crit > 1 ? 's' : ''} for immediate loss mitigation attention. External signal fusion — led by "${top.event_text || top.signal_id}" — is amplifying portfolio stress across ${regionalData.length} region${regionalData.length !== 1 ? 's' : ''}. ${caut > 0 ? `${caut} additional account${caut > 1 ? 's' : ''} show early drift signals.` : ''} Market conditions in the current signal window are not favorable — proactive outreach on flagged accounts is recommended before the next scheduled sweep.`
    }
    if (caut > 0 && top) {
      return `Portfolio shows early stress signals in ${caut} account${caut > 1 ? 's' : ''}. No accounts have crossed into loss-mitigation territory, but "${top.event_text || top.signal_id}" is creating headwinds in ${regionalData[0]?.region ?? 'key regions'}. Meridian recommends monitoring flagged accounts weekly and reviewing relationship touchpoints.`
    }
    return `Portfolio is holding stable. ${cases_swept} accounts swept — all within normal drift thresholds. The fusion engine is actively monitoring ${keySignals.length} live market streams. No immediate action required.`
  })()

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading intelligence portal...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{institutionName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            FF-016 Enterprise Intelligence Portal
            {sweep && ` · Last sweep ${fmtDate(sweep.completed_at)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadAll}
            className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 transition">
            Refresh
          </button>
          <button onClick={runSweep} disabled={sweeping}
            className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 transition">
            {sweeping ? 'Running Sweep...' : 'Run Sweep Now'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {/* RISK SUMMARY CARDS */}
      {sweep && (
        <div className="grid grid-cols-4 gap-3">
          {(['CRITICAL','ALERT','CAUTION','STABLE'] as DriftDirection[]).map(d => {
            const count = sweep[`${d.toLowerCase()}_count` as keyof Sweep] as number
            const subtitles = {
              CRITICAL: 'Loss mitigation now',
              ALERT: 'Outreach within 72hrs',
              CAUTION: 'Monitor weekly',
              STABLE: 'No action needed',
            }
            return (
              <div key={d} style={{ background: DRIFT_BG[d], borderColor: DRIFT_COLORS[d] + '55' }}
                className="rounded-xl border p-5 text-center">
                <div className="text-5xl font-black leading-none" style={{ color: DRIFT_COLORS[d] }}>{count}</div>
                <div className="text-xs font-bold tracking-widest mt-2" style={{ color: DRIFT_COLORS[d] }}>{d}</div>
                <div className="text-xs text-gray-500 mt-1">{subtitles[d]}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* TREND CHART + COMPOSITION RING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-sm text-white">Portfolio Drift — 90-Day Trend</div>
              <div className="text-xs text-gray-500 mt-0.5">Account risk tier movement across sweep history</div>
            </div>
            <div className="text-xs text-gray-600 font-mono">{sweepHistory.length} sweep{sweepHistory.length !== 1 ? 's' : ''}</div>
          </div>
          <TrendChart sweeps={sweepHistory} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="font-semibold text-sm text-white mb-1">Portfolio Composition</div>
          <div className="text-xs text-gray-500 mb-4">Current risk tier breakdown</div>
          {sweep
            ? <CompositionRing sweep={sweep} />
            : <div className="text-gray-600 text-sm text-center py-8">Run a sweep to see composition</div>}
        </div>
      </div>

      {/* REGIONAL MOVERS + LIVE FUSION DATA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Regional Movers */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm text-white">Regional Risk Movers</div>
              <div className="text-xs text-gray-500 mt-0.5">Ranked by average drift score</div>
            </div>
            <select value={timeRange} onChange={e => setTimeRange(Number(e.target.value))}
              className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 outline-none">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={45}>Last 45 days</option>
              <option value={60}>Last 60 days</option>
            </select>
          </div>
          <div className="divide-y divide-gray-800/50">
            {regionalData.map((r, i) => (
              <div key={r.region} className="flex items-center gap-4 px-4 py-3.5">
                <div className="text-2xl font-black text-gray-800 w-7 text-center">#{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-gray-100 text-sm">{r.region}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: DRIFT_BG[r.worst], color: DRIFT_COLORS[r.worst] }}>
                      {r.worst}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${r.avgScore}%`, background: DRIFT_COLORS[r.worst] }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums" style={{ color: DRIFT_COLORS[r.worst] }}>
                      {r.avgScore}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-right">
                  {r.count} case{r.count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
            {regionalData.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-600 text-sm">
                Regional data appears after your first sweep
              </div>
            )}
          </div>
        </div>

        {/* Live Fusion Data */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #DDE3EE' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #DDE3EE' }}>
            <div className="font-semibold text-sm" style={{ color: '#1B2A4A' }}>Live Fusion Data</div>
            <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              {keySignals.length} active signal stream{keySignals.length !== 1 ? 's' : ''} · FRED · EIA · BLS · GDELT
            </div>
          </div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {keySignals.map(s => <FusionCard key={s.signal_id} signal={s} />)}
            {keySignals.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: '24px 0', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
                Signals ingest weekly — check back Monday
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MERIDIAN FUSION INSIGHT */}
      {fusionInsight && (
        <div className="rounded-xl border border-blue-800/40 p-5"
          style={{ background: 'linear-gradient(135deg, rgba(30,58,138,.2) 0%, rgba(15,23,42,.4) 100%)' }}>
          <div className="flex items-start gap-4">
            <div className="text-blue-400 text-xl mt-0.5 flex-shrink-0">◈</div>
            <div>
              <div className="text-xs font-bold text-blue-400 tracking-widest mb-2">MERIDIAN FUSION INSIGHT</div>
              <p className="text-sm text-blue-900 leading-relaxed">{fusionInsight}</p>
            </div>
          </div>
        </div>
      )}

      {/* LINK TO SWEEP REPORT */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
        <div>
          <div className="font-semibold text-sm text-white">Sweep Intelligence Report</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Per-case risk flags · Fusion signal breakdown · Recommended actions
          </div>
        </div>
        <a href="/enterprise/report"
          className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
          View Full Report →
        </a>
      </div>

    </div>
  )
}
