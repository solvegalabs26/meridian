import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(req: Request) {
  // Per-IP rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  if (!checkRateLimit(`prelaunch:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Please try again in a bit.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>

  // Honeypot — bots fill this, real users don't. Silent success to avoid teaching the bot.
  if (raw.website && String(raw.website).trim() !== '') {
    return NextResponse.json({ message: 'Subscribed' }, { status: 201 })
  }

  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const supabase = createClient()

  const { error } = await supabase
    .from('prelaunch_signups')
    .insert({ email, source: 'landing_home' })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Already on list' }, { status: 409 })
    }
    console.error('[prelaunch] insert error:', error.code, error.message)
    return NextResponse.json({ error: 'Something went wrong — please try again.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Subscribed' }, { status: 201 })
}
