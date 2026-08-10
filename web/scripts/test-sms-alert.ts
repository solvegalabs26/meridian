/**
 * Verification — FF-037 Step 8: SMS via Twilio
 * Run: npx tsx scripts/test-sms-alert.ts
 * Reads phone_number from Jason's profiles row automatically.
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

const USER_ID = '817b615a-c2c5-4285-8763-bdea3e171e2d'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function main() {
  // Read phone number from DB — avoids passing PII on the command line
  const { data: profile, error } = await svc
    .from('profiles')
    .select('phone_number, sms_alerts_enabled')
    .eq('id', USER_ID)
    .single()

  if (error) throw new Error(`DB error: ${error.message}`)
  if (!profile?.phone_number) throw new Error('phone_number not set in profiles for this user — set it in Supabase first')

  const to = process.env.TEST_PHONE_NUMBER ?? profile.phone_number as string

  console.log(`phone_number from DB: set (${to.length} chars)`)
  console.log(`sms_alerts_enabled:   ${profile.sms_alerts_enabled}`)
  console.log(`Sending SMS to ${to.slice(0, 3)}***${to.slice(-2)}...`)

  // Verify Twilio credentials are present before attempting send
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from) {
    throw new Error(
      `Twilio credentials missing from .env.local:\n` +
      `  TWILIO_ACCOUNT_SID: ${sid ? 'set' : 'MISSING'}\n` +
      `  TWILIO_AUTH_TOKEN:  ${token ? 'set' : 'MISSING'}\n` +
      `  TWILIO_PHONE_NUMBER: ${from ? 'set' : 'MISSING'}\n\n` +
      `Add these to .env.local (copied from Vercel) and re-run.`
    )
  }

  // Call Twilio directly so errors propagate (not swallowed)
  const twilio = (await import('twilio')).default
  const client = twilio(sid, token)
  const body = [
    `⚠ MERIDIAN ALERT — Alaska Airlines First Officer Hire`,
    '13 First Officer positions now listed across ANC, SFO, LAX, PDX, SAN, SEA.',
    'ACTION: SUBMIT YOUR APPLICATION NOW.',
    'https://careers.alaskaair.com/job-category/pilots/jobs/',
  ].join('\n\n')

  const msg = await client.messages.create({ body, to, from })
  console.log(`SMS sent — SID: ${msg.sid}  status: ${msg.status}`)
  console.log('Confirm received on device')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
