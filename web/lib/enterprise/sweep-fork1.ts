import { createServiceClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { PORTFOLIO_NARRATIVE_PROMPT, type CohortPattern, type TierChangeProjection } from './sweep-prompts'
import type { DriftTier } from './types'

export type { CohortPattern, TierChangeProjection }

export type PortfolioSweepResult = {
  sweepId: string
  metricsId: string
  totalCases: number
  healthScore: number
  tierCounts: { critical: number; alert: number; caution: number; stable: number }
  highRiskCohorts: CohortPattern[]
  projectedTierChanges: TierChangeProjection[]
  durationMs: number
}

type CaseRow = {
  id: string
  case_ref: string
  region: string
  fico_band: string
  employment_type: string
  loan_amount: number
  ltv_ratio: number
  dti_ratio: number
  origination_date: string
  loan_status: string
  days_past_due: number
  current_balance: number
}

type HistoryRow = {
  id: string
  case_id: string
  case_ref: string
  snapshot_at: string
  snapshot_type: string
  loan_status: string | null
  days_past_due: number | null
  macro_event_ids: string[] | null
  prior_status: string | null
  prior_dpd: number | null
}

// ── Drift scoring ──────────────────────────────────────────────────────────
// Weights: DPD 40%, LTV 25%, DTI 20%, Trajectory 15% = max 100 pts

function dpdPts(status: string): number {
  switch (status) {
    case 'charged_off': return 40
    case 'default': return 36     // 90/100 * 40
    case '90dpd': return 30       // 75/100 * 40
    case '60dpd': return 22       // 55/100 * 40
    case '30dpd': return 12       // 30/100 * 40
    default: return 0
  }
}

function ltvPts(ltv: number): number {
  if (ltv >= 115) return 25
  if (ltv >= 105) return 17      // 30/45 * 25 ≈ 16.7
  if (ltv >= 95)  return 8       // 15/45 * 25 ≈ 8.3
  return 0
}

function dtiPts(dti: number): number {
  if (dti > 40)   return 20
  if (dti >= 35)  return 11      // 20/35 * 20 ≈ 11.4
  if (dti >= 28)  return 6       // 10/35 * 20 ≈ 5.7
  return 0
}

function statusToDpd(status: string | null): number {
  switch (status) {
    case '30dpd': return 30
    case '60dpd': return 60
    case '90dpd': return 90
    case 'default': return 150
    case 'charged_off': return 200
    default: return 0
  }
}

function computeDriftScore(
  c: CaseRow,
  history: HistoryRow[]
): { score: number; tier: DriftTier } {
  // Trajectory: check if the most recent status_change snapshot shows worsening
  const statusChanges = history
    .filter(h => h.snapshot_type === 'status_change')
    .sort((a, b) => a.snapshot_at.localeCompare(b.snapshot_at))
  const latestChange = statusChanges[statusChanges.length - 1]
  const worsening = latestChange != null
    && statusToDpd(latestChange.loan_status) > statusToDpd(latestChange.prior_status)

  const raw = dpdPts(c.loan_status) + ltvPts(c.ltv_ratio) + dtiPts(c.dti_ratio) + (worsening ? 15 : 0)
  const score = Math.min(100, Math.round(raw))

  let tier: DriftTier
  if (score >= 65) tier = 'CRITICAL'
  else if (score >= 40) tier = 'ALERT'
  else if (score >= 20) tier = 'CAUTION'
  else tier = 'STABLE'

  return { score, tier }
}

// ── Cohort detection ───────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const item of arr) {
    const k = key(item)
    const g = m.get(k) ?? []
    g.push(item)
    m.set(k, g)
  }
  return m
}

