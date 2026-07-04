import { describe, it, expect } from 'vitest'
import { parseIcsEvents } from './parseIcs'

// Minimal valid ICS fixtures — raw strings are parser-agnostic
const MINIMAL_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'END:VCALENDAR',
].join('\r\n')

const pad = (n: number) => String(n).padStart(2, '0')
const fmtUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`

const futureDate = (daysAhead = 7) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysAhead)
  d.setUTCHours(10, 0, 0, 0)
  return d
}

const oneEventIcs = (dtstart: string, dtend: string, uid = 'test-uid-1@test') => [
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
    const start = futureDate(7)
    const end = new Date(start.getTime() + 3_600_000)
    const events = await parseIcsEvents(oneEventIcs(fmtUtc(start), fmtUtc(end)))
    expect(events).toHaveLength(1)
    expect(events[0].uid).toBe('test-uid-1@test')
    expect(events[0].summary).toBe('Test Event')
    expect(events[0].all_day).toBe(false)
    expect(typeof events[0].starts_at).toBe('string')
    expect(typeof events[0].ends_at).toBe('string')
  })

  it('filters out events outside the 60-day window', async () => {
    const start = futureDate(90)
    const end = new Date(start.getTime() + 3_600_000)
    const events = await parseIcsEvents(oneEventIcs(fmtUtc(start), fmtUtc(end)))
    expect(events).toHaveLength(0)
  })

  it('parses an all-day event (VALUE=DATE)', async () => {
    const d = futureDate(3)
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
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.uid).toBe('weekly@test')
      expect(e.summary).toBe('Weekly Standup')
    }
  })

  it('returns events sorted chronologically', async () => {
    const s1 = futureDate(7)
    const s2 = futureDate(14)
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//Test//EN',
      'BEGIN:VEVENT',
      'UID:second@test',
      'SUMMARY:Second',
      `DTSTART:${fmtUtc(s2)}`,
      `DTEND:${fmtUtc(new Date(s2.getTime() + 3_600_000))}`,
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:first@test',
      'SUMMARY:First',
      `DTSTART:${fmtUtc(s1)}`,
      `DTEND:${fmtUtc(new Date(s1.getTime() + 3_600_000))}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const events = await parseIcsEvents(ics)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0].starts_at <= events[1].starts_at).toBe(true)
  })

  it('returns empty array for valid ICS with no VEVENTs', async () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VTIMEZONE',
      'TZID:America/New_York',
      'END:VTIMEZONE',
      'END:VCALENDAR',
    ].join('\r\n')
    await expect(parseIcsEvents(ics)).resolves.toHaveLength(0)
  })
})
