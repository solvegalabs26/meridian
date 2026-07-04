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
  // Dynamic import keeps node-ical out of the module graph at build time,
  // avoiding the BigInt() crash during Next.js page-data collection.
  //
  // Use await import() (not require()): when webpack bundles CJS packages in
  // an ESM context it returns the ESM namespace object { default: ..., ... }.
  // A bare require() would hand us the namespace, making ical.parseICS
  // undefined. Destructuring .default (with CJS fallback) handles both cases.
  const icalMod = await import('node-ical')
  // CJS-via-ESM interop: real export is on .default; plain require() puts it
  // directly on the module object — handle both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ical = ((icalMod as any).default ?? icalMod) as { parseICS: (text: string) => Record<string, ICalComponent> }

  console.log('[meridian:parse] parseICS type:', typeof ical.parseICS, 'icsText start:', JSON.stringify(icsText.slice(0, 80)))

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
