'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { parseCsv, validateAndParseRow } from '@/lib/enterprise/csv-ingest'
import type { CsvRow, FailedRow, IngestSummary } from '@/lib/enterprise/types'

export type IngestActionResult =
  | { ok: true; summary: IngestSummary }
  | { ok: false; error: string }

const BATCH_SIZE = 100

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

export async function runIngest(formData: FormData): Promise<IngestActionResult> {
  const startMs = Date.now()

  const institutionId = formData.get('institution_id')
  const fileEntry = formData.get('file')

  if (!institutionId || typeof institutionId !== 'string' || !institutionId.trim()) {
    return { ok: false, error: 'institution_id is required' }
  }
  if (!fileEntry || !(fileEntry instanceof Blob)) {
    return { ok: false, error: 'file is required' }
  }

  const supabase = createServiceClient()

  // Verify institution exists
  const { data: institution, error: instErr } = await supabase
    .from('enterprise_institutions')
    .select('id')
    .eq('id', institutionId.trim())
    .single()

  if (instErr || !institution) {
    return { ok: false, error: 'Institution not found. Verify the institution exists in Supabase.' }
  }

  const instId = institution.id as string

  // Parse CSV
  let csvText: string
  try {
    csvText = await fileEntry.text()
  } catch {
    return { ok: false, error: 'Could not read uploaded file' }
  }

  const { headers, rows } = parseCsv(csvText)

  if (headers.length === 0) {
    return { ok: false, error: 'CSV file is empty or has no headers' }
  }

  // Validate all rows — single pass
  const validRows: (CsvRow & { _rowNum: number })[] = []
  const failedRows: FailedRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const result = validateAndParseRow(headers, rows[i], i + 1)
    if ('valid' in result) {
      validRows.push({ ...result.valid, _rowNum: i + 1 })
    } else {
      failedRows.push(result.failed)
    }
  }

  // Upsert valid rows to enterprise_cases in batches
  let ingestedCount = 0
  const upserted: { id: string; case_ref: string; origination_date: string }[] = []
  const batchFailedRows: FailedRow[] = []

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE)
    const records = batch.map(row => ({
      institution_id: instId,
      case_ref: row.case_ref,
      region: row.region,
      fico_band: row.fico_band,
      income_band: row.income_band,
      employment_type: row.employment_type,
      loan_amount: row.loan_amount,
      interest_rate_pct: row.interest_rate_pct,
      ltv_ratio: row.ltv_ratio,
      dti_ratio: row.dti_ratio,
      loan_term_months: row.loan_term_months,
      origination_date: row.origination_date,
      loan_status: row.loan_status,
      days_past_due: row.days_past_due,
      current_balance: row.current_balance,
      payments_remaining: row.payments_remaining,
      loan_data: row.extra_fields,
    }))

    const { data, error: upsertErr } = await supabase
      .from('enterprise_cases')
      .upsert(records, { onConflict: 'institution_id,case_ref' })
      .select('id, case_ref, origination_date')

    if (upsertErr) {
      console.error('[FF-033] upsert batch error:', upsertErr.message)
      for (const row of batch) {
        batchFailedRows.push({ row_number: row._rowNum, case_ref: row.case_ref, reason: `DB error: ${upsertErr.message}` })
      }
    } else {
      ingestedCount += data?.length ?? 0
      upserted.push(...(data ?? []))
    }
  }

  // Write origination snapshots for newly inserted cases only.
  // Partial unique index idx_case_history_origination_unique prevents dupes.
  if (upserted.length > 0) {
    const allCaseIds = upserted.map(c => c.id)

    const { data: existing } = await supabase
      .from('enterprise_case_history')
      .select('case_id')
      .in('case_id', allCaseIds)
      .eq('snapshot_type', 'origination')

    const existingSet = new Set((existing ?? []).map((r: { case_id: string }) => r.case_id))
    const newCases = upserted.filter(c => !existingSet.has(c.id))

    if (newCases.length > 0) {
      // ±90-day macro event window required — captures CPI/Great Resignation for Aug 2021 origins
      const uniqueDates = Array.from(new Set(newCases.map(c => c.origination_date)))
      const macroByDate = new Map<string, string[]>()

      await Promise.all(
        uniqueDates.map(async (date) => {
          const { data: events } = await supabase
            .from('enterprise_macro_events')
            .select('id')
            .gte('event_date', shiftDate(date, -90))
            .lte('event_date', shiftDate(date, 90))

          macroByDate.set(date, (events ?? []).map((e: { id: string }) => e.id))
        })
      )

      const csvRowByRef = new Map(validRows.map(r => [r.case_ref, r]))

      const snapshots = newCases.map(c => {
        const csv = csvRowByRef.get(c.case_ref)
        return {
          case_id: c.id,
          institution_id: instId,
          case_ref: c.case_ref,
          snapshot_at: `${c.origination_date}T00:00:00.000Z`,
          snapshot_type: 'origination' as const,
          loan_status: csv?.loan_status ?? null,
          days_past_due: csv?.days_past_due ?? 0,
          current_balance: csv?.loan_amount ?? null,
          macro_event_ids: macroByDate.get(c.origination_date) ?? [],
        }
      })

      for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
        const { error: histErr } = await supabase
          .from('enterprise_case_history')
          .insert(snapshots.slice(i, i + BATCH_SIZE))

        if (histErr) {
          console.error('[FF-033] origination snapshot insert error:', histErr.message)
        }
      }
    }
  }

  const allFailed = [...failedRows, ...batchFailedRows]

  return {
    ok: true,
    summary: {
      ingested: ingestedCount,
      failed: allFailed.length,
      failed_rows: allFailed,
      institution_id: instId,
      duration_ms: Date.now() - startMs,
    },
  }
}
