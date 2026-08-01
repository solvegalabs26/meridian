#!/usr/bin/env npx tsx
/**
 * FF-035-A: Ingest the 15-account trial portfolio into demo-auto-finance.
 * Run: npx tsx scripts/ingest-trial-portfolio.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { parseCsv, validateAndParseRow } from '../lib/enterprise/csv-ingest'
import type { CsvRow, FailedRow } from '../lib/enterprise/types'

// Load .env.local manually (dotenv not available as a direct dep)
const envPath = path.join(__dirname, '../.env.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const INSTITUTION_ID = 'a1b2c3d4-0000-0000-0000-0000000000de'
const BATCH_SIZE = 100

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const csvPath = path.join(__dirname, 'trial_portfolio_15.csv')
  const csvText = fs.readFileSync(csvPath, 'utf-8')
  const { headers, rows } = parseCsv(csvText)

  console.log(`Parsed ${rows.length} data rows from CSV`)

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

  console.log(`Valid: ${validRows.length}, Failed: ${failedRows.length}`)
  if (failedRows.length > 0) {
    console.error('Failed rows:', JSON.stringify(failedRows, null, 2))
    process.exit(1)
  }

  // Upsert cases
  let ingestedCount = 0
  const upserted: { id: string; case_ref: string; origination_date: string }[] = []

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE)
    const records = batch.map(row => ({
      institution_id: INSTITUTION_ID,
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

    const { data, error } = await supabase
      .from('enterprise_cases')
      .upsert(records, { onConflict: 'institution_id,case_ref' })
      .select('id, case_ref, origination_date')

    if (error) { console.error('Upsert error:', error.message); process.exit(1) }
    ingestedCount += data?.length ?? 0
    upserted.push(...(data ?? []))
  }

  console.log(`Upserted ${ingestedCount} cases`)

  // Origination snapshots for new cases
  const allCaseIds = upserted.map(c => c.id)
  const { data: existing } = await supabase
    .from('enterprise_case_history')
    .select('case_id')
    .in('case_id', allCaseIds)
    .eq('snapshot_type', 'origination')

  const existingSet = new Set((existing ?? []).map((r: { case_id: string }) => r.case_id))
  const newCases = upserted.filter(c => !existingSet.has(c.id))
  console.log(`${newCases.length} cases need origination snapshots`)

  if (newCases.length > 0) {
    const uniqueDates = Array.from(new Set(newCases.map(c => c.origination_date)))
    const macroByDate = new Map<string, string[]>()

    await Promise.all(uniqueDates.map(async (date) => {
      const { data: events } = await supabase
        .from('enterprise_macro_events')
        .select('id')
        .gte('event_date', shiftDate(date, -90))
        .lte('event_date', shiftDate(date, 90))
      macroByDate.set(date, (events ?? []).map((e: { id: string }) => e.id))
    }))

    const csvRowByRef = new Map(validRows.map(r => [r.case_ref, r]))

    const snapshots = newCases.map(c => {
      const csv = csvRowByRef.get(c.case_ref)
      return {
        case_id: c.id,
        institution_id: INSTITUTION_ID,
        case_ref: c.case_ref,
        snapshot_at: `${c.origination_date}T00:00:00.000Z`,
        snapshot_type: 'origination' as const,
        loan_status: csv?.loan_status ?? null,
        days_past_due: csv?.days_past_due ?? 0,
        current_balance: csv?.loan_amount ?? null,
        macro_event_ids: macroByDate.get(c.origination_date) ?? [],
      }
    })

    const { error: histErr } = await supabase
      .from('enterprise_case_history')
      .insert(snapshots)

    if (histErr) { console.error('Snapshot insert error:', histErr.message); process.exit(1) }
    console.log(`Inserted ${snapshots.length} origination snapshots`)

    // Log macro event coverage
    for (const s of snapshots) {
      const count = s.macro_event_ids.length
      if (count > 0) console.log(`  ${s.case_ref} (${s.snapshot_at.split('T')[0]}): ${count} macro events`)
    }
  }

  // Status-change snapshots for delinquent accounts
  const delinquentRefs = ['TC-A001','TC-A002','TC-A003','TC-A004','TC-A005','TC-C002']
  const { data: delinquentCases, error: dErr } = await supabase
    .from('enterprise_cases')
    .select('id, institution_id, case_ref, loan_status, days_past_due, current_balance, payments_remaining, ltv_ratio, dti_ratio, fico_band')
    .eq('institution_id', INSTITUTION_ID)
    .in('case_ref', delinquentRefs)
    .neq('loan_status', 'current')

  if (dErr) { console.error('Delinquent case fetch error:', dErr.message); process.exit(1) }

  if (delinquentCases && delinquentCases.length > 0) {
    const statusSnapshots = delinquentCases.map((ec: {
      id: string; institution_id: string; case_ref: string; loan_status: string;
      days_past_due: number; current_balance: number; payments_remaining: number;
      ltv_ratio: number; dti_ratio: number; fico_band: string
    }) => ({
      case_id: ec.id,
      institution_id: ec.institution_id,
      case_ref: ec.case_ref,
      snapshot_at: new Date().toISOString(),
      snapshot_type: 'status_change' as const,
      loan_status: ec.loan_status,
      days_past_due: ec.days_past_due,
      current_balance: ec.current_balance,
      payments_remaining: ec.payments_remaining,
      ltv_ratio: ec.ltv_ratio,
      dti_ratio: ec.dti_ratio,
      fico_band: ec.fico_band,
      prior_status: 'current',
      prior_dpd: 0,
      notes: 'Current-state snapshot added at trial portfolio load — reflects present delinquency status.',
    }))

    const { error: scErr } = await supabase
      .from('enterprise_case_history')
      .insert(statusSnapshots)

    if (scErr) { console.error('Status-change snapshot error:', scErr.message); process.exit(1) }
    console.log(`Inserted ${statusSnapshots.length} status_change snapshots`)
  }

  console.log('\n✓ Trial portfolio ingest complete')
}

main().catch(e => { console.error(e); process.exit(1) })
