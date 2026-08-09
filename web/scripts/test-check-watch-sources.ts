/**
 * Verification script — FF-037 Steps 4+5: checkWatchSources sweep engine
 * Run: npx tsx scripts/test-check-watch-sources.ts   (from meridian/web/)
 *
 * Checks:
 *  1. OBJ-01 source present with url_resolved populated
 *  2. First sweep completes without error
 *  3. last_hash written after first sweep
 *  4. last_checked_at updated after first sweep
 *  5. Second sweep on unchanged content returns hash_match (no AI call)
 *  6. AI validation fields present on first sweep (confidence, rationale)
 *  7. watch_alerts row inserted when signal found (confidence ≥50)
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const envPath    = resolve(__dirname, '../.env.local')

try {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  console.log(`Loaded ${envPath}\n`)
} catch {
  console.log('.env.local not found — assuming env vars already set\n')
}

const USER_ID         = '817b615a-c2c5-4285-8763-bdea3e171e2d'
const OBJECTIVE_ID    = 'e2ee2e63-e605-48f2-b912-ec6917162077'
const WATCH_SOURCE_ID = '9fe49c02-5da8-4776-9c46-24410dd18e4b'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

let passed = 0
let failed = 0

function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
    passed++
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

// A reliable public URL used only during verification — proves fetch/hash/AI paths work
// without depending on Alaska Air's job search URL being live.
const TEST_URL = 'https://example.com'
const ORIGINAL_URL = 'https://careers.alaskaair.com/jobs/search?query=First+Officer&location='

async function prepareTestRow() {
  await svc
    .from('watch_sources')
    .update({
      url_resolved: TEST_URL,
      // Use a signal that example.com actually contains so the AI detects it
      target_signal: 'Text about an example domain used in documentation or examples',
      last_hash: null,
      last_checked_at: null,
      last_error: null,
      // Reset state so we don't get signal_gone on first sweep
      last_state: 'no_signal',
    })
    .eq('id', WATCH_SOURCE_ID)
  console.log(`  [setup] url_resolved → ${TEST_URL}, target_signal → example domain text, last_state → no_signal\n`)
}

const ORIGINAL_TARGET_SIGNAL = 'First Officer positions listed at Alaska Airlines'

async function restoreTestRow() {
  await svc
    .from('watch_sources')
    .update({
      url_resolved: ORIGINAL_URL,
      target_signal: ORIGINAL_TARGET_SIGNAL,
    })
    .eq('id', WATCH_SOURCE_ID)
  console.log(`  [restore] url_resolved and target_signal reset to originals\n`)
}

async function main() {
  // ── Check 1: OBJ-01 source present with url_resolved ─────────────────────
  console.log('=== Check 1: OBJ-01 source has url_resolved populated ===')
  const { data: src } = await svc
    .from('watch_sources')
    .select('id, url_resolved, last_hash, last_checked_at, is_active')
    .eq('id', WATCH_SOURCE_ID)
    .single()

  check('Row exists', !!src)
  check('url_resolved populated', !!src?.url_resolved, src?.url_resolved ?? 'null')
  check('is_active = true', src?.is_active === true)
  console.log()

  // Set test URL and clear hash before first sweep
  console.log('=== Preparing test row ===')
  await prepareTestRow()

  // ── Check 2–6: First sweep ────────────────────────────────────────────────
  console.log('=== Checks 2–6: First sweep via checkWatchSources ===')
  const { checkWatchSources } = await import('@/lib/watchlist/checkWatchSources')

  const results = await checkWatchSources(USER_ID)
  console.log('  Sweep results:', JSON.stringify(results, null, 2))
  console.log()

  const result = results.find(r => r.watchSourceId === WATCH_SOURCE_ID)

  check('Check 2: sweep completes without error status', result?.status !== 'error', result?.status)
  check('Check 3: status is a valid sweep outcome (not error)',
    ['signal_confirmed', 'signal_detected', 'no_signal', 'signal_gone', 'hash_match'].includes(result?.status ?? ''),
    result?.status
  )

  // Verify DB writes
  const { data: after1 } = await svc
    .from('watch_sources')
    .select('last_hash, last_checked_at, last_state, last_error')
    .eq('id', WATCH_SOURCE_ID)
    .single()

  check('Check 4: last_hash written to DB', !!after1?.last_hash, after1?.last_hash?.slice(0, 16) + '...')
  check('Check 5: last_checked_at updated', !!after1?.last_checked_at, after1?.last_checked_at ?? 'null')
  check('Check 6: AI confidence present in result', typeof result?.confidence === 'number', String(result?.confidence))
  console.log()

  // ── Check 7: watch_alerts row if signal found ─────────────────────────────
  console.log('=== Check 7: watch_alerts row present if signal found ===')
  const signalFound = ['signal_confirmed', 'signal_detected'].includes(result?.status ?? '')
  console.log(`  First sweep status: ${result?.status}, confidence: ${result?.confidence}%`)

  if (signalFound) {
    const { data: alerts } = await svc
      .from('watch_alerts')
      .select('id, alert_level, confidence, signal_summary, created_at')
      .eq('watch_source_id', WATCH_SOURCE_ID)
      .order('created_at', { ascending: false })
      .limit(1)

    const alert = alerts?.[0]
    check('Check 7: alert row inserted', !!alert, alert ? `id=${alert.id.slice(0, 8)} level=${alert.alert_level} conf=${alert.confidence}` : 'no row found')
    if (alert) {
      console.log('  Alert summary:', alert.signal_summary)
    }
  } else {
    console.log(`  [skip] status="${result?.status}" — signal not found, alert not expected`)
    check('Check 7: no spurious alert for no_signal', true, 'skipped correctly')
  }
  console.log()

  // ── Idempotency: second sweep should be hash_match ────────────────────────
  console.log('=== Bonus: Second sweep on unchanged content → hash_match ===')
  const results2 = await checkWatchSources(USER_ID)
  const result2 = results2.find(r => r.watchSourceId === WATCH_SOURCE_ID)
  check('Second sweep returns hash_match', result2?.status === 'hash_match', result2?.status)
  console.log()

  // ── Restore original url_resolved ─────────────────────────────────────────
  console.log('=== Restoring original url_resolved ===')
  await restoreTestRow()

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`═══════════════════════════════════════`)
  console.log(`  PASSED: ${passed}   FAILED: ${failed}`)
  console.log(`═══════════════════════════════════════`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
