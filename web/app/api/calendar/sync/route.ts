import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncCalendarConnection } from '@/lib/calendar/syncCalendarConnection'
import { tierAtLeast } from '@/lib/tiers'

export const dynamic = 'force-dynamic'

const RATE_LIMIT_MS = 5 * 60 * 1000 // 5 minutes between syncs per connection

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
    return NextResponse.json({ error: 'Explorer plan or above required' }, { status: 403 })
  }

  const body = await request.json() as { connection_id?: string }
  const requestedId = body.connection_id ?? null

  // Resolve connection(s) to sync
  let connectionIds: string[]
  if (requestedId) {
    connectionIds = [requestedId]
  } else {
    const { data: active } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
    connectionIds = (active ?? []).map(c => c.id)
  }

  const results = []

  for (const connId of connectionIds) {
    // Load connection (confirms ownership via RLS)
    const { data: conn } = await supabase
      .from('calendar_connections')
      .select('id, last_synced_at')
      .eq('id', connId)
      .eq('user_id', user.id)
      .single()

    if (!conn) {
      results.push({ connection_id: connId, synced: false, event_count: 0, sync_status: 'error', last_error: 'Not found' })
      continue
    }

    // 5-minute rate limit per connection
    if (conn.last_synced_at) {
      const msSince = Date.now() - new Date(conn.last_synced_at).getTime()
      if (msSince < RATE_LIMIT_MS) {
        results.push({ connection_id: connId, synced: false, event_count: 0, sync_status: 'ok', last_error: null, message: 'Already up to date' })
        continue
      }
    }

    const result = await syncCalendarConnection(supabase, user.id, connId)
    results.push({ connection_id: connId, ...result })
  }

  // If single connection requested, return flat shape per spec
  if (requestedId && results.length === 1) {
    const r = results[0]
    return NextResponse.json({ synced: r.synced, event_count: r.event_count, sync_status: r.sync_status, last_error: r.last_error })
  }

  return NextResponse.json({ results })
}
