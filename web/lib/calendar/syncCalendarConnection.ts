import { fetchIcsText, IcsFetchError } from './fetchIcs'
import { parseIcsEvents } from './parseIcs'
import { matchEventToObjectives } from './matchObjectives'
import type { createClient } from '@/lib/supabase/server'

type SupabaseUserClient = Awaited<ReturnType<typeof createClient>>

export interface SyncResult {
  synced: boolean
  event_count: number
  sync_status: 'ok' | 'error'
  last_error: string | null
}

export async function syncCalendarConnection(
  supabase: SupabaseUserClient,
  userId: string,
  connectionId: string
): Promise<SyncResult> {
  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('id, ical_url, is_active')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single()

  if (!conn || !conn.ical_url || !conn.is_active) {
    return { synced: false, event_count: 0, sync_status: 'error', last_error: 'Connection not found or inactive' }
  }

  const markError = async (msg: string) => {
    await supabase
      .from('calendar_connections')
      .update({ sync_status: 'error', last_error: msg, last_synced_at: new Date().toISOString(), event_count: 0, updated_at: new Date().toISOString() })
      .eq('id', connectionId)
    return { synced: false, event_count: 0, sync_status: 'error' as const, last_error: msg }
  }

  // Fetch ICS
  let icsText: string
  try {
    icsText = await fetchIcsText(conn.ical_url)
  } catch (err) {
    console.error('[meridian:sync] fetch error:', err instanceof Error ? err.message : String(err))
    const msg = err instanceof IcsFetchError ? err.message : 'Calendar URL is not reachable or not allowed'
    return markError(msg)
  }

  console.log('[meridian:sync] fetch returned, icsText length:', icsText?.length ?? 'undefined')

  // Parse events
  let parsedEvents: Awaited<ReturnType<typeof parseIcsEvents>>
  try {
    parsedEvents = await parseIcsEvents(icsText)
  } catch (err) {
    console.error('[meridian:sync] parse error:', err instanceof Error ? `${err.name}: ${err.message}` : String(err))
    return markError('Could not parse calendar data')
  }

  // Load active objectives for matching
  const { data: objectives } = await supabase
    .from('objectives')
    .select('id, title, signal_keywords')
    .eq('user_id', userId)
    .eq('status', 'active')

  const activeObjectives = (objectives ?? []).map(o => ({
    id: o.id,
    title: o.title as string,
    signal_keywords: o.signal_keywords as string[] | null,
  }))

  // Delete-then-reinsert (objective links recomputed each sync)
  await supabase.from('calendar_events').delete().eq('connection_id', connectionId)

  if (parsedEvents.length > 0) {
    const inserts = parsedEvents.map(e => ({
      user_id: userId,
      connection_id: connectionId,
      uid: e.uid,
      summary: e.summary,
      description: e.description,
      location: e.location,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      all_day: e.all_day,
      objective_ids: matchEventToObjectives(e, activeObjectives),
    }))
    await supabase.from('calendar_events').insert(inserts)
  }

  const now = new Date().toISOString()
  await supabase
    .from('calendar_connections')
    .update({ sync_status: 'ok', last_synced_at: now, last_error: null, event_count: parsedEvents.length, updated_at: now })
    .eq('id', connectionId)

  return { synced: true, event_count: parsedEvents.length, sync_status: 'ok', last_error: null }
}