function buildCohorts(
  cases: CaseRow[],
  macroNamesByCaseId: Map<string, string[]>
): CohortPattern[] {
  const results: CohortPattern[] = []
  const seenKeys = new Set<string>()

  function addCohort(group: CaseRow[], label: Partial<CohortPattern>, key: string) {
    if (seenKeys.has(key)) return
    if (group.length < 2) return
    const delinquent = group.filter(c => c.loan_status !== 'current')
    const rate = delinquent.length / group.length
    if (rate < 0.5) return
    seenKeys.add(key)

    const macroNames = new Set<string>()
    for (const c of group) {
      for (const name of macroNamesByCaseId.get(c.id) ?? []) macroNames.add(name)
    }
    results.push({
      ...label,
      case_count: group.length,
      delinquent_count: delinquent.length,
      delinquency_rate: parseFloat(rate.toFixed(3)),
      avg_ltv: parseFloat((group.reduce((s, c) => s + c.ltv_ratio, 0) / group.length).toFixed(1)),
      case_refs: group.map(c => c.case_ref),
      macro_events_at_origination: Array.from(macroNames),
    } as CohortPattern)
  }

  // Level 1 — region × fico_band × employment_type × origination_year (most specific)
  const byRFEY = groupBy(cases, c =>
    `${c.region}|${c.fico_band}|${c.employment_type}|${new Date(c.origination_date).getFullYear()}`
  )
  for (const [key, group] of Array.from(byRFEY)) {
    const [region, fico_band, employment_type, yearStr] = key.split('|')
    addCohort(group, { region, fico_band, employment_type, origination_year: parseInt(yearStr) }, key)
  }

  // Level 2 — region × fico_band × origination_year (without employment_type)
  const byRFY = groupBy(cases, c =>
    `${c.region}|${c.fico_band}|${new Date(c.origination_date).getFullYear()}`
  )
  for (const [key, group] of Array.from(byRFY)) {
    const [region, fico_band, yearStr] = key.split('|')
    addCohort(group, { region, fico_band, origination_year: parseInt(yearStr) }, `rfY:${key}`)
  }

  // Level 3 — region × fico_band (broadest — flags multi-year patterns)
  const byRF = groupBy(cases, c => `${c.region}|${c.fico_band}`)
  for (const [key, group] of Array.from(byRF)) {
    if (group.length < 3) continue // higher bar without vintage dimension
    const [region, fico_band] = key.split('|')
    addCohort(group, { region, fico_band }, `rf:${key}`)
  }

  return results
}

// ── Macro projection ───────────────────────────────────────────────────────

type MacroEventRow = {
  id: string
  event_name: string
  event_category: string
  magnitude: number
  direction: string
  relevant_industries: string[] | null
}

function isManhiemDecline(e: MacroEventRow): boolean {
  return e.event_name.toLowerCase().includes('manheim') && e.direction === 'negative'
}

function isUnemploymentRising(e: MacroEventRow): boolean {
  return (e.event_name.toLowerCase().includes('unemployment') ||
          e.event_name.toLowerCase().includes('jobless') ||
          e.event_category === 'labor_market') && e.direction === 'negative'
}

function isFedRateElevated(e: MacroEventRow): boolean {
  return (e.event_name.toLowerCase().includes('federal funds') ||
          e.event_name.toLowerCase().includes('fed funds') ||
          e.event_name.toLowerCase().includes('fomc') ||
          e.event_category === 'monetary_policy') && e.direction === 'negative'
}

function buildProjections(
  cases: CaseRow[],
  scoredTiers: Map<string, { score: number; tier: DriftTier }>,
  recentMacroEvents: MacroEventRow[]
): TierChangeProjection[] {
  const projections: TierChangeProjection[] = []

  const manhiemDecline = recentMacroEvents.find(isManhiemDecline)
  const unemploymentRising = recentMacroEvents.find(isUnemploymentRising)
  const fedRateElevated = recentMacroEvents.find(isFedRateElevated)

  for (const c of cases) {
    const scored = scoredTiers.get(c.id)
    if (!scored || scored.tier !== 'CAUTION') continue

    const signals: string[] = []
    if (manhiemDecline && c.ltv_ratio > 100) signals.push(manhiemDecline.event_name)
    if (unemploymentRising) signals.push(unemploymentRising.event_name)
    if (fedRateElevated && c.dti_ratio > 35) signals.push(fedRateElevated.event_name)

    if (signals.length >= 2) {
      projections.push({
        case_id: c.id,
        case_ref: c.case_ref,
        current_tier: 'CAUTION',
        projected_tier: 'ALERT',
        confidence: Math.min(0.95, 0.5 + signals.length * 0.15),
        horizon_days: 21,
        key_signals: signals,
      })
    }
  }

  return projections
}

