import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof (body as Record<string, unknown>)?.email === 'string'
    ? ((body as Record<string, unknown>).email as string).trim().toLowerCase()
    : ''

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const supabase = createClient()

  const { error } = await supabase
    .from('prelaunch_signups')
    .insert({ email, source: 'landing_home' })

  if (error) {
    // Unique violation — already on list
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Already on list' }, { status: 409 })
    }
    console.error('[prelaunch] insert error:', error.code, error.message)
    return NextResponse.json({ error: 'Something went wrong — please try again.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Subscribed' }, { status: 201 })
}
