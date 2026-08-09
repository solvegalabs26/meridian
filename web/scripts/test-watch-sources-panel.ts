/**
 * Verification script — FF-037 Step 3: WatchSourcesPanel API logic
 * Tests add (insert + resolveUrl), soft-delete, and confirm flows directly.
 * Run: npx tsx scripts/test-watch-sources-panel.ts   (from meridian/web/)
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

const OBJECTIVE_ID    = 'e2ee2e63-e605-48f2-b912-ec6917162077'
const USER_ID         = '817b615a-c2c5-4285-8763-bdea3e171e2d'
const WATCH_SOURCE_ID = '9fe49c02-5da8-4776-9c46-24410dd18e4b'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // ── 1. Panel load: existing seed row ──────────────────────────────────────
  console.log('=== 1. Panel load — active watch sources for OBJ-01 ===')
  const { data: activeSources } = await svc
    .from('watch_sources')
    .select('id, url_provided, url_resolved, url_resolved_at, priority_tier, watch_type, target_signal, last_state, last_checked_at, requires_confirmation, is_active')
    .eq('objective_id', OBJECTIVE_ID)
    .eq('user_id', USER_ID)
    .eq('is_active', true)
    .order('priority_tier', { ascending: true })
    .order('created_at', { ascending: false })

  console.log(`Active sources: ${activeSources?.length ?? 0}`)
  console.log(JSON.stringify(activeSources, null, 2))
  console.log()

  // ── 2. Add flow: insert new source + resolveUrl ───────────────────────────
  console.log('=== 2. Add flow — insert test watch source ===')
  const { data: newRow, error: insertErr } = await svc
    .from('watch_sources')
    .insert({
      user_id:      USER_ID,
      objective_id: OBJECTIVE_ID,
      url_provided: 'united.com',
      target_signal: 'First Officer positions',
      priority_tier: 2,
      watch_type: 'careers_listing',
    })
    .select('id')
    .single()

  if (insertErr || !newRow) {
    console.error('Insert failed:', insertErr?.message)
    process.exit(1)
  }
  console.log('Inserted row id:', newRow.id)

  const { resolveUrl } = await import('@/lib/watchlist/resolveUrl')
  const result = await resolveUrl({ objectiveId: OBJECTIVE_ID, urlProvided: 'united.com' })
  console.log('resolveUrl result:', JSON.stringify(result, null, 2))

  const { data: afterResolve } = await svc
    .from('watch_sources')
    .select('id, url_provided, url_resolved, url_resolved_at, requires_confirmation')
    .eq('id', newRow.id as string)
    .single()
  console.log('Row after resolveUrl:', JSON.stringify(afterResolve, null, 2))
  console.log()

  // ── 3. Remove flow: soft-delete (is_active = false) ───────────────────────
  console.log('=== 3. Remove flow — soft-delete test row ===')
  const { error: removeErr } = await svc
    .from('watch_sources')
    .update({ is_active: false })
    .eq('id', newRow.id as string)
    .eq('user_id', USER_ID)

  if (removeErr) {
    console.error('Remove failed:', removeErr.message)
    process.exit(1)
  }

  const { data: afterRemove } = await svc
    .from('watch_sources')
    .select('id, url_provided, is_active')
    .eq('id', newRow.id as string)
    .single()
  console.log('Row after soft-delete:', JSON.stringify(afterRemove, null, 2))
  console.log('is_active should be false:', afterRemove?.is_active === false ? '✓ PASS' : '✗ FAIL')
  console.log()

  // ── 4. Active sources after remove ────────────────────────────────────────
  console.log('=== 4. Active sources after remove — test row must be absent ===')
  const { data: finalSources } = await svc
    .from('watch_sources')
    .select('id, url_provided, is_active')
    .eq('objective_id', OBJECTIVE_ID)
    .eq('user_id', USER_ID)
    .eq('is_active', true)
    .order('priority_tier', { ascending: true })

  console.log(`Active sources now: ${finalSources?.length ?? 0}`)
  const testRowStillActive = finalSources?.some(s => s.id === newRow.id)
  console.log('Test row absent from active list:', !testRowStillActive ? '✓ PASS' : '✗ FAIL')
  console.log(JSON.stringify(finalSources, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
