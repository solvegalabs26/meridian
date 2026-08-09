/**
 * Verification script — FF-037 Steps 6+7: Alert banner data + email delivery
 * Run: npx tsx scripts/test-alert-delivery.ts   (from meridian/web/)
 *
 * Checks:
 *  1. Critical unseen alert exists in DB for Jason's account
 *  2. API route query returns correct shape (alert + objective title)
 *  3. markAlertSeen logic writes user_seen_at to DB
 *  4. Banner disappears (user_seen_at IS NOT NULL) after mark-seen
 *  5. Insert fresh alert row — banner reappears (new unseen critical alert)
 *  6. sendWatchAlert fires to jason@solvega.ai (email received = manual check)
 *  7. Trial tier gate: email suppressed for trial accounts
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

const USER_ID      = '817b615a-c2c5-4285-8763-bdea3e171e2d'
const OBJECTIVE_ID = 'e2ee2e63-e605-48f2-b912-ec6917162077'
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

async function main() {
  // ── Check 1: Critical unseen alert exists ─────────────────────────────────
  console.log('=== Check 1: Critical unseen alert in DB ===')
  const { data: alerts } = await svc
    .from('watch_alerts')
    .select('id, alert_level, signal_summary, action_text, direct_url, objective_id, user_seen_at, confidence')
    .eq('user_id', USER_ID)
    .is('user_seen_at', null)
    .eq('alert_level', 'critical')
    .order('created_at', { ascending: false })
    .limit(1)

  const alert = alerts?.[0]
  check('Check 1: critical alert row exists', !!alert)
  check('Check 1: user_seen_at is null', alert?.user_seen_at === null)
  console.log('  Alert id:', alert?.id)
  console.log('  Summary:', alert?.signal_summary?.slice(0, 80))
  console.log()

  // ── Check 2: API route shape — objective title lookup ────────────────────
  console.log('=== Check 2: API route query returns objective title ===')
  let objectiveTitle = ''
  if (alert?.objective_id) {
    const { data: obj } = await svc
      .from('objectives')
      .select('title')
      .eq('id', alert.objective_id as string)
      .single()
    objectiveTitle = (obj?.title as string | undefined) ?? ''
  }

  const { count: unseenCount } = await svc
    .from('watch_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .is('user_seen_at', null)

  check('Check 2: objective title resolved', objectiveTitle.length > 0, objectiveTitle)
  check('Check 2: unseen count ≥ 1', (unseenCount ?? 0) >= 1, String(unseenCount))
  console.log('  API response shape:', JSON.stringify({
    id: alert?.id?.slice(0, 8) + '...',
    signal_summary: alert?.signal_summary?.slice(0, 60) + '...',
    action_text: alert?.action_text?.slice(0, 60) + '...',
    direct_url: alert?.direct_url,
    objective_title: objectiveTitle,
    unseen_count: unseenCount,
  }, null, 2))
  console.log()

  // ── Check 3: markAlertSeen logic — writes user_seen_at ───────────────────
  console.log('=== Check 3: markAlertSeen writes user_seen_at ===')
  if (!alert) {
    console.log('  [skip] no alert to mark')
  } else {
    const { error: markErr } = await svc
      .from('watch_alerts')
      .update({ user_seen_at: new Date().toISOString() })
      .eq('id', alert.id as string)
      .eq('user_id', USER_ID)

    check('Check 3: update succeeded', !markErr, markErr?.message)

    const { data: afterMark } = await svc
      .from('watch_alerts')
      .select('user_seen_at')
      .eq('id', alert.id as string)
      .single()

    check('Check 3: user_seen_at written', !!afterMark?.user_seen_at, afterMark?.user_seen_at ?? 'null')
  }
  console.log()

  // ── Check 4: Banner disappears — no critical unseen after mark ────────────
  console.log('=== Check 4: No critical unseen after mark-seen ===')
  const { data: afterAlerts } = await svc
    .from('watch_alerts')
    .select('id')
    .eq('user_id', USER_ID)
    .is('user_seen_at', null)
    .eq('alert_level', 'critical')
    .limit(1)

  check('Check 4: no critical unseen alerts remain', (afterAlerts?.length ?? 1) === 0)
  console.log()

  // ── Check 5: Insert fresh alert — banner reappears ────────────────────────
  console.log('=== Check 5: Insert fresh alert → banner reappears ===')
  const { data: newAlert, error: insertErr } = await svc
    .from('watch_alerts')
    .insert({
      user_id: USER_ID,
      watch_source_id: WATCH_SOURCE_ID,
      objective_id: OBJECTIVE_ID,
      alert_level: 'critical',
      signal_summary: 'First Officer positions are now listed on the Alaska Airlines careers page.',
      action_text: 'Review the listings and submit your application through the careers portal.',
      direct_url: 'https://careers.alaskaair.com',
      confidence: 92,
    })
    .select('id')
    .single()

  check('Check 5: fresh alert inserted', !insertErr && !!newAlert, insertErr?.message)

  const { data: reappearedAlerts } = await svc
    .from('watch_alerts')
    .select('id')
    .eq('user_id', USER_ID)
    .is('user_seen_at', null)
    .eq('alert_level', 'critical')
    .limit(1)

  check('Check 5: critical unseen alert now exists (banner would reappear)', (reappearedAlerts?.length ?? 0) > 0)
  console.log('  New alert id:', newAlert?.id)
  console.log()

  // ── Check 6: Send real email to jason@solvega.ai ──────────────────────────
  console.log('=== Check 6: sendWatchAlert fires to jason@solvega.ai ===')
  const { sendWatchAlert } = await import('@/lib/email/sendWatchAlert')
  await sendWatchAlert({
    to: 'jason@solvega.ai',
    objectiveTitle: 'Alaska Airlines First Officer (OBJ-01)',
    signalSummary: 'First Officer positions are now listed on the Alaska Airlines careers page.',
    actionText: 'Review the listings and submit your application through the careers portal.',
    directUrl: 'https://careers.alaskaair.com',
  })
  check('Check 6: sendWatchAlert called without throwing', true, 'verify inbox manually at jason@solvega.ai')
  console.log()

  // ── Check 7: Trial tier gate — email suppressed ───────────────────────────
  console.log('=== Check 7: Trial tier gate — email suppressed ===')
  const { getEffectiveTier } = await import('@/lib/tiers')

  const trialProfile = { tier: 'trial', account_type: null }
  const explorerProfile = { tier: 'trial', account_type: 'alpha_personal' }
  const acceleratorProfile = { tier: 'accelerator', account_type: null }

  const trialTier = getEffectiveTier(trialProfile)
  const explorerTier = getEffectiveTier(explorerProfile)
  const acceleratorTier = getEffectiveTier(acceleratorProfile)

  const trialShouldEmail = trialTier !== 'trial'
  const explorerCritical = explorerTier !== 'trial'
  const explorerHigh = explorerTier === 'accelerator' || explorerTier === 'command'
  const accelHigh = acceleratorTier === 'accelerator' || acceleratorTier === 'command'

  check('Check 7: trial → no email (critical)', !trialShouldEmail, `tier=${trialTier}`)
  check('Check 7: alpha_personal (explorer) → email on critical', explorerCritical, `tier=${explorerTier}`)
  check('Check 7: alpha_personal (explorer) → NO email on high', !explorerHigh, `tier=${explorerTier}`)
  check('Check 7: accelerator → email on high', accelHigh, `tier=${acceleratorTier}`)
  console.log()

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════')
  console.log(`  PASSED: ${passed}   FAILED: ${failed}`)
  console.log('═══════════════════════════════════════')
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
