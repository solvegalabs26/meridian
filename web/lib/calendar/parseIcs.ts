interface ICalComponent {
  type: string
  uid?: string
  summary?: string
  description?: string
  location?: string
  start?: Date
  end?: Date
  datetype?: string
  rrule?: {
    between(after: Date, before: Date, inc?: boolean): Date[]
  }
}

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
  // Diagnostic fires first — before any module loading — so we can confirm
  // the function was actually entered even if the require() below throws.
  console.log('[meridian:parse] entered, icsText length:', icsText?.length ?? 'undefined', 'start:', JSON.stringify((icsText ?? '').slice(0, 40)))

  // require() (not dynamic import) is correct here: node-ical is listed in
  // serverExternalPackages so webpack never bundles it. At runtime this is a
  // plain Node.js require() returning the CJS module directly. Dynamic
  // import('node-ical') would be transpiled by webpack to a require() that
  // returns the ESM namespace object, making ical.parseICS undefined.
  // The .default ?? mod fallback handles both shapes safely.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const icalRaw: any = require('node-ical')
  const ical = (icalRaw.default ?? icalRaw) as { parseICS: (text: string) => Record<string, ICalComponent> }

  console.log('[meridian:parse] parseICS type:', typeof ical.parseICS)

  const now = new Date()
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000) // yesterday
  const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) // +60 days

  let data: Record<string, ICalComponent>
  try {
    data = ical.parseICS(icsText)
  } catch (e) {
    console.error('[meridian:parse] parseICS threw:', e instanceof Error ? e.message : String(e))
    throw e
  }
  const results: ParsedEvent[] = []

  for (const key of Object.keys(data)) {
    const comp = data[key]
    if (comp.type !== 'VEVENT') continue

    const allDay = comp.datetype === 'date'

    // Recurring events — expand instances within window
    if (comp.rrule) {
      let instances: Date[]
      try {
        instances = comp.rrule.between(windowStart, windowEnd, true)
      } catch {
        continue
      }

      const durationMs = comp.start && comp.end
        ? comp.end.getTime() - comp.start.getTime()
        : 0

      for (const instanceStart of instances) {
        const instanceEnd = durationMs > 0 ? new Date(instanceStart.getTime() + durationMs) : null
        results.push({
          uid: comp.uid ?? null,
          summary: comp.summary ?? null,
          description: comp.description ?? null,
          location: comp.location ?? null,
          starts_at: instanceStart.toISOString(),
          ends_at: instanceEnd?.toISOString() ?? null,
          all_day: allDay,
        })
      }
      continue
    }

    // Non-recurring event
    const startDate = comp.start instanceof Date ? comp.start : null
    if (!startDate || isNaN(startDate.getTime())) continue
    if (startDate < windowStart || startDate > windowEnd) continue

    const endDate = comp.end instanceof Date && !isNaN(comp.end.getTime()) ? comp.end : null

    results.push({
      uid: comp.uid ?? null,
      summary: comp.summary ?? null,
      description: comp.description ?? null,
      location: comp.location ?? null,
      starts_at: startDate.toISOString(),
      ends_at: endDate?.toISOString() ?? null,
      all_day: allDay,
    })
  }

  // Sort chronologically, cap at 200
  results.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return results.slice(0, 200)
}
