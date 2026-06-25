export interface CalendarEvent {
  uid: string
  title: string
  start: Date
  end: Date
  description: string | null
  location: string | null
  daysUntil: number
}

function parseICalDate(val: string): Date | null {
  if (!val) return null
  const clean = val.includes(':') ? val.split(':').pop()! : val
  if (clean.length === 8) {
    return new Date(`${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`)
  }
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (!m) return null
  const tz = m[7] === 'Z' ? 'Z' : ''
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz}`)
}

function parseICalText(text: string): CalendarEvent[] {
  const now = new Date()
  const results: CalendarEvent[] = []
  const blocks = text.split('BEGIN:VEVENT').slice(1)

  for (const block of blocks) {
    const endIdx = block.indexOf('END:VEVENT')
    const body = block.slice(0, endIdx)
    const unfolded = body.replace(/\r?\n[ \t]/g, '')
    const lines = unfolded.split(/\r?\n/)

    const props: Record<string, string> = {}
    for (const line of lines) {
      const colon = line.indexOf(':')
      if (colon < 0) continue
      const key = line.slice(0, colon).split(';')[0].toUpperCase()
      const value = line.slice(colon + 1).trim()
      if (key) props[key] = value
    }

    const startRaw = props['DTSTART'] ?? ''
    const endRaw   = props['DTEND']   ?? startRaw
    const startDate = parseICalDate(startRaw)
    const endDate   = parseICalDate(endRaw)

    if (!startDate || isNaN(startDate.getTime())) continue

    const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    results.push({
      uid:         props['UID']         ?? '',
      title:       props['SUMMARY']     ?? 'Untitled event',
      start:       startDate,
      end:         endDate ?? startDate,
      description: props['DESCRIPTION'] ?? null,
      location:    props['LOCATION']    ?? null,
      daysUntil,
    })
  }

  return results
}

export async function fetchCalendarEvents(
  icalUrl: string,
  daysAhead = 90
): Promise<CalendarEvent[]> {
  try {
    const res = await fetch(icalUrl, {
      headers: { 'User-Agent': 'Meridian/1.0' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()

    const now = new Date()
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

    return parseICalText(text)
      .filter(e => e.start >= now && e.start <= cutoff)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  } catch (err) {
    console.error('iCal fetch/parse failed:', err)
    return []
  }
}

export function formatEventsForPrompt(events: CalendarEvent[], daysAhead = 90): string {
  if (events.length === 0) return ''

  const lines = events.slice(0, 20).map(e => {
    const dateStr = e.start.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
    const parts = [`${e.daysUntil}d: ${e.title} — ${dateStr}`]
    if (e.location) parts.push(`@ ${e.location}`)
    if (e.description) parts.push(e.description.slice(0, 120))
    return parts.join(' | ')
  })

  return `UPCOMING CALENDAR EVENTS (next ${daysAhead} days):\n${lines.join('\n')}`
}
