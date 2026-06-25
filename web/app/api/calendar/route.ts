import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCalendarEvents } from '@/lib/calendar/ical'

export const dynamic = 'force-dynamic'

// GET — fetch preview of upcoming events from stored URL
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('calendar_ical_url')
    .eq('id', user.id)
    .single()

  if (!profile?.calendar_ical_url) {
    return NextResponse.json({ events: [], connected: false })
  }

  const events = await fetchCalendarEvents(profile.calendar_ical_url, 90)
  return NextResponse.json({ events, connected: true })
}

// POST — save iCal URL and validate it
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await request.json() as { url: string }

  // Validate it's a real iCal URL
  if (!url) {
    // Clear the URL
    await supabase.from('profiles').update({ calendar_ical_url: null }).eq('id', user.id)
    return NextResponse.json({ ok: true, events: [] })
  }

  if (!url.startsWith('http')) {
    return NextResponse.json({ error: 'URL must start with http or https' }, { status: 400 })
  }

  const events = await fetchCalendarEvents(url, 30)
  if (events.length === 0) {
    // Could be empty calendar — still save but warn
    await supabase.from('profiles').update({ calendar_ical_url: url }).eq('id', user.id)
    return NextResponse.json({ ok: true, events: [], warning: 'No upcoming events found — URL saved. Check the URL is correct if your calendar has events.' })
  }

  await supabase.from('profiles').update({ calendar_ical_url: url }).eq('id', user.id)
  return NextResponse.json({ ok: true, events })
}
