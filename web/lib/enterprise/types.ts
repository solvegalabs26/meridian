export type CsvRow = {
  case_ref: string
  region: string
  fico_band: string
  income_band: string
  employment_type: string
  loan_amount: number
  interest_rate_pct: number
  ltv_ratio: number
  dti_ratio: number
  loan_term_months: number
  origination_date: string // YYYY-MM-DD
  loan_status: LoanStatus
  days_past_due: number
  current_balance: number
  payments_remaining: number
  extra_fields: Record<string, string> // CSV cols beyond the 15 required
}

export type LoanStatus =
  | 'current'
  | '30dpd'
  | '60dpd'
  | '90dpd'
  | 'default'
  | 'charged-off'

export type SnapshotType =
  | 'origination'
  | 'sweep'
  | 'status_change'
  | 'csv_update'
  | 'resolution'

export type DriftTier = 'STABLE' | 'CAUTION' | 'ALERT' | 'CRITICAL'

export type FailedRow = {
  row_number: number
  case_ref?: string
  reason: string
}

export type IngestSummary = {
  ingested: number
  failed: number
  failed_rows: FailedRow[]
  institution_id: string
  duration_ms: number
}

export type MacroEventSummary = {
  id: string
  event_date: string
  event_category: string
  event_name: string
  magnitude: number
  direction: 'positive' | 'negative' | 'neutral' | 'mixed'
  metric_name?: string
  metric_value?: number
  metric_unit?: string
  delta_value?: number
}

export type CaseTimelineEntry = {
  id: string
  case_id: string
  institution_id: string
  case_ref: string
  snapshot_at: string
  snapshot_type: SnapshotType
  loan_status: string | null
  days_past_due: number | null
  current_balance: number | null
  drift_score: number | null
  drift_tier: DriftTier | null
  prior_status: string | null
  prior_dpd: number | null
  macro_event_ids: string[]
  macro_events: MacroEventSummary[] // hydrated from macro_event_ids
  notes: string | null
}
