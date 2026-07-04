import { describe, it, expect } from 'vitest'
import { parseIcsEvents } from './parseIcs'

// Minimal valid ICS fixtures
const MINIMAL_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'END:VCALENDAR',
].join('\r\n')

const ONE_EVENT_ICS = (dtstart: string, dtend: string, uid = 'test-uid-1@test') => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'BEGIN:VEVENT',
  `UID:${uid}`,
  'SUMMARY:Test Event',
  `DTSTART:${dtstart}`,
  `DTEND:${dtend}`,
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const futureDate = (): { start: string; end: string } => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`
  const end = new Date(d.getTime() + 3600_000)
  return { start: fmt(d), end: fmt(end) }
}

describe('parseIcsEvents', () => {
  it('returns empty array for calendar with no events', async () => {
    const events = await parseIcsEvents(MINIMAL_ICS)
    expect(Array.isArray(events)).toBe(true)
    expect(events).toHaveLength(0)
  })

  it('does not throw on a minimal valid ICS string', async () => {
    await expect(parseIcsEvents(MINIMAL_ICS)).resolves.toBeDefined()
  })

  it('parses a single upcoming event', async () => {
    const { start, end } = futureDate()
    const events = await parseIcsEvents(ONE_EVENT_ICS(start, end))
    expect(events).toHaveLength(1)
    expect(events[0].uid).toBe('test-uid-1@test')
    expect(events[0].summary).toBe('Test Event')
    expect(events[0].all_day).toBe(false)
    expect(typeof events[0].starts_at).toBe('string')
    expect(typeof events[0].ends_at).toBe('string')
  })

  it('filters out events outside the 60-day window', async () => {
    // 90 days in the future — outside the +60d window
    const d = new Date()
    d.setDate(d.getDate() + 90)
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (dt: Date) =>
      `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T090000Z`
    const end = new Date(d.getTime() + 3600_000)
    const events = await parseIcsEvents(ONE_EVENT_ICS(fmt(d), fmt(end)))
    expect(events).toHaveLength(0)
  })

  it('parses an all-day event (DATE datetype)', async () => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//Test//EN',
      'BEGIN:VEVENT',
      'UID:allday@test',
      'SUMMARY:All Day Event',
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dateStr}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const events = await parseIcsEvents(ics)
    expect(events).toHaveLength(1)
    expect(events[0].all_day).toBe(true)
  })

  it('expands a recurring weekly event within the window', async () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//Test//EN',
      'BEGIN:VEVENT',
      'UID:weekly@test',
      'SUMMARY:Weekly Standup',
      'DTSTART:20260101T090000Z',
      'DTEND:20260101T100000Z',
      'RRULE:FREQ=WEEKLY',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const events = await parseIcsEvents(ics)
    // Should have several instances within the 60-day window (roughly 8-9)
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.uid).toBe('weekly@test')
      expect(e.summary).toBe('Weekly Standup')
    }
  })

  it('returns events sorted chronologically', async () => {
    const { start: s1, end: e1 } = futureDate()
    const d2 = new Date()
    d2.setDate(d2.getDate() + 14)
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T100000Z`
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//Test//EN',
      'BEGIN:VEVENT',
      'UID:second@test',
      'SUMMARY:Second',
      `DTSTART:${fmt(d2)}`,
      `DTEND:${fmt(new Date(d2.getTime() + 3600_000))}`,
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:first@test',
      'SUMMARY:First',
      `DTSTART:${s1}`,
      `DTEND:${e1}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const events = await parseIcsEvents(ics)
    expect(events.length).toBeGreaterThanOrEqual(2)
    // Earlier event should come first
    expect(events[0].starts_at <= events[1].starts_at).toBe(true)
  })
})
