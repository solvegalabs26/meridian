import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, message, source } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 })
    }
    if (message.trim().length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 })
    }

    const adminClient = createServiceClient()
    const { error: dbError } = await adminClient
      .from('support_messages')
      .insert({
        email: email.trim().toLowerCase(),
        message: message.trim(),
        source: source || 'unknown',
        is_read: false,
      })

    if (dbError) {
      console.error('[FF-023] DB insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })

  } catch (err) {
    console.error('[FF-023] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
