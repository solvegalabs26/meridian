/**
 * Verification — FF-037 Step 9: Web Push notification
 * Run AFTER enabling push in Settings UI so a subscription row exists.
 * Run: npx tsx scripts/test-push-alert.ts
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
} catch {
  console.log('.env.local not found — assuming env vars already set')
}

const USER_ID = '817b615a-c2c5-4285-8763-bdea3e171e2d'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function main() {
  const { data: subs, error } = await svc
    .from('push_subscriptions')
    .select('id, subscription, created_at')
    .eq('user_id', USER_ID)

  if (error) throw new Error(`DB error: ${error.message}`)

  console.log(`Found ${subs?.length ?? 0} push subscription(s):`)
  subs?.forEach(s => console.log(`  id=${s.id}  created=${s.created_at}`))

  if (!subs?.length) {
    console.log('No push subscriptions found — enable push in Settings UI first')
    process.exit(1)
  }

  const { sendPushAlert } = await import('@/lib/watchlist/sendPushAlert')

  await sendPushAlert({
    subscription: subs[0].subscription as import('web-push').PushSubscription,
    objectiveTitle: 'Alaska Airlines First Officer Hire',
    signalSummary: '13 First Officer positions now listed.',
    actionText: 'SUBMIT YOUR APPLICATION NOW.',
  })

  console.log('Push sent — confirm notification on device')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
