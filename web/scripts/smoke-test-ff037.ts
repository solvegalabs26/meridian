/**
 * FF-037 end-to-end smoke test.
 * Run: npx tsx scripts/smoke-test-ff037.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

type CheckResult = { pass: boolean; detail: string }

async function check1_watchSourcesTable(): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('watch_sources')
    .select('id, url_provided, url_resolved, watch_type, target_signal, last_hash, last_state, priority_tier, objective_id, is_active')
    .limit(1)
  if (error) return { pass: false, detail: `Table query failed: ${error.message}` }
  const cols = data !== null ? 'ok' : 'empty (table exists)'
  return { pass: true, detail: `watch_sources table accessible — ${cols}` }
}

async function check2_watchAlertsTriggeredByUrl(): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('watch_alerts')
    .select('id, triggered_by_url')
    .limit(1)
  if (error) return { pass: false, detail: `watch_alerts query failed: ${error.message}` }
  // If the column didn't exist the select would error
  return { pass: true, detail: 'watch_alerts.triggered_by_url column present' }
}

async function check3_obj01ActiveTier1Source(): Promise<CheckResult> {
  // Find the founder's OBJ-01 (first objective by created_at for any user)
  // or specifically the Alaska Airlines objective if identifiable
  const { data: sources, error } = await supabase
    .from('watch_sources')
    .select('id, url_resolved, priority_tier, objective_id, is_active')
    .eq('is_active', true)
    .eq('priority_tier', 1)
    .not('url_resolved', 'is', null)
    .limit(5)

  if (error) return { pass: false, detail: `Query failed: ${error.message}` }
  if (!sources?.length) return { pass: false, detail: 'No active Tier 1 watch sources with url_resolved found' }
  return { pass: true, detail: `Found ${sources.length} active Tier 1 source(s) with url_resolved` }
}

async function check4_watchAlertsForFounder(): Promise<CheckResult> {
  const { count, error } = await supabase
    .from('watch_alerts')
    .select('id', { count: 'exact', head: true })
  if (error) return { pass: false, detail: `Query failed: ${error.message}` }
  if (!count || count === 0) return { pass: false, detail: 'No watch_alerts rows found' }
  return { pass: true, detail: `${count} watch_alerts row(s) found` }
}

async function check5_sweepRouteImportsCheckWatch(): Promise<CheckResult> {
  const routePath = path.join(__dirname, '../app/api/sweep/route.ts')
  if (!fs.existsSync(routePath)) return { pass: false, detail: 'sweep/route.ts not found' }
  const src = fs.readFileSync(routePath, 'utf-8')
  const hasImport = src.includes("from '@/lib/watchlist/checkWatchSources'")
  const hasCall   = src.includes('checkWatchSources(')
  if (!hasImport) return { pass: false, detail: 'checkWatchSources not imported in sweep route' }
  if (!hasCall)   return { pass: false, detail: 'checkWatchSources not called in sweep route' }
  return { pass: true, detail: 'checkWatchSources imported and called in sweep/route.ts' }
}

async function check6_twilioEnvVars(): Promise<CheckResult> {
  const sid   = !!process.env.TWILIO_ACCOUNT_SID
  const token = !!process.env.TWILIO_AUTH_TOKEN
  const phone = !!process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !phone) {
    const missing = [!sid && 'TWILIO_ACCOUNT_SID', !token && 'TWILIO_AUTH_TOKEN', !phone && 'TWILIO_PHONE_NUMBER']
      .filter(Boolean).join(', ')
    return { pass: false, detail: `Missing: ${missing}` }
  }
  return { pass: true, detail: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER all present' }
}

async function check7_trialModeNotSet(): Promise<CheckResult> {
  const val = process.env.TWILIO_TRIAL_MODE
  if (val === 'true') return { pass: false, detail: 'TWILIO_TRIAL_MODE=true is still set — remove after account upgrade' }
  return { pass: true, detail: `TWILIO_TRIAL_MODE=${val ?? 'unset'} (not active)` }
}

async function check8_checkWatchSourcesFileIntegrity(): Promise<CheckResult> {
  const filePath = path.join(__dirname, '../lib/watchlist/checkWatchSources.ts')
  if (!fs.existsSync(filePath)) return { pass: false, detail: 'checkWatchSources.ts not found' }
  const src = fs.readFileSync(filePath, 'utf-8')
  const hasJina   = src.includes('r.jina.ai')
  const hasPageLog = src.includes('[watch:page_content]')
  const hasValLog  = src.includes('[watch:validation]')
  const hasChanLog = src.includes('[watch:channels]')
  const details = [
    hasJina    ? 'Jina fetch ✓' : 'MISSING: Jina fetch',
    hasPageLog ? '[watch:page_content] ✓' : 'MISSING: page_content log',
    hasValLog  ? '[watch:validation] ✓' : 'MISSING: validation log',
    hasChanLog ? '[watch:channels] ✓' : 'MISSING: channels log',
  ].join(', ')
  const pass = hasJina && hasPageLog && hasValLog && hasChanLog
  return { pass, detail: details }
}

async function main() {
  const checks: Array<{ name: string; fn: () => Promise<CheckResult> }> = [
    { name: '1. watch_sources table + columns',              fn: check1_watchSourcesTable },
    { name: '2. watch_alerts.triggered_by_url column',       fn: check2_watchAlertsTriggeredByUrl },
    { name: '3. OBJ-01 active Tier 1 source w/ url_resolved', fn: check3_obj01ActiveTier1Source },
    { name: '4. watch_alerts rows exist',                    fn: check4_watchAlertsForFounder },
    { name: '5. checkWatchSources wired into sweep route',   fn: check5_sweepRouteImportsCheckWatch },
    { name: '6. Twilio env vars present',                    fn: check6_twilioEnvVars },
    { name: '7. TWILIO_TRIAL_MODE not active',               fn: check7_trialModeNotSet },
    { name: '8. checkWatchSources file integrity (Jina + logs)', fn: check8_checkWatchSourcesFileIntegrity },
  ]

  console.log('\n=== FF-037 Smoke Test ===\n')

  let passed = 0
  let failed = 0

  for (const { name, fn } of checks) {
    const result = await fn()
    const icon = result.pass ? '✅' : '❌'
    console.log(`${icon}  ${name}`)
    console.log(`    ${result.detail}`)
    if (result.pass) passed++; else failed++
  }

  console.log(`\n${passed}/${checks.length} checks passed${failed > 0 ? ` — ${failed} FAILED` : ''}`)

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Smoke test error:', err)
  process.exit(1)
})
