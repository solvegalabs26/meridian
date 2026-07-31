import { createServiceClient } from '@/lib/supabase/server'
import type { CaseTimelineEntry, MacroEventSummary, SnapshotType, DriftTier } from './types'

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// Returns the full chronological snapshot history for a case, with each
// row's macro_event_ids hydrated into full MacroEventSummary objects.
// Uses a single IN query for all macro events across all history rows.
export async function getCaseTimeline(
  caseId: string,
  institutionId: string
): Promise<CaseTimelineEntry[]> {
  const supabase = createServiceClient()

  const { data: rows, error } = await supabase
    .from('enterprise_case_history')
    .select('*')
    .eq('case_id', caseId)
    .eq('institution_id', institutionId)
    .order('snapshot_at', { ascending: true })

  if (error || !rows || rows.length === 0) return []

  // Collect all unique macro event ids across all rows
  const allEventIds = [
    ...new Set(rows.flatMap((r: { macro_event_ids?: string[] }) => r.macro_event_ids ?? [])),
  ]

  // Single IN query for all needed events
  const eventMap = new Map<string, MacroEventSummary>()
  if (allEventIds.length > 0) {
    const { data: events } = await supabase
      .from('enterprise_macro_events')
      .select('id, event_date, event_category, event_name, magnitude, direction, metric_name, metric_value, metric_unit, delta_value')
      .in('id', allEventIds)

    for (const e of events ?? []) {
      eventMap.set(e.id, {
        id: e.id,
        event_date: e.event_date,
        event_category: e.event_category,
        event_name: e.event_name,
        magnitude: e.magnitude,
        direction: e.direction,
        metric_name: e.metric_name ?? undefined,
        metric_value: e.metric_value ?? undefined,
        metric_unit: e.metric_unit ?? undefined,
        delta_value: e.delta_value ?? undefined,
      })
    }
  }

  return rows.map((r: Record<string, unknown>) => {
    const eventIds = (r.macro_event_ids as string[] | null) ?? []
    return {
      id: r.id as string,
      case_id: r.case_id as string,
      institution_id: r.institution_id as string,
      case_ref: r.case_ref as string,
      snapshot_at: r.snapshot_at as string,
      snapshot_type: r.snapshot_type as SnapshotType,
      loan_status: (r.loan_status as string | null) ?? null,
      days_past_due: (r.days_past_due as number | null) ?? null,
      current_balance: (r.current_balance as number | null) ?? null,
      drift_score: (r.drift_score as number | null) ?? null,
      drift_tier: (r.drift_tier as DriftTier | null) ?? null,
      prior_status: (r.prior_status as string | null) ?? null,
      prior_dpd: (r.prior_dpd as number | null) ?? null,
      macro_event_ids: eventIds,
      macro_events: eventIds.map(id => eventMap.get(id)).filter((e): e is MacroEventSummary => e !== undefined),
      notes: (r.notes as string | null) ?? null,
    }
  })
}

// Returns macro events within ±windowDays of snapshotAt, ordered by magnitude
// descending. Used by the sweep engine to frame current portfolio signals.
export async function getMacroContextForSnapshot(
  snapshotAt: string,
  windowDays = 30,
  industryFilter?: string
): Promise<MacroEventSummary[]> {
  const supabase = createServiceClient()

  const start = shiftDate(snapshotAt, -windowDays)
  const end = shiftDate(snapshotAt, windowDays)

  let query = supabase
    .from('enterprise_macro_events')
    .select('id, event_date, event_category, event_name, magnitude, direction, metric_name, metric_value, metric_unit, delta_value')
    .gte('event_date', start)
    .lte('event_date', end)
    .order('magnitude', { ascending: false })

  if (industryFilter) {
    query = query.contains('relevant_industries', [industryFilter])
  }

  const { data } = await query

  return (data ?? []).map(e => ({
    id: e.id,
    event_date: e.event_date,
    event_category: e.event_category,
    event_name: e.event_name,
    magnitude: e.magnitude,
    direction: e.direction,
    metric_name: e.metric_name ?? undefined,
    metric_value: e.metric_value ?? undefined,
    metric_unit: e.metric_unit ?? undefined,
    delta_value: e.delta_value ?? undefined,
  }))
}

// Constructs a structured plain-text narrative suitable for injection into a
// sweep engine prompt. Dense and signal-rich — not conversational.
export async function getCaseRiskNarrative(
  caseId: string,
  institutionId: string
): Promise<string> {
  const supabase = createServiceClient()

  const [{ data: caseData }, timeline] = await Promise.all([
    supabase
      .from('enterprise_cases')
      .select('case_ref, fico_band, ltv_ratio, employment_type, origination_date, current_balance, loan_term_months, loan_status, days_past_due')
      .eq('id', caseId)
      .eq('institution_id', institutionId)
      .single(),
    getCaseTimeline(caseId, institutionId),
  ])

  const ref = caseData?.case_ref ?? 'UNKNOWN'
  const fico = caseData?.fico_band ?? 'N/A'
  const ltv = caseData?.ltv_ratio != null ? `${caseData.ltv_ratio}%` : 'N/A'
  const emp = caseData?.employment_type ?? 'N/A'
  const origDate = caseData?.origination_date ?? 'N/A'
  const balance = caseData?.current_balance != null
    ? `$${Number(caseData.current_balance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : 'N/A'
  const term = caseData?.loan_term_months != null ? `${caseData.loan_term_months}mo` : 'N/A'

  const lines: string[] = [
    `CASE: ${ref} | FICO: ${fico} | LTV: ${ltv} | EMPLOYMENT: ${emp}`,
    `ORIGINATION: ${origDate} | BALANCE: ${balance} | TERM: ${term}`,
    '',
  ]

  const originEntry = timeline.find(t => t.snapshot_type === 'origination')
  if (originEntry && originEntry.macro_events.length > 0) {
    lines.push('MACRO CONTEXT AT ORIGINATION (±90 days):')
    for (const ev of originEntry.macro_events) {
      const dir = ev.direction === 'negative' ? 'NEG'
        : ev.direction === 'positive' ? 'POS'
        : ev.direction === 'mixed' ? 'MXD' : 'NEU'
      lines.push(`- [${ev.magnitude}/${dir}] ${ev.event_name} (${ev.event_date})`)
    }
  } else {
    lines.push('MACRO CONTEXT AT ORIGINATION: no events within ±90 days')
  }

  lines.push('', 'STATUS HISTORY:')

  if (timeline.length === 0) {
    lines.push('- [no snapshots available]')
  } else {
    for (const entry of timeline) {
      const date = entry.snapshot_at.split('T')[0]
      const suffix = entry.snapshot_type === 'origination' ? ' (origination)' : ''
      const macroNote = entry.macro_events.length > 0
        ? ` [${entry.macro_events.length} macro event(s) active]`
        : ''
      lines.push(`- ${date}: ${entry.loan_status ?? 'unknown'}${suffix}${macroNote}`)
    }
  }

  lines.push('')
  const currentStatus = caseData?.loan_status ?? 'unknown'
  const dpd = caseData?.days_past_due ?? 0
  const latestEntry = timeline[timeline.length - 1]
  const driftPart = latestEntry?.drift_tier ? ` | DRIFT: ${latestEntry.drift_tier}` : ' | DRIFT: [not yet scored]'
  lines.push(`CURRENT: ${currentStatus}${dpd > 0 ? ` (${dpd} DPD)` : ''}${driftPart}`)

  return lines.join('\n')
}
