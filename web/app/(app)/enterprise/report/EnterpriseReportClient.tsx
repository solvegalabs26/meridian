'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatLoanStatus } from '@/lib/enterprise/format-utils'
import { VerticalReportHeader } from '@/components/enterprise/vertical/VerticalReportHeader'
import type { VerticalConfig } from '@/lib/vertical/verticalTypes'

interface Props {
  institutionId: string
  institutionName: string
  highlight?: string | null
  verticalConfig?: VerticalConfig | null
}

type Dir = 'CRITICAL' | 'ALERT' | 'CAUTION' | 'STABLE'

// Raw row from enterprise_cases
interface CaseRow {
  id: string
  case_ref: string
  region: string
  fico_band: string
  vehicle_class: string
  loan_status: string
  ltv_ratio: number
  dti_ratio: number
  current_balance: number
  payments_remaining: number
  loan_data: any
}

// Supplementary fields from enterprise_predictions (optional — not all cases have preds)
interface PredExtra {
  top_signals: string[]
  recommended_action: string
  confidence_pct: number
}

// Merged case: cases + latest history + optional prediction extras
interface EnrichedCase {
  id: string
  case_ref: string
  region: string
  fico_band: string
  vehicle_class: string
  ec_loan_status: string    // raw status from enterprise_cases
  ltv_ratio: number
  dti_ratio: number
  current_balance: number
  payments_remaining: number
  loan_data: any
  drift_tier: Dir           // from enterprise_case_history (latest scored)
  drift_score: number       // from enterprise_case_history
  scored_status: string | null  // ech.loan_status — status AT TIME of scoring
  scored_dpd: number | null
  pred?: PredExtra          // from enterprise_predictions if available
}

