/**
 * Verification script — FF-037 Prompt hardening
 * Run: npx tsx scripts/test-prompt-hardening.ts   (from meridian/web/)
 *
 * Checks:
 *  1. Unrelated Alaska Airlines page content → signal_found: false
 *  2. First Officer listings page content    → signal_found: true
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

const TARGET_SIGNAL = 'First Officer job listings are open on the Alaska Airlines careers page'
const WATCH_TYPE    = 'careers_listing'

// Mimics the exact prompt built in checkWatchSources.ts after hardening
function buildPrompt(pageContent: string): string {
  return [
    `TARGET SIGNAL: ${TARGET_SIGNAL}`,
    `TARGET SIGNAL (what specifically to look for): ${TARGET_SIGNAL}`,
    '',
    "NOISE FILTER: A page change that does not directly relate to the target signal above is NOT a confirmed signal. Company news, product updates, unrelated job categories, or structural page changes must return signal_confirmed: false. Only return signal_confirmed: true if the page content directly evidences progress toward the objective's success condition as defined by the target signal.",
    `WATCH TYPE: ${WATCH_TYPE}`,
    '',
    'PAGE CONTENT (extracted):',
    pageContent.slice(0, 6000),
    '',
    'Return JSON only:',
    '{ "signal_found": boolean, "confidence": number (0-100), "rationale": string, "signal_summary": string (1 sentence describing what was found, or "No signal detected"), "action_text": string (what the user should do next, 1 sentence) }',
  ].join('\n')
}

type SonnetPayload = {
  signal_found: boolean
  confidence: number
  rationale: string
  signal_summary: string
  action_text: string
}

async function runValidation(label: string, pageContent: string): Promise<SonnetPayload> {
  console.log(`\n=== ${label} ===`)
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system:
      "You are Meridian's signal detection engine. Analyze extracted webpage content and determine whether a target signal is present. Return ONLY valid JSON — no markdown, no preamble, no explanation outside the JSON.",
    messages: [{ role: 'user', content: buildPrompt(pageContent) }],
  })

  const rawText = msg.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let payload: SonnetPayload
  try {
    payload = JSON.parse(rawText) as SonnetPayload
  } catch {
    console.log(`  Raw response: ${rawText.slice(0, 300)}`)
    throw new Error(`Non-JSON response from model`)
  }

  console.log(`  signal_found: ${payload.signal_found}`)
  console.log(`  confidence:   ${payload.confidence}`)
  console.log(`  rationale:    ${payload.rationale.slice(0, 120)}`)
  return payload
}

// ── Scenario 1: Unrelated Alaska Airlines content ────────────────────────────
const UNRELATED_CONTENT = `
Alaska Airlines Newsroom

Alaska Airlines Announces New Nonstop Service to Cancun
Seattle, WA — Alaska Airlines today announced the addition of three new nonstop
routes from Seattle-Tacoma International Airport, expanding its network throughout
North America.

"We're thrilled to connect our guests with even more destinations," said Ben Minicucci,
President and CEO of Alaska Airlines. "This expansion reflects our commitment to providing
affordable, reliable travel across the West Coast and beyond."

New routes include:
- Seattle (SEA) to Cancun (CUN), starting June 15
- Portland (PDX) to Cabo San Lucas (SJD), starting July 1
- Anchorage (ANC) to Palm Springs (PSP), starting July 20

Alaska Airlines Mileage Plan members will be able to earn and redeem miles on all new routes.
Fares start at $199 one-way.

About Alaska Airlines
Alaska Airlines, together with its regional partners, flies more than 40 million guests per year
to more than 115 destinations. The airline is known for its outstanding customer service, innovative
technology, and award-winning loyalty program. Learn more about Alaska Airlines at alaskaair.com.

Press Contact: media@alaskaair.com
`

// ── Scenario 2: First Officer listings content ────────────────────────────────
const FIRST_OFFICER_CONTENT = `
Alaska Airlines Careers — Flight Operations

Open Positions — Pilots

First Officer — Boeing 737 (REQ-20260045)
Location: Seattle, WA (SEA) — Hub based
Status: OPEN — Actively Recruiting
Posted: August 5, 2026

We are currently accepting applications for First Officer candidates to join our 737 fleet.
Minimum requirements include:
- FAA Airline Transport Pilot (ATP) certificate
- 1,500 total flight hours
- 250 hours multi-engine
- Current First Class Medical Certificate

First Officer — Boeing 737 MAX (REQ-20260046)
Location: Los Angeles, CA (LAX)
Status: OPEN — Actively Recruiting
Posted: August 6, 2026

First Officer — Embraer E175 (REQ-20260047)
Location: Portland, OR (PDX) — Regional Ops
Status: OPEN
Posted: August 7, 2026

Apply now at careers.alaskaair.com/pilots

For questions, contact our pilot recruiting team at pilotrecruiting@alaskaair.com
Pilot Recruiting — 1-800-654-5669
`

async function main() {
  const result1 = await runValidation(
    'Test 1: Unrelated Alaska Airlines content (news / routes)',
    UNRELATED_CONTENT,
  )
  check(
    'Test 1: signal_found is false for unrelated content',
    result1.signal_found === false,
    `signal_found=${result1.signal_found}, confidence=${result1.confidence}`,
  )

  const result2 = await runValidation(
    'Test 2: First Officer listings content',
    FIRST_OFFICER_CONTENT,
  )
  check(
    'Test 2: signal_found is true for First Officer listings',
    result2.signal_found === true,
    `signal_found=${result2.signal_found}, confidence=${result2.confidence}`,
  )

  console.log('\n═══════════════════════════════════════')
  console.log(`  PASSED: ${passed}   FAILED: ${failed}`)
  console.log('═══════════════════════════════════════')
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
