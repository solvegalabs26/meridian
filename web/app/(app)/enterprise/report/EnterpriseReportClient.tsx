'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Props {
  institutionId: string
  institutionName: string
}

type DriftDirection = 'CRITICAL' | 'ALERT' | 'CAUTION' | 'STABLE'

interface Prediction {
  id: string
  case_id: string
  predicted_direction: DriftDirection
  drift_score: number
  confidence_pct: number
  top_signals: string[]
  recommended_action: string
  sweep_id: string
  enterprise_cases: {
    case_ref: string
    region: string
    fico_band: string
    vehicle_class: string
    loan_status: string
    ltv_ratio: number
    dti_ratio: number
    loan_balance_usd: number
  }
}

interface Sweep {
  id: string
  completed_at: string
  cases_swept: number
  critical_count: number
  alert_count: number
  caution_count: number
  stable_count: number
  signals_used: number
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
  return new Date(iso).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function fmtUSD(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const RISK_FLAGS: Record<string, (p: Prediction) => boolean> = {
  'Collateral Risk': p => (p.enterprise_cases?.ltv_ratio ?? 0) > 1.1,
  'Income Stress':   p => (p.enterprise_cases?.dti_ratio ?? 0) > 0.40,
  'DPD Active':      p => ['30dpd','60dpd','90dpd'].includes(p.enterprise_cases?.loan_status ?? ''),
}

export default function EnterpriseReportClient({ institutionId, institutionName }: Props) {
  const supabase = createClient()
  const [sweep, setSweep] = useState<Sweep | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [stableCases, setStableCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
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
          .select('*, enterprise_cases(case_ref, region, fico_band, vehicle_class, loan_status, ltv_ratio, dti_ratio, loan_balance_usd)')
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
    } finally {
      setLoading(false)
    }
  }, [institutionId, supabase])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/enterprise" className="text-xs text-gray-500 hover:text-gray-300 transition">
              ← Enterprise Portal
            </Link>
          </div>
          <h1 className="text-xl font-bold text-white">Sweep Intelligence Report</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {institutionName} · FF-016 Inference Engine Output
            {sweep && ` · ${fmtDate(sweep.completed_at)}`}
          </p>
        </div>
        {sweep && (
          <div className="text-right text-xs text-gray-500 space-y-0.5">
            <div>{sweep.cases_swept} cases swept</div>
            <div>{sweep.signals_used} signals fused</div>
          </div>
        )}
      </div>

      {/* SUMMARY BAR */}
      {sweep && (
        <div className="flex gap-2">
          {(['CRITICAL','ALERT','CAUTION','STABLE'] as DriftDirection[]).map(d => {
            const count = sweep[`${d.toLowerCase()}_count` as keyof Sweep] as number
            return (
              <div key={d} className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                style={{ background: DRIFT_BG[d], borderColor: DRIFT_COLORS[d] + '44' }}>
                <span className="text-xl font-black" style={{ color: DRIFT_COLORS[d] }}>{count}</span>
                <span className="text-xs font-bold" style={{ color: DRIFT_COLORS[d] }}>{d}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* CASE CARDS */}
      <div className="space-y-4">
        {predictions.map(p => {
          const c = p.enterprise_cases
          const color = DRIFT_COLORS[p.predicted_direction]
          const bg = DRIFT_BG[p.predicted_direction]
          const activeFlags = Object.entries(RISK_FLAGS).filter(([, fn]) => fn(p)).map(([label]) => label)

          return (
            <div key={p.id} className="rounded-xl border overflow-hidden"
              style={{ borderColor: color + '44', background: 'rgba(17,24,39,.8)' }}>

              {/* Case header */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: bg }}>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-bold text-white text-lg">{c?.case_ref}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c?.loan_status?.toUpperCase()} · {c?.region} · {c?.vehicle_class}
                    </div>
                  </div>
                  {activeFlags.map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded border font-semibold"
                      style={{ borderColor: color + '66', color, background: color + '15' }}>
                      {f} ▲
                    </span>
                  ))}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black" style={{ color }}>{p.drift_score}<span className="text-sm font-normal text-gray-500"> / 100</span></span>
                    <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ background: color, color: '#fff' }}>
                      {p.predicted_direction}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{p.confidence_pct}% confidence</div>
                </div>
              </div>

              {/* Case body */}
              <div className="px-5 py-4 grid grid-cols-3 gap-6">
                {/* Profile */}
                <div>
                  <div className="text-xs font-bold text-gray-500 tracking-wider mb-2">PROFILE</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">FICO Band</span>
                      <span className="text-gray-200 font-medium">{c?.fico_band}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">LTV Ratio</span>
                      <span className={`font-medium ${(c?.ltv_ratio ?? 0) > 1.1 ? 'text-red-400' : 'text-gray-200'}`}>
                        {c?.ltv_ratio ? `${Math.round(c.ltv_ratio * 100)}%` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">DTI Ratio</span>
                      <span className={`font-medium ${(c?.dti_ratio ?? 0) > 0.40 ? 'text-orange-400' : 'text-gray-200'}`}>
                        {c?.dti_ratio ? `${Math.round(c.dti_ratio * 100)}%` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Balance</span>
                      <span className="text-gray-200 font-medium">{fmtUSD(c?.loan_balance_usd)}</span>
                    </div>
                  </div>
                </div>

                {/* Top signals */}
                <div>
                  <div className="text-xs font-bold text-gray-500 tracking-wider mb-2">TOP SIGNALS (FUSION)</div>
                  <div className="space-y-1.5">
                    {(p.top_signals ?? []).slice(0, 4).map((sig, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: color }} />
                        <div className="text-xs text-gray-400">{sig}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended action */}
                <div>
                  <div className="text-xs font-bold text-gray-500 tracking-wider mb-2">RECOMMENDED ACTION</div>
                  <p className="text-xs text-gray-300 leading-relaxed">{p.recommended_action}</p>
                </div>
              </div>
            </div>
          )
        })}

        {/* Stable cases */}
        {stableCases.length > 0 && (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3 bg-gray-900 border-b border-gray-800">
              <div className="font-semibold text-sm text-white">
                Stable Accounts ({stableCases.length})
              </div>
              <div className="text-xs text-gray-500 mt-0.5">No stress signals detected — re-sweep in 30 days</div>
            </div>
            <div className="divide-y divide-gray-800/50">
              {stableCases.map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <span className="font-semibold text-gray-200 text-sm">{c.case_ref}</span>
                    <span className="text-xs text-gray-500 ml-3">{c.region} · {c.vehicle_class} · FICO {c.fico_band}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-900/30 text-emerald-400">STABLE</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
