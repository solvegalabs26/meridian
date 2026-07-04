import ICAL from 'ical.js'

export interface ParsedEvent {
  uid: string | null
  summary: string | null
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
}

export async function parseIcsEvents(icsText: string): Promise<ParsedEvent[]> {
  console.log('[meridian:parse] entered, icsText length:', icsText?.length ?? 'undefined', 'start:', JSON.stringify((icsText ?? '').slice(0, 40)))

  const now = new Date()
  const windowStart = ICAL.Time.fromJSDate(new Date(now.getTime() - 24 * 60 * 60 * 1000), true)
  const windowEnd = ICAL.Time.fromJSDate(new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jcal: any
  try {
    jcal = ICAL.parse(icsText)
  } catch (e) {
    console.error('[meridian:parse] ICAL.parse threw:', e instanceof Error ? e.message : String(e))
    throw e
  }

  const root = new ICAL.Component(jcal)
  const vevents = root.getAllSubcomponents('vevent')
  console.log('[meridian:parse] vevents found:', vevents.length)

  const results: ParsedEvent[] = []

  for (const vevent of vevents) {
    let event: ICAL.Event
    try {
      event = new ICAL.Event(vevent)
    } catch {
      continue
    }

    const allDay = event.startDate?.isDate ?? false
    const uid = event.uid ?? null
    const summary = event.summary ?? null
    const description = event.description ?? null
    const location = event.location ?? null

    if (event.isRecurring()) {
      // Expand recurring instances within the window
      const durationMs = event.duration?.toSeconds ? event.duration.toSeconds() * 1000 : 0
      try {
        const iter = event.iterator()
        let next: ICAL.Time | null
        while ((next = iter.next())) {
          if (next.compare(windowEnd) > 0) break
          if (next.compare(windowStart) < 0) continue
          const instanceStart = next.toJSDate()
          const instanceEnd = durationMs > 0 ? new Date(instanceStart.getTime() + durationMs) : null
          results.push({
            uid, summary, description, location,
            starts_at: instanceStart.toISOString(),
            ends_at: instanceEnd?.toISOString() ?? null,
            all_day: allDay,
          })
        }
      } catch {
        continue
      }
      continue
    }

    // Non-recurring
    let startDate: Date
    try {
      startDate = event.startDate.toJSDate()
    } catch {
      continue
    }
    if (isNaN(startDate.getTime())) continue

    const startTime = ICAL.Time.fromJSDate(startDate, true)
    if (startTime.compare(windowStart) < 0 || startTime.compare(windowEnd) > 0) continue

    let endDate: Date | null = null
    try {
      endDate = event.endDate ? event.endDate.toJSDate() : null
      if (endDate && isNaN(endDate.getTime())) endDate = null
    } catch {
      endDate = null
    }

    results.push({
      uid, summary, description, location,
      starts_at: startDate.toISOString(),
      ends_at: endDate?.toISOString() ?? null,
      all_day: allDay,
    })
  }

  results.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return results.slice(0, 200)
}
