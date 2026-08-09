/**
 * Verification script — FF-037 Step 2: resolveUrl against OBJ-01 (Alaska Airlines FO)
 * Run: npx tsx scripts/test-resolve-url.ts   (from meridian/web/)
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { resolveUrl } from '@/lib/watchlist/resolveUrl'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const envPath    = resolve(__dirname, '../.env.local')

try {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  console.log(`Loaded ${envPath}\n`)
} catch {
  console.log('.env.local not found — assuming env vars are already set\n')
}

const OBJECTIVE_ID    = 'e2ee2e63-e605-48f2-b912-ec6917162077'
const URL_PROVIDED    = 'careers.alaskaair.com'
const WATCH_SOURCE_ID = '9fe49c02-5da8-4776-9c46-24410dd18e4b'

async function main() {
  console.log('=== resolveUrl — OBJ-01 Alaska Airlines FO ===')
  console.log(`objectiveId : ${OBJECTIVE_ID}`)
  console.log(`urlProvided : ${URL_PROVIDED}`)
  console.log()

  const result = await resolveUrl({ objectiveId: OBJECTIVE_ID, urlProvided: URL_PROVIDED })

  console.log('Result:')
  console.log(JSON.stringify(result, null, 2))
  console.log()

  // Confirm DB write via SELECT
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: row, error } = await supabase
    .from('watch_sources')
    .select('id, url_provided, url_resolved, url_resolved_at, requires_confirmation')
    .eq('id', WATCH_SOURCE_ID)
    .single()

  if (error) {
    console.error('SELECT failed:', error.message)
    process.exit(1)
  }

  console.log('=== DB confirmation SELECT ===')
  console.log(JSON.stringify(row, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
