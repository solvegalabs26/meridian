import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncCalendarConnection } from '@/lib/calendar/syncCalendarConnection'
import { tierAtLeast } from '@/lib/tiers'

export const dynamic = 'force-dynamic'

// Quick scheme+port check before DB insert — full DNS+SSRF guard happens in syncCalendarConnection
function schemePortOk(url: string): boolean {
  try {
    const normalized = url.replace(/^webcal:\/\//i, 'https://')
    const parsed = new URL(normalized)
    if (parsed.protocol !== 'https:') return false
    if (parsed.hostname.toLowerCase() === 'localhost') return false
    const port = parsed.port || '443'
    return port === '443'
  } catch {
    return false
  }
}

// GET — list connections; never returns ical_url
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: connections } = await supabase
    .from('calendar_connections')
    .select('id, provider, label, is_active, sync_status, last_synced_at, last_error, event_count, created_at')
    .eq('user_id', user.id)
    .order('created_at')

  return NextResponse.json({ connections: connections ?? [] })
}

// POST — add a connection, tier-gated Explorer+
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, account_type')
    .eq('id', user.id)
    .single()

  if (!tierAtLeast({ tier: profile?.tier ?? null, account_type: profile?.account_type ?? null }, 'explorer')) {
    return NextResponse.json({ error: 'Explorer plan or above required to connect a calendar' }, { status: 403 })
  }

  const body = await request.json() as { ical_url?: string; label?: string }
  const rawUrl = body.ical_url?.trim() ?? ''
  const label = body.label?.trim() || null

  if (!rawUrl) return NextResponse.json({ error: 'ical_url is required' }, { status: 400 })

  if (!schemePortOk(rawUrl)) {
    return NextResponse.json({ error: 'Calendar URL is not reachable or not allowed' }, { status: 400 })
  }

  const { data: connection, error: insertError } = await supabase
    .from('calendar_connections')
    .insert({ user_id: user.id, provider: 'ical', ical_url: rawUrl, label, sync_status: 'pending' })
    .select('id')
    .single()

  if (insertError || !connection) {
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
  }

  // Trigger sync inline — errors are stored on the connection row, not thrown
  const syncResult = await syncCalendarConnection(supabase, user.id, connection.id)

  const { data: updated } = await supabase
    .from('calendar_connections')
    .select('id, provider, label, is_active, sync_status, last_synced_at, last_error, event_count, created_at')
    .eq('id', connection.id)
    .single()

  return NextResponse.json({ connection: updated, sync: syncResult })
}

// DELETE ?id= — remove a connection (cascade removes its calendar_events)
export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // RLS enforces ownership; explicit check as belt-and-suspenders
  const { data: existing } = await supabase
    .from('calendar_connections')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  await supabase.from('calendar_connections').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