// ── Main export ────────────────────────────────────────────────────────────

export async function runPortfolioSweep(institutionId: string): Promise<PortfolioSweepResult> {
  const startMs = Date.now()
  const supabase = createServiceClient()

  // ── Step 1: Load all cases + history ──
  const [{ data: casesData }, { data: historyData }] = await Promise.all([
    supabase
      .from('enterprise_cases')
      .select('id, case_ref, region, fico_band, employment_type, loan_amount, ltv_ratio, dti_ratio, origination_date, loan_status, days_past_due, current_balance')
      .eq('institution_id', institutionId),
    supabase
      .from('enterprise_case_history')
      .select('id, case_id, case_ref, snapshot_at, snapshot_type, loan_status, days_past_due, macro_event_ids, prior_status, prior_dpd')
      .eq('institution_id', institutionId)
      .order('snapshot_at', { ascending: true }),
  ])

  const cases: CaseRow[] = casesData ?? []
  const historyRows: HistoryRow[] = historyData ?? []

  // Group history by case_id
  const historyByCaseId = new Map<string, HistoryRow[]>()
  for (const row of historyRows) {
    const g = historyByCaseId.get(row.case_id) ?? []
    g.push(row)
    historyByCaseId.set(row.case_id, g)
  }

  // Collect macro event IDs from origination snapshots for cohort enrichment
  const allOriginMacroIds = new Set<string>()
  for (const rows of Array.from(historyByCaseId.values())) {
    const orig = rows.find(r => r.snapshot_type === 'origination')
    for (const id of orig?.macro_event_ids ?? []) allOriginMacroIds.add(id)
  }

  // Fetch event names for origination macro IDs + recent macro events in parallel
  const [macroNamesResult, recentMacroResult] = await Promise.all([
    allOriginMacroIds.size > 0
      ? supabase.from('enterprise_macro_events')
          .select('id, event_name, event_category, magnitude, direction, relevant_industries')
          .in('id', Array.from(allOriginMacroIds))
      : Promise.resolve({ data: [] }),
    supabase.from('enterprise_macro_events')
      .select('id, event_name, event_category, magnitude, direction, relevant_industries')
      .gte('event_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('magnitude', { ascending: false }),
  ])

  const macroNameById = new Map<string, string>()
  for (const e of macroNamesResult.data ?? []) macroNameById.set(e.id, e.event_name)

  // Build map: case_id → macro event names at origination
  const macroNamesByCaseId = new Map<string, string[]>()
  for (const [caseId, rows] of Array.from(historyByCaseId)) {
    const orig = rows.find(r => r.snapshot_type === 'origination')
    const names = (orig?.macro_event_ids ?? []).map(id => macroNameById.get(id)).filter((n): n is string => !!n)
    macroNamesByCaseId.set(caseId, names)
  }

  // ── Step 2: Score each case ──
  const scoredTiers = new Map<string, { score: number; tier: DriftTier }>()
  for (const c of cases) {
    const history = historyByCaseId.get(c.id) ?? []
    scoredTiers.set(c.id, computeDriftScore(c, history))
  }

  // ── Step 3: Batch UPDATE most recent history snapshot with drift scores ──
  await Promise.all(
    cases.map(async (c) => {
      const history = historyByCaseId.get(c.id) ?? []
      if (history.length === 0) return
      const latest = history[history.length - 1]
      const { score, tier } = scoredTiers.get(c.id)!
      await supabase
        .from('enterprise_case_history')
        .update({ drift_score: score, drift_tier: tier })
        .eq('id', latest.id)
    })
  )

  // ── Step 4: Tier counts ──
  const tierCounts = { critical: 0, alert: 0, caution: 0, stable: 0 }
  for (const { tier } of Array.from(scoredTiers.values())) {
    if (tier === 'CRITICAL') tierCounts.critical++
    else if (tier === 'ALERT') tierCounts.alert++
    else if (tier === 'CAUTION') tierCounts.caution++
    else tierCounts.stable++
  }

  // ── Step 5: Detect high-risk cohorts ──
  const highRiskCohorts = buildCohorts(cases, macroNamesByCaseId)

  // ── Step 6: Macro projections ──
  const recentMacroEvents: MacroEventRow[] = recentMacroResult.data ?? []
  const projectedTierChanges = buildProjections(cases, scoredTiers, recentMacroEvents)

  // ── Step 7: Delinquency metrics ──
  const total = cases.length
  const statusCounts = { current: 0, dpd30: 0, dpd60: 0, dpd90: 0, default: 0, chargedOff: 0 }
  let totalOutstandingBalance = 0
  for (const c of cases) {
    totalOutstandingBalance += c.current_balance ?? 0
    switch (c.loan_status) {
      case 'current': statusCounts.current++; break
      case '30dpd': statusCounts.dpd30++; break
      case '60dpd': statusCounts.dpd60++; break
      case '90dpd': statusCounts.dpd90++; break
      case 'default': statusCounts.default++; break
      case 'charged_off': statusCounts.chargedOff++; break
    }
  }
  const delinquentCount = statusCounts.dpd30 + statusCounts.dpd60 + statusCounts.dpd90 + statusCounts.default
  const delinquencyRate = total > 0 ? delinquentCount / total : 0

  // ── Step 8: Health score ──
  const criticalPct = total > 0 ? tierCounts.critical / total : 0
  const alertPct = total > 0 ? tierCounts.alert / total : 0
  const cautionPct = total > 0 ? tierCounts.caution / total : 0
  const rawHealth = 100
    - (criticalPct * 50)
    - (alertPct * 30)
    - (cautionPct * 15)
    - (delinquencyRate * 20)
    - (projectedTierChanges.length * 2)
  const healthScore = Math.max(0, Math.min(100, Math.round(rawHealth)))

  // Health trend: compare to previous metric if available
  const { data: prevMetric } = await supabase
    .from('enterprise_portfolio_metrics')
    .select('portfolio_health_score')
    .eq('institution_id', institutionId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  const prevHealth = prevMetric?.portfolio_health_score ?? null
  const healthTrend =
    prevHealth == null ? 'stable'
    : healthScore > prevHealth + 2 ? 'improving'
    : healthScore < prevHealth - 2 ? 'deteriorating'
    : 'stable'

  // ── Step 9: Concentration flags ──
  const balanceByRegion = new Map<string, number>()
  for (const c of cases) {
    balanceByRegion.set(c.region, (balanceByRegion.get(c.region) ?? 0) + (c.current_balance ?? 0))
  }
  const concentrationFlags = []
  for (const [region, balance] of Array.from(balanceByRegion)) {
    const pct = totalOutstandingBalance > 0 ? balance / totalOutstandingBalance : 0
    if (pct >= 0.35) {
      concentrationFlags.push({ dimension: 'region', value: region, pct_of_balance: parseFloat(pct.toFixed(3)), threshold_exceeded: pct >= 0.45 })
    }
  }

  // Top exposure cases (highest current balance)
  const topExposureCaseIds = [...cases]
    .sort((a, b) => (b.current_balance ?? 0) - (a.current_balance ?? 0))
    .slice(0, 5)
    .map(c => c.id)

  // Macro risk signals (for portfolio_metrics)
  const macroRiskSignals = projectedTierChanges.map(p => ({
    key_signals: p.key_signals,
    case_ref: p.case_ref,
    projected_tier: p.projected_tier,
    horizon_days: p.horizon_days,
  }))

  // ── Step 10: Claude API narrative ──
  let portfolioSummary = ''
  let keyFindings: string[] = []

  try {
    const client = getAnthropicClient()
    const prompt = PORTFOLIO_NARRATIVE_PROMPT({
      totalCases: total,
      tierCounts,
      delinquencyRate,
      highRiskCohorts,
      projectedChanges: projectedTierChanges,
      macroEvents: recentMacroEvents.slice(0, 5).map(e => e.event_name),
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      portfolioSummary = parsed.portfolio_summary ?? ''
      keyFindings = Array.isArray(parsed.key_findings) ? parsed.key_findings : []
    }
  } catch (err) {
    console.error('[FF-035-B] Fork 1 narrative error:', err instanceof Error ? err.message : String(err))
  }

  // ── Step 11: Write to Supabase ──
  const { data: sweepRow, error: sweepErr } = await supabase
    .from('enterprise_sweeps')
    .insert({
      institution_id: institutionId,
      trigger_type: 'manual',
      status: 'complete',
      fork: 'portfolio',
      sweep_type: 'full',
      cases_in_scope: total,
      cases_swept: total,
      critical_count: tierCounts.critical,
      alert_count: tierCounts.alert,
      caution_count: tierCounts.caution,
      stable_count: tierCounts.stable,
      signals_used: recentMacroEvents.length,
      patterns_matched: highRiskCohorts.length,
      engine_version: 'ff-035b-v1',
      portfolio_health_score: healthScore,
      started_at: new Date(startMs).toISOString(),
      completed_at: new Date().toISOString(),
      sweep_metadata: { delinquency_rate: delinquencyRate, total_outstanding_balance: totalOutstandingBalance },
    })
    .select('id')
    .single()

  if (sweepErr || !sweepRow) {
    console.error('[FF-035-B] enterprise_sweeps insert error:', sweepErr?.message)
    throw new Error(`Fork 1 sweep write failed: ${sweepErr?.message}`)
  }
  const sweepId = sweepRow.id as string

  const { data: metricsRow, error: metricsErr } = await supabase
    .from('enterprise_portfolio_metrics')
    .insert({
      institution_id: institutionId,
      sweep_id: sweepId,
      total_cases: total,
      total_outstanding_balance: totalOutstandingBalance,
      portfolio_health_score: healthScore,
      health_trend: healthTrend,
      critical_count: tierCounts.critical,
      alert_count: tierCounts.alert,
      caution_count: tierCounts.caution,
      stable_count: tierCounts.stable,
      critical_pct: parseFloat(criticalPct.toFixed(4)),
      alert_pct: parseFloat(alertPct.toFixed(4)),
      caution_pct: parseFloat(cautionPct.toFixed(4)),
      stable_pct: parseFloat((total > 0 ? tierCounts.stable / total : 0).toFixed(4)),
      current_count: statusCounts.current,
      dpd_30_count: statusCounts.dpd30,
      dpd_60_count: statusCounts.dpd60,
      dpd_90_count: statusCounts.dpd90,
      default_count: statusCounts.default,
      charged_off_count: statusCounts.chargedOff,
      delinquency_rate_pct: parseFloat(delinquencyRate.toFixed(4)),
      high_risk_cohorts: highRiskCohorts,
      concentration_flags: concentrationFlags,
      top_exposure_cases: topExposureCaseIds,
      macro_risk_signals: macroRiskSignals,
      projected_tier_changes: projectedTierChanges,
      portfolio_summary: portfolioSummary,
      key_findings: keyFindings,
    })
    .select('id')
    .single()

  if (metricsErr || !metricsRow) {
    console.error('[FF-035-B] enterprise_portfolio_metrics insert error:', metricsErr?.message)
    throw new Error(`Fork 1 metrics write failed: ${metricsErr?.message}`)
  }
  const metricsId = metricsRow.id as string

  // Update last_focus_sweep_at on all focus-state objectives
  await supabase
    .from('enterprise_objectives')
    .update({ last_focus_sweep_at: new Date().toISOString() })
    .eq('institution_id', institutionId)
    .eq('objective_state', 'focus')

  return {
    sweepId,
    metricsId,
    totalCases: total,
    healthScore,
    tierCounts,
    highRiskCohorts,
    projectedTierChanges,
    durationMs: Date.now() - startMs,
  }
}
