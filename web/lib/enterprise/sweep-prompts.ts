import type { MacroEventSummary } from './types'

export type CohortPattern = {
  region: string
  fico_band: string
  employment_type?: string
  origination_year?: number
  case_count: number
  delinquent_count: number
  delinquency_rate: number
  avg_ltv: number
  case_refs: string[]
  macro_events_at_origination: string[]
}

export type TierChangeProjection = {
  case_id: string
  case_ref: string
  current_tier: string
  projected_tier: string
  confidence: number
  horizon_days: number
  key_signals: string[]
}

export const PORTFOLIO_NARRATIVE_PROMPT = (data: {
  totalCases: number
  tierCounts: { critical: number; alert: number; caution: number; stable: number }
  delinquencyRate: number
  highRiskCohorts: CohortPattern[]
  projectedChanges: TierChangeProjection[]
  macroEvents: string[]
}): string => `You are a portfolio intelligence analyst for Meridian Fusion.
Analyze the following portfolio data and return a JSON response only.

PORTFOLIO DATA:
- Total cases: ${data.totalCases}
- Risk tiers: ${JSON.stringify(data.tierCounts)}
- Delinquency rate: ${(data.delinquencyRate * 100).toFixed(1)}%
- High-risk cohorts detected: ${JSON.stringify(data.highRiskCohorts)}
- Projected tier deteriorations: ${JSON.stringify(data.projectedChanges)}
- Active macro signals: ${data.macroEvents.length > 0 ? data.macroEvents.join('; ') : 'None within last 90 days'}

Return ONLY valid JSON with no preamble or markdown:
{
  "portfolio_summary": "2-3 sentence plain English summary of portfolio health",
  "key_findings": [
    "Finding 1 — specific and data-grounded",
    "Finding 2",
    "Finding 3"
  ]
}

Rules:
- Every claim must reference specific data from the input
- Do not invent statistics not present in the input
- key_findings must be specific (name cohorts, cite rates, reference macro events)
- portfolio_summary must be readable by a non-technical business owner`

export const OBJECTIVE_SWEEP_PROMPT = (data: {
  objectiveStatement: string
  objId: string
  caseNarratives: string[]
  highRiskCohorts: CohortPattern[]
  macroEvents: MacroEventSummary[]
  projectedChanges: TierChangeProjection[]
}): string => `You are an enterprise intelligence analyst for Meridian Fusion.
Answer the following business intelligence question using only the provided data.

BUSINESS QUESTION (${data.objId}):
${data.objectiveStatement}

CASE DATA (${data.caseNarratives.length} cases in scope):
${data.caseNarratives.join('\n---\n')}

PORTFOLIO PATTERNS ALREADY DETECTED (from portfolio sweep):
${JSON.stringify(data.highRiskCohorts, null, 2)}

CURRENT MACRO CONDITIONS (last 90 days, auto_finance):
${data.macroEvents.slice(0, 5).length > 0
  ? data.macroEvents.slice(0, 5).map(e =>
      `- [Magnitude ${e.magnitude}/${e.direction}] ${e.event_name} (${e.event_date})`
    ).join('\n')
  : '- No macro events in last 90 days for this industry'}

PROJECTED ACCOUNT MOVEMENTS:
${data.projectedChanges.length > 0
  ? data.projectedChanges.map(p =>
      `- ${p.case_ref}: ${p.current_tier} → ${p.projected_tier} (${Math.round(p.confidence * 100)}% confidence, ${p.horizon_days}d horizon)`
    ).join('\n')
  : '- No tier changes projected at this time'}

Return ONLY valid JSON with no preamble or markdown:
{
  "affecting_it": "What specific data patterns are driving the answer to this question",
  "implies": "What this means for the business — operational and strategic implications",
  "signals": "Specific signals: case refs, rates, metrics, macro events that support this finding",
  "what_to_do": "Specific recommended actions — not generic advice",
  "key_case_refs": ["case_ref_1", "case_ref_2"],
  "confidence_score": 0.85,
  "finding_type": "known_unknown"
}

INFERENCE RULES (follow strictly):
R-1: Every claim in affecting_it must reference at least one specific case_ref or metric from the input
R-2: Do not assert causation — use "correlates with", "coincides with", "is associated with"
R-3: If the data is insufficient to answer the question, say so in affecting_it and set confidence_score below 0.4
R-4: signals must cite specific case_refs, not just aggregate statistics
R-5: what_to_do must be actionable by a non-data person — no vague recommendations
R-6: finding_type: known_unknown = confirmed what was suspected; unknown_unknown = surfaced something new; crystal_ball = forward projection
R-7: Never fabricate data. If a pattern is not in the input, do not assert it.`
