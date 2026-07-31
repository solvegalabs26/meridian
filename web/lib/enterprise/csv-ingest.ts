import type { CsvRow, FailedRow, LoanStatus } from './types'

const VALID_LOAN_STATUSES = new Set<LoanStatus>([
  'current', '30dpd', '60dpd', '90dpd', 'default', 'charged-off',
])

const REQUIRED_FIELDS = [
  'case_ref',
  'region',
  'fico_band',
  'income_band',
  'employment_type',
  'loan_amount',
  'interest_rate_pct',
  'ltv_ratio',
  'dti_ratio',
  'loan_term_months',
  'origination_date',
  'loan_status',
  'days_past_due',
  'current_balance',
  'payments_remaining',
] as const

// State-machine CSV line parser — handles quoted fields with embedded commas
// and escaped double-quotes ("" inside a quoted field).
export function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// Split CSV text into a header array and a row-of-values matrix.
// Normalises CRLF → LF, skips blank lines.
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim())
  const rows = lines.slice(1).map(parseCsvLine)
  return { headers, rows }
}

// Accepts YYYY-MM-DD and MM/DD/YYYY. Returns YYYY-MM-DD or null.
export function normalizeDate(raw: string): string | null {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(t + 'T12:00:00Z')
    return isNaN(d.getTime()) ? null : t
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const iso = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
    const d = new Date(iso + 'T12:00:00Z')
    return isNaN(d.getTime()) ? null : iso
  }
  return null
}

function positiveFloat(raw: string, field: string): { v: number } | { err: string } {
  const n = parseFloat(raw.trim())
  if (!isFinite(n) || n <= 0) return { err: `${field} must be a positive number (got "${raw}")` }
  return { v: n }
}

function nonNegInt(raw: string, field: string): { v: number } | { err: string } {
  const n = parseFloat(raw.trim())
  if (!isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return { err: `${field} must be a non-negative integer (got "${raw}")` }
  }
  return { v: n }
}

// Validates one CSV row. Returns either a typed CsvRow or a FailedRow with
// the reason for rejection. rowNumber is 1-based (header is row 0).
export function validateAndParseRow(
  headers: string[],
  values: string[],
  rowNumber: number
): { valid: CsvRow } | { failed: FailedRow } {
  const raw: Record<string, string> = {}
  for (let i = 0; i < headers.length; i++) {
    raw[headers[i]] = values[i] ?? ''
  }

  const case_ref = raw['case_ref']?.trim() || undefined

  // Required-presence check
  for (const field of REQUIRED_FIELDS) {
    if (!raw[field] || raw[field].trim() === '') {
      return { failed: { row_number: rowNumber, case_ref, reason: `Missing required field: ${field}` } }
    }
  }

  // Positive numerics
  const loanAmtR = positiveFloat(raw.loan_amount, 'loan_amount')
  if ('err' in loanAmtR) return { failed: { row_number: rowNumber, case_ref, reason: loanAmtR.err } }

  const balanceR = positiveFloat(raw.current_balance, 'current_balance')
  if ('err' in balanceR) return { failed: { row_number: rowNumber, case_ref, reason: balanceR.err } }

  const rateR = positiveFloat(raw.interest_rate_pct, 'interest_rate_pct')
  if ('err' in rateR) return { failed: { row_number: rowNumber, case_ref, reason: rateR.err } }

  const ltvR = positiveFloat(raw.ltv_ratio, 'ltv_ratio')
  if ('err' in ltvR) return { failed: { row_number: rowNumber, case_ref, reason: ltvR.err } }

  const dtiR = positiveFloat(raw.dti_ratio, 'dti_ratio')
  if ('err' in dtiR) return { failed: { row_number: rowNumber, case_ref, reason: dtiR.err } }

  // Non-negative integers
  const termR = nonNegInt(raw.loan_term_months, 'loan_term_months')
  if ('err' in termR) return { failed: { row_number: rowNumber, case_ref, reason: termR.err } }

  const dpdR = nonNegInt(raw.days_past_due, 'days_past_due')
  if ('err' in dpdR) return { failed: { row_number: rowNumber, case_ref, reason: dpdR.err } }

  const paymentsR = nonNegInt(raw.payments_remaining, 'payments_remaining')
  if ('err' in paymentsR) return { failed: { row_number: rowNumber, case_ref, reason: paymentsR.err } }

  // Date
  const origDate = normalizeDate(raw.origination_date)
  if (!origDate) {
    return { failed: { row_number: rowNumber, case_ref, reason: `origination_date is not a valid date (got "${raw.origination_date}")` } }
  }

  // loan_status enum
  const status = raw.loan_status.trim() as LoanStatus
  if (!VALID_LOAN_STATUSES.has(status)) {
    return { failed: { row_number: rowNumber, case_ref, reason: `Invalid loan_status "${raw.loan_status}" — must be one of: ${Array.from(VALID_LOAN_STATUSES).join(', ')}` } }
  }

  // Extra fields: everything not in REQUIRED_FIELDS
  const requiredSet = new Set<string>(REQUIRED_FIELDS)
  const extra_fields: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!requiredSet.has(k)) extra_fields[k] = v
  }

  return {
    valid: {
      case_ref: raw.case_ref.trim(),
      region: raw.region.trim(),
      fico_band: raw.fico_band.trim(),
      income_band: raw.income_band.trim(),
      employment_type: raw.employment_type.trim(),
      loan_amount: loanAmtR.v,
      interest_rate_pct: rateR.v,
      ltv_ratio: ltvR.v,
      dti_ratio: dtiR.v,
      loan_term_months: termR.v,
      origination_date: origDate,
      loan_status: status,
      days_past_due: dpdR.v,
      current_balance: balanceR.v,
      payments_remaining: paymentsR.v,
      extra_fields,
    },
  }
}
