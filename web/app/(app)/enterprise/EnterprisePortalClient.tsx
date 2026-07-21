/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

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

interface IngestionLog {
  id: number
  adapter: string
  status: string
  signals_written: number
  signals_skipped: number
  error_message: string | null
  duration_ms: number
  effective_date: string
}

const DRIFT_COLORS: Record<DriftDirection, string> = {
  CRITICAL: '#ef4444',
  ALERT:    '#f97316',
  CAUTION:  '#f59e0b',
  STABLE:   '#10b981',
}

const DRIFT_BG: Record<DriftDirection, string> = {
  CRITICAL: 'rgba(239,68,68,.12)',
  ALERT:    'rgba(249,115,22,.12)',
  CAUTION:  'rgba(245,158,11,.12)',
  STABLE:   'rgba(16,185,129,.1)',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function EnterprisePortalClient({ institutionId, institutionName }: Props) {
  const supabase = createClient()
  const [sweep, setSweep] = useState<Sweep | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [stableCases, setStableCases] = useState<any[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [sweepHistory, setSweepHistory] = useState<Sweep[]>([])
  const [logs, setLogs] = useState<IngestionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [sweeping, setSweeping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: sweeps } = await supabase
        .from('enterprise_sweeps')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('status', 'complete')
        .order('completed_at', { ascending: false })
        .limit(1)
      const latestSweep = sweeps?.[0] ?? null
      setSweep(latestSweep)

      if (latestSweep) {
        const { data: preds } = await supabase
          .from('enterprise_predictions')
          .select('*, enterprise_cases(case_ref, region, fico_band, vehicle_class, loan_status)')
          .eq('institution_id', institutionId)
          .eq('sweep_id', latestSweep.id)
          .order('drift_score', { ascending: false })
        setPredictions((preds ?? []) as Prediction[])

        const { data: allCases } = await supabase
          .from('enterprise_cases')
          .select('*')
          .eq('institution_id', institutionId)
          .eq('in_scope', true)
        const predictedIds = new Set((preds ?? []).map((p: any) => p.case_id))
        setStableCases((allCases ?? []).filter((c: any) => !predictedIds.has(c.id)))
      }

      const since = new Date(); since.setDate(since.getDate() - 60)
      const { data: rawSigs } = await supabase
        .from('market_signals')
        .select('signal_id, source, direction_score, direction, magnitude, event_text, effective_date')
        .gte('effective_date', since.toISOString().split('T')[0])
        .order('effective_date', { ascending: false })
        .limit(300)
      const seen = new Map<string, Signal>()
      for (const s of (rawSigs ?? [])) {
        if (!seen.has(s.signal_id)) seen.set(s.signal_id, s)
      }
      setSignals(Array.from(seen.values()).sort((a, b) => a.direction_score - b.direction_score))

      const { data: hist } = await supabase
        .from('enterprise_sweeps')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .limit(8)
      setSweepHistory((hist ?? []) as Sweep[])

      const { data: ingLog } = await supabase
        .from('signal_ingestion_log')
        .select('*')
        .order('id', { ascending: false })
        .limit(10)
      setLogs((ingLog ?? []) as IngestionLog[])

    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [institutionId, supabase])

  useEffect(() => { loadAll() }, [loadAll])

  const runSweep = async () => {
    setSweeping(true)
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading enterprise portal...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{institutionName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            FF-016 Enterprise Intelligence Portal
            {sweep && ` · Last sweep ${fmtDate(sweep.completed_at)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAll}
            className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 transition"
          >
            Refresh
          </button>
          <button
            onClick={runSweep}
            disabled={sweeping}
            className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 transition"
          >
            {sweeping ? 'Running Sweep...' : 'Run Sweep Now'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* SUMMARY CARDS */}
      {sweep && (
        <div className="grid grid-cols-4 gap-3">
          {(['CRITICAL','ALERT','CAUTION','STABLE'] as DriftDirection[]).map(d => {
            const count = sweep[`${d.toLowerCase()}_count` as keyof Sweep] as number
            const labels = { CRITICAL: 'Loss mitigation now', ALERT: 'Outreach 72hrs', CAUTION: 'Monitor weekly', STABLE: 'No action' }
            return (
              <div
                key={d}
                style={{ background: DRIFT_BG[d], borderColor: DRIFT_COLORS[d] + '44' }}
                className="rounded-xl border p-4 text-center"
              >
                <div className="text-4xl font-black" style={{ color: DRIFT_COLORS[d] }}>{count}</div>
                <div className="text-xs font-bold tracking-wider mt-1" style={{ color: DRIFT_COLORS[d] }}>{d}</div>
                <div className="text-xs text-gray-500 mt-1">{labels[d]}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* CASES + SIGNAL BUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Cases Table */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="font-semibold text-sm text-white">Active Case Predictions</div>
            <div className="text-xs text-gray-500">{predictions.length + stableCases.length} cases</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider bg-gray-800/50">
                  <th className="text-left px-4 py-2">Case</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Score</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Profile</th>
                  <th className="text-left px-4 py-2 hidden lg:table-cell">Top Signal</th>
                  <th className="text-left px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {predictions.map(p => {
                  const c = p.enterprise_cases
                  const color = DRIFT_COLORS[p.predicted_direction]
                  return (
                    <tr key={p.id} className="hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{c?.case_ref}</div>
                        <div className="text-xs text-gray-500">{c?.loan_status?.toUpperCase()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: DRIFT_BG[p.predicted_direction], color }}
                        >
                          {p.predicted_direction}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.drift_score}%`, background: color }} />
                          </div>
                          <span className="font-bold text-xs" style={{ color }}>{p.drift_score}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.confidence_pct}% conf.</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs text-gray-300">{c?.region} · {c?.vehicle_class}</div>
                        <div className="text-xs text-gray-500">FICO {c?.fico_band}</div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-xs text-gray-400 max-w-[180px] truncate" title={p.top_signals?.[0]}>
                          {p.top_signals?.[0] ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-400 max-w-[160px]">{p.recommended_action}</div>
                      </td>
                    </tr>
                  )
                })}
                {stableCases.map(c => (
                  <tr key={c.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{c.case_ref}</div>
                      <div className="text-xs text-gray-500">{c.loan_status?.toUpperCase()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-900/30 text-emerald-400">STABLE</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: '4%' }} />
                        </div>
                        <span className="font-bold text-xs text-emerald-400">&lt;20</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-gray-300">{c.region} · {c.vehicle_class}</div>
                      <div className="text-xs text-gray-500">FICO {c.fico_band}</div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="text-xs text-gray-500">No stress signals</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-500">Re-sweep in 30 days</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signal Bus */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="font-semibold text-sm text-white">Signal Bus</div>
            <div className="text-xs text-gray-500">{signals.length} active</div>
          </div>
          <div className="divide-y divide-gray-800/50 max-h-[480px] overflow-y-auto">
            {signals.map(s => {
              const sc = s.direction_score
              const color = sc <= -2 ? '#ef4444' : sc === -1 ? '#f97316' : sc === 0 ? '#64748b' : '#10b981'
              const label = s.event_text || s.signal_id
              return (
                <div key={s.signal_id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-800/30">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color }} title={label}>{label}</div>
                    <div className="text-xs text-gray-600">{fmtShort(s.effective_date)} · {s.source}</div>
                  </div>
                  <div className="text-xs font-bold flex-shrink-0" style={{ color }}>
                    {sc > 0 ? '+' : ''}{sc}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Sweep History */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="font-semibold text-sm text-white">Sweep History</div>
          </div>
          <div className="divide-y divide-gray-800/50">
            {sweepHistory.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-200">{fmtDate(s.completed_at || s.started_at)}</div>
                  <div className="text-xs text-gray-500">{s.trigger_type} · {s.cases_swept} cases · {s.signals_used} signals</div>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {!!s.critical_count && <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 font-semibold">{s.critical_count}C</span>}
                  {!!s.alert_count    && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-400 font-semibold">{s.alert_count}A</span>}
                  {!!s.caution_count  && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-400 font-semibold">{s.caution_count}W</span>}
                  {!!s.stable_count   && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 font-semibold">{s.stable_count}S</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ingestion Log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="font-semibold text-sm text-white">Signal Ingestion Log</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider bg-gray-800/50">
                <th className="text-left px-4 py-2">Adapter</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Signals</th>
                <th className="text-left px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 font-semibold text-gray-200">{l.adapter}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold ${l.status === 'success' ? 'text-emerald-400' : l.status === 'partial' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{l.signals_written} written</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{l.effective_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
