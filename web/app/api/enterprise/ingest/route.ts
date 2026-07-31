import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseCsv, validateAndParseRow } from '@/lib/enterprise/csv-ingest'
import type { CsvRow, FailedRow, IngestSummary } from '@/lib/enterprise/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const BATCH_SIZE = 100

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  const startMs = Date.now()

  // Auth: service-role bearer token only
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse multipart/form-data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Could not parse form data' }, { status: 400 })
  }

  const institutionId = formData.get('institution_id')
  const fileEntry = formData.get('file')

  if (!institutionId || typeof institutionId !== 'string' || !institutionId.trim()) {
    return NextResponse.json({ error: 'institution_id is required' }, { status: 400 })
  }
  if (!fileEntry || !(fileEntry instanceof Blob)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify institution exists — foreign-key constraint will also catch this
  // but we want a clean 404 before touching any data.
  const { data: institution, error: instErr } = await supabase
    .from('enterprise_institutions')
    .select('id')
    .eq('id', institutionId.trim())
    .single()

  if (instErr || !institution) {
    return NextResponse.json({ error: `Institution not found: ${institutionId}` }, { status: 404 })
  }

  const instId = institution.id as string

  // Parse CSV
  let csvText: string
  try {
    csvText = await fileEntry.text()
  } catch {
    return NextResponse.json({ error: 'Could not read uploaded file' }, { status: 400 })
  }

  const { headers, rows } = parseCsv(csvText)

  if (headers.length === 0) {
    return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
  }

  // Validate every row — collect valid + failed in a single pass
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

  // Upsert valid rows to enterprise_cases in batches of 100
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

  // Write origination history snapshots for newly inserted cases only.
  // The partial unique index idx_case_history_origination_unique prevents dupes
  // from parallel calls, but we also pre-filter to avoid unnecessary writes.
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
      // Query macro events per unique origination_date using ±90-day window.
      // 90-day window is required (not 30) to correctly capture macro events
      // like the CPI June 2021 release and Great Resignation for Aug 2021 origins.
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

      // Build origination snapshot rows.
      // We use a Map for fast CsvRow lookup by case_ref.
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
          current_balance: csv?.loan_amount ?? null, // balance at origination = full loan amount
          macro_event_ids: macroByDate.get(c.origination_date) ?? [],
        }
      })

      for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
        const { error: histErr } = await supabase
          .from('enterprise_case_history')
          .insert(snapshots.slice(i, i + BATCH_SIZE))

        if (histErr) {
          // Non-fatal: ingest succeeded, snapshot write failed. Log and continue.
          console.error('[FF-033] origination snapshot insert error:', histErr.message)
        }
      }
    }
  }

  const allFailed = [...failedRows, ...batchFailedRows]

  const summary: IngestSummary = {
    ingested: ingestedCount,
    failed: allFailed.length,
    failed_rows: allFailed,
    institution_id: instId,
    duration_ms: Date.now() - startMs,
  }

  return NextResponse.json(summary, { status: 200 })
}