const OUTCOME_TOOLTIP: Record<string, string> = {
  CRITICAL: 'High probability of loss event within 90 days based on signal fusion',
  ALERT:    'Elevated probability of delinquency progression within 60 days',
  CAUTION:  'Moderate early drift signals detected; monitoring recommended',
  STABLE:   'No significant risk signals detected in current sweep window',
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

interface Signal {
  signal_id: string
  source: string
  direction_score: number
  event_text: string
  effective_date: string
  magnitude: string
}

// ── Design tokens (matching HTML exactly) ──────────────────────────────────
const C = {
  navy:     '#1B2A4A',
  blue:     '#2D6BE4',
  gold:     '#C8A84B',
  critical: '#C0392B',
  alert:    '#D35400',
  caution:  '#D4AC0D',
  stable:   '#1E8449',
  bg:       '#F0F3F8',
  card:     '#FFFFFF',
  text:     '#1A1A2E',
  muted:    '#6B7280',
  border:   '#DDE3EE',
  lightBlue:'#EAF0FB',
  lightBand:'#2D6BE4',
}

const DIR: Record<Dir, string> = {
  CRITICAL: C.critical, ALERT: C.alert, CAUTION: C.caution, STABLE: C.stable,
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtLTV(r: number | null) { return r ? `${Math.round(r)}%` : '—' }

function parseSignal(s: Signal): { label: string; value: string; delta: string; isNeg: boolean } {
  const text = s.event_text || ''
  const colon = text.indexOf(':')
  let label = colon > -1 ? text.slice(0, colon).trim() : s.signal_id
  const rest  = colon > -1 ? text.slice(colon + 1).trim() : text

  // Shorten very long labels
  if (label.length > 40) label = label.slice(0, 38) + '…'

  const parenMatch = rest.match(/^(.+?)\s*\((.+)\)/)
  const value = parenMatch ? parenMatch[1].trim() : rest.slice(0, 20)
  const delta = parenMatch ? parenMatch[2].trim() : s.magnitude || ''

  const isNeg = s.direction_score < 0
  const arrow = isNeg ? '▼' : s.direction_score > 0 ? '▲' : '→'

  return { label, value, delta: delta ? `${arrow} ${delta}` : `${arrow} Score: ${s.direction_score}`, isNeg }
}

// ── Fusion insight narrative ───────────────────────────────────────────────
function buildInsight(signals: Signal[], sweep: Sweep | null): string {
  if (!sweep || signals.length === 0) return ''
  const top = signals.filter(s => s.direction_score <= -2)[0] || signals[0]
  const parsed = parseSignal(top)
  const crit = sweep.critical_count, alert = sweep.alert_count, caut = sweep.caution_count
  if (crit > 0) {
    return `${parsed.label} is compressing risk across the portfolio simultaneously — a systemic signal that standard payment-history monitoring misses entirely. ${crit} account${crit > 1 ? 's' : ''} require immediate loss-mitigation review. ${alert + caut} additional account${alert + caut !== 1 ? 's' : ''} show early drift signals that warrant monitoring before the next payment cycle.`
  }
  if (caut > 0) {
    return `External signal fusion — led by ${parsed.label} — is creating headwinds across ${caut} account${caut > 1 ? 's' : ''}. No accounts have crossed into loss-mitigation territory, but the signal environment is not improving. Proactive relationship outreach is recommended on flagged accounts.`
  }
  return `Portfolio is holding stable. ${sweep.cases_swept} accounts swept against ${signals.length} live signal streams — all within normal drift thresholds. The fusion engine continues monitoring and will alert on any directional changes.`
}

function caseId(ref: string) {
  return `case-${ref.replace(/[^a-zA-Z0-9]/g, '-')}`
}

export default function EnterpriseReportClient({ institutionId, institutionName, highlight, verticalConfig }: Props) {
  const supabase = createClient()
  const [sweep, setSweep] = useState<Sweep | null>(null)
  const [enrichedCases, setEnrichedCases] = useState<EnrichedCase[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [flashId, setFlashId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const TIER_ORDER: Record<Dir, number> = { CRITICAL: 0, ALERT: 1, CAUTION: 2, STABLE: 3 }
    try {
      // Step 1: Sweep metadata (display only — NOT used for tier counts)
      const { data: sweeps } = await supabase
        .from('enterprise_sweeps').select('*')
        .eq('institution_id', institutionId).eq('status', 'complete')
        .order('completed_at', { ascending: false }).limit(1)
      setSweep(sweeps?.[0] ?? null)

      // Step 2: All in-scope cases from enterprise_cases (PRIMARY source)
      const { data: casesRaw } = await supabase
        .from('enterprise_cases')
        .select('id, case_ref, region, fico_band, vehicle_class, loan_status, ltv_ratio, dti_ratio, current_balance, payments_remaining, loan_data')
        .eq('institution_id', institutionId)
        .eq('in_scope', true)
      const cases = (casesRaw ?? []) as CaseRow[]

      // Step 3: Latest scored history per case
      // Supabase JS doesn't support subqueries, so: fetch all, order DESC, take first per case_id = latest
      const caseIds = cases.map(c => c.id)
      const histMap = new Map<string, { drift_tier: string; drift_score: number; loan_status: string | null; days_past_due: number | null }>()
      if (caseIds.length > 0) {
        const { data: histRaw } = await supabase
          .from('enterprise_case_history')
          .select('case_id, drift_tier, drift_score, loan_status, days_past_due')
          .in('case_id', caseIds)
          .not('drift_tier', 'is', null)
          .order('snapshot_at', { ascending: false })
        for (const row of histRaw ?? []) {
          if (!histMap.has(row.case_id)) histMap.set(row.case_id, row as any)
        }
      }

      // Step 4: Predictions as SUPPLEMENTARY only (top_signals, recommended_action, confidence_pct)
      const predMap = new Map<string, PredExtra>()
      if (sweeps?.[0]) {
        const { data: preds } = await supabase
          .from('enterprise_predictions')
          .select('case_id, top_signals, recommended_action, confidence_pct')
          .eq('institution_id', institutionId)
          .eq('sweep_id', sweeps[0].id)
        for (const p of preds ?? []) predMap.set(p.case_id, p as PredExtra)
      }

      // Step 5: Merge into EnrichedCase[], sorted by tier severity then drift_score DESC
      const enriched: EnrichedCase[] = cases.map(c => {
        const h = histMap.get(c.id)
        return {
          id: c.id,
          case_ref: c.case_ref,
          region: c.region,
          fico_band: c.fico_band,
          vehicle_class: c.vehicle_class,
          ec_loan_status: c.loan_status,
          ltv_ratio: c.ltv_ratio,
          dti_ratio: c.dti_ratio,
          current_balance: c.current_balance,
          payments_remaining: c.payments_remaining,
          loan_data: c.loan_data,
          drift_tier: (h?.drift_tier ?? 'STABLE') as Dir,
          drift_score: h?.drift_score ?? 0,
          scored_status: h?.loan_status ?? null,
          scored_dpd: h?.days_past_due ?? null,
          pred: predMap.get(c.id),
        }
      }).sort((a, b) => {
        const td = TIER_ORDER[a.drift_tier] - TIER_ORDER[b.drift_tier]
        if (td !== 0) return td
        return b.drift_score - a.drift_score
      })
      setEnrichedCases(enriched)

      // Step 6: Market signals (unchanged)
      const since = new Date(); since.setDate(since.getDate() - 60)
      const { data: sigs } = await supabase.from('market_signals')
        .select('signal_id,source,direction_score,event_text,effective_date,magnitude')
        .gte('effective_date', since.toISOString().split('T')[0])
        .order('direction_score', { ascending: true }).limit(200)

      const seen = new Map<string, Signal>()
      for (const sg of (sigs ?? [])) if (!seen.has(sg.signal_id)) seen.set(sg.signal_id, sg)
      const all6: Signal[] = []
      const srcSeen = new Set<string>()
      const sorted = Array.from(seen.values()).sort((a, b) => a.direction_score - b.direction_score)
      for (const sg of sorted) { if (all6.length >= 6) break; if (!srcSeen.has(sg.source)) { all6.push(sg); srcSeen.add(sg.source) } }
      for (const sg of sorted) { if (all6.length >= 6) break; if (!all6.includes(sg)) all6.push(sg) }
      setSignals(all6)
    } finally {
      setLoading(false)
    }
  }, [institutionId, supabase])

  useEffect(() => { loadAll() }, [loadAll])

  // Scroll to and flash highlighted account after data loads
  useEffect(() => {
    if (!highlight || loading) return
    const id = caseId(highlight)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlashId(id)
      setTimeout(() => setFlashId(null), 2000)
    }
  }, [highlight, loading])

  if (loading) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${C.blue}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: C.muted, fontSize: 13 }}>Loading report...</p>
      </div>
    </div>
  )

  const insight = buildInsight(signals, sweep)

  // Compute listing/buyer counts for real estate vertical header
  const isRealEstate = verticalConfig?.vertical_type === 'real_estate'
  const listingCount = isRealEstate ? enrichedCases.filter(c => (c.loan_data as any)?.case_type !== 'buyer').length : 0
  const buyerCount   = isRealEstate ? enrichedCases.filter(c => (c.loan_data as any)?.case_type === 'buyer').length  : 0
  const tierCounts = {
    CRITICAL: enrichedCases.filter(c => c.drift_tier === 'CRITICAL').length,
    ALERT:    enrichedCases.filter(c => c.drift_tier === 'ALERT').length,
    CAUTION:  enrichedCases.filter(c => c.drift_tier === 'CAUTION').length,
    STABLE:   enrichedCases.filter(c => c.drift_tier === 'STABLE').length,
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.text }}>
      {/* CONFIDENTIAL BANNER */}
      <div style={{ background: C.critical, color: 'white', textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: '5px', textTransform: 'uppercase' }}>
        CONFIDENTIAL — SOLVEGA LABS / MERIDIAN ARC — PILOT DEMONSTRATION ONLY
      </div>

      {isRealEstate && verticalConfig ? (
        <>
          <VerticalReportHeader
            institution={{ id: institutionId, name: institutionName }}
            tiers={tierCounts}
            config={verticalConfig}
            lastSweepAt={sweep?.completed_at ?? null}
            listingCount={listingCount}
            buyerCount={buyerCount}
          />
          <div style={{ padding: '8px 32px', background: C.blue, display: 'flex', alignItems: 'center', gap: 24, fontSize: 11, color: 'rgba(255,255,255,.85)' }}>
            <span>Fusion Sources: <strong>All Engines</strong></span>
            <span style={{ marginLeft: 'auto' }}>
              <Link href="/enterprise/cases" style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, textDecoration: 'none' }}>All Cases →</Link>
              <span style={{ color: 'rgba(255,255,255,.3)', margin: '0 12px' }}>|</span>
              <Link href="/enterprise" style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, textDecoration: 'none' }}>← Back to Portal</Link>
            </span>
          </div>
        </>
      ) : (
        /* HEADER — existing auto-finance header (do not delete) */
        <div style={{ background: C.navy }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, background: C.gold, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: C.navy, fontSize: 16 }}>MA</div>
              <div>
                <div style={{ color: 'white', fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>MERIDIAN ARC</div>
                <div style={{ color: C.gold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Enterprise Decision Intelligence · Solvega Labs</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: '#8899BB', fontSize: 11, lineHeight: 1.7 }}>
              <strong style={{ color: 'white' }}>{institutionName}</strong><br />
              Pilot Demo — Synthetic Data<br />
              Sweep Date: {fmtDate(sweep?.completed_at ?? null)}
            </div>
          </div>
          <div style={{ background: C.blue, padding: '8px 32px', display: 'flex', alignItems: 'center', gap: 24, fontSize: 11, color: 'rgba(255,255,255,.85)' }}>
            <span><strong>MAIN</strong></span>
            <span style={{ color: 'rgba(255,255,255,.3)' }}>|</span>
            <span>Active Loan Drift Detection — 90-Day Window</span>
            <span style={{ color: 'rgba(255,255,255,.3)' }}>|</span>
            <span>Fusion Sources: <strong>All Engines</strong></span>
            <span style={{ marginLeft: 'auto' }}>
              <Link href="/enterprise" style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, textDecoration: 'none' }}>← Back to Portal</Link>
            </span>
          </div>
        </div>
      )}

      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>

        {/* OBJECTIVE */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: C.muted, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${C.border}` }}>
          Objective Definition
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[['Objective ID','OBJ-CG-001'],['Owner',institutionName],['Sweep Cadence','Weekly · Monday 06:00 CT']].map(([l,v]) => (
            <div key={l}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: C.muted, fontWeight: 600, marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', background: C.lightBlue, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: C.navy, lineHeight: 1.6, borderLeft: `4px solid ${C.blue}` }}>
            Identify which active loans in the {institutionName} portfolio are drifting toward delinquency within 90 days, by fusing historical borrower and vehicle signals with live external market data, and surface ranked recommended actions.
          </div>
        </div>

        {/* SUMMARY PILLS — counts derived from enrichedCases, not sweep metadata */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {(['CRITICAL','ALERT','CAUTION','STABLE'] as Dir[]).map(d => (
            <div key={d} style={{ flex: 1, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: DIR[d] }}>
              <span style={{ color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.9 }}>{d}</span>
              <span style={{ color: 'white', fontSize: 28, fontWeight: 800 }}>
                {enrichedCases.filter(c => c.drift_tier === d).length}
              </span>
            </div>
          ))}
        </div>

        {/* LOAN CARDS */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: C.muted, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${C.border}` }}>
          Loan Sweep Results — Inference Engine Output
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          {enrichedCases.map(ec => {
            const color = DIR[ec.drift_tier]
            const cardId = caseId(ec.case_ref ?? ec.id)
            const isFlashing = flashId === cardId
            const confPct = ec.pred?.confidence_pct ??
              (ec.drift_tier === 'STABLE'
                ? Math.round(100 - ec.drift_score)
                : Math.round(ec.drift_score))
            return (
              <div key={ec.id} id={cardId} style={{ background: C.card, border: `1px solid ${isFlashing ? '#C9A227' : C.border}`, borderRadius: 10, overflow: 'hidden', borderLeft: `5px solid ${color}`, transition: 'border-color 0.4s', boxShadow: isFlashing ? '0 0 0 3px rgba(201,162,39,0.25)' : 'none' }}>
                {/* Header row — scrolls horizontally on narrow viewports */}
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 110px 100px 90px 80px 120px 100px 90px', alignItems: 'stretch', minWidth: 800 }}>
                  {/* Case ID */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 3 }}>Case ID</div>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ec.case_ref}</div>
                  </div>
                  {/* Status: drift_tier badge primary, scored_status (ech.loan_status) secondary */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 3 }}>Status</div>
                    <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, color: 'white', background: color, marginBottom: 3 }}>{ec.drift_tier}</span>
                    <div style={{ fontSize: 9, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatLoanStatus(ec.scored_status)}</div>
                  </div>
                  {/* Region */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 3 }}>Region</div>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ec.region}</div>
                  </div>
                  {/* FICO Band */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 3 }}>FICO Band</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{ec.fico_band}</div>
                  </div>
                  {/* LTV Drift */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 3 }}>LTV Drift</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtLTV(ec.ltv_ratio)}</div>
                  </div>
                  {/* Drift Score */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 3 }}>Drift Score</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{ec.drift_score} / 100</div>
                    <div style={{ marginTop: 6, height: 5, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${ec.drift_score}%`, background: color, borderRadius: 3 }} />
                    </div>
                  </div>
                  {/* Direction */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 3 }}>Direction</div>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 800, color: 'white', background: color, marginTop: 4 }}>{ec.drift_tier}</span>
                  </div>
                  {/* Outcome Confidence */}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 3 }}>Outcome Confidence</div>
                    <div title={OUTCOME_TOOLTIP[ec.drift_tier] ?? ''} style={{ fontSize: 13, fontWeight: 700, cursor: 'help' }}>{confPct}%</div>
                  </div>
                </div>
                </div>{/* end overflow-x scroll wrapper */}
                {/* Body: only render if supplementary prediction data exists */}
                {ec.pred && (
                  <div style={{ background: '#FAFBFD', padding: '10px 12px 14px', borderTop: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 5 }}>Top Signals (Fusion)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(ec.pred.top_signals ?? []).slice(0, 3).map((sig, j) => (
                          <div key={j} style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 8px', fontSize: 10, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.blue, flexShrink: 0 }} />
                            {sig}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Recommended Action</div>
                      <div style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 11, color: C.text, lineHeight: 1.5 }}>
                        {ec.pred.recommended_action}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* LIVE FUSION SIGNALS */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: C.muted, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${C.border}` }}>
          Live Fusion Signal Snapshot — Applied to All Cases
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 4 }}>
            {signals.map(s => {
              const { label, value, delta, isNeg } = parseSignal(s)
              return (
                <div key={s.signal_id} style={{ background: C.lightBlue, borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: C.blue, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{value}</div>
                  <div style={{ fontSize: 10, marginTop: 2, color: isNeg ? C.alert : C.stable }}>{delta}</div>
                </div>
              )
            })}
          </div>
          {insight && (
            <div style={{ marginTop: 14, background: C.lightBlue, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.navy, borderLeft: `4px solid ${C.blue}` }}>
              <strong>Fusion insight:</strong> {insight}
            </div>
          )}
        </div>

        {/* SCHEMA */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: C.muted, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${C.border}` }}>
          Sanitized Schema — 82 Fields across 7 Groups (PII Removed)
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              ['A. Loan Origination', '15', 'loan_id · origination_date · loan_term_months · loan_amount · interest_rate_pct · monthly_payment · loan_type · down_payment · ltv_ratio · dti_ratio · institution_code · loan_purpose · co_borrower_flag · channel'],
              ['B. Borrower Profile (Anonymized)', '15', 'region (ZIP→region) · fico_band (range) · income_band (range) · employment_type · tenure_months · residence_type · credit_utilization · open_tradelines · derogatory_marks · bankruptcy_flag · prior_auto_loans · prior_default_flag'],
              ['C. Vehicle', '10', 'vehicle_year · vehicle_make · model_class · condition · odometer · value_at_origination · nada_book · vehicle_age · category · gap_flag'],
              ['D. Payment History', '13', 'payments_made · payments_remaining · current_balance · last_payment_date · last_payment_amount · days_past_due · max_dpd_ever · times_30/60/90_dpd · payment_streak · deferment_flag · loan_status'],
              ['E. External Signals at Origination', '8', 'manheim_index · regional_unemployment · fed_funds_rate · regional_median_income · auto_sales_index · consumer_sentiment · fuel_price · prime_rate — all captured at origination date'],
              ['F. Live Fusion Signals', '9', 'manheim_current · unemployment_current · fed_funds_current · income_index_current · fuel_current · sentiment_current · collateral_value_est · ltv_drift · employment_signal_regional'],
            ].map(([label, count, fields]) => (
              <div key={label} style={{ background: C.bg, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  {label}
                  <span style={{ background: C.blue, color: 'white', borderRadius: 10, fontSize: 9, padding: '1px 7px' }}>{count}</span>
                </div>
                <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.8 }}>{fields}</div>
              </div>
            ))}
            <div style={{ background: C.lightBlue, borderRadius: 8, padding: '10px 14px', border: `1px solid #B8CEF5` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                G. Inference Engine Output — Meridian Arc
                <span style={{ background: C.navy, color: 'white', borderRadius: 10, fontSize: 9, padding: '1px 7px' }}>12</span>
              </div>
              <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.8 }}>objective_id · case_id · drift_score · drift_direction · top_signal_1/2/3 · collateral_risk_flag · income_stress_flag · recommended_action · sweep_timestamp · confidence_pct</div>
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <div style={{ background: C.navy, color: '#8899BB', textAlign: 'center', padding: '16px 32px', fontSize: 10 }}>
        <strong style={{ color: C.gold }}>MERIDIAN ARC · SOLVEGA LABS</strong>
        {' '}·{' '}Confidential — Pilot Demonstration, Synthetic Data Only{' '}·{' '}Not for distribution
      </div>
    </div>
  )
}
