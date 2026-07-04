import { describe, it, expect } from 'vitest'
import { googleCalendarLink } from './googleCalendarLink'

const FIXED_START = new Date('2026-07-10T09:00:00.000Z')

describe('googleCalendarLink', () => {
  it('produces a valid Google Calendar render URL', () => {
    const url = googleCalendarLink({ title: 'Test Event', start: FIXED_START })
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/)
    expect(url).toContain('action=TEMPLATE')
  })

  it('encodes title into text param', () => {
    const url = googleCalendarLink({ title: 'My Action', start: FIXED_START })
    const params = new URL(url).searchParams
    expect(params.get('text')).toBe('My Action')
  })

  it('formats dates as YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ', () => {
    const url = googleCalendarLink({ title: 'T', start: FIXED_START, durationMinutes: 30 })
    const dates = new URL(url).searchParams.get('dates')
    expect(dates).toBe('20260710T090000Z/20260710T093000Z')
  })

  it('defaults to 30-minute duration', () => {
    const url = googleCalendarLink({ title: 'T', start: FIXED_START })
    const dates = new URL(url).searchParams.get('dates')!
    const [startStr, endStr] = dates.split('/')
    // Parse back: 20260710T090000Z → 2026-07-10T09:00:00Z
    const toDate = (s: string) => new Date(
      `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`
    )
    const diffMinutes = (toDate(endStr).getTime() - toDate(startStr).getTime()) / 60_000
    expect(diffMinutes).toBe(30)
  })

  it('respects custom durationMinutes', () => {
    const url = googleCalendarLink({ title: 'T', start: FIXED_START, durationMinutes: 60 })
    const dates = new URL(url).searchParams.get('dates')
    expect(dates).toBe('20260710T090000Z/20260710T100000Z')
  })

  it('includes description in details param', () => {
    const url = googleCalendarLink({ title: 'T', start: FIXED_START, description: 'Some detail' })
    expect(new URL(url).searchParams.get('details')).toBe('Some detail')
  })

  it('includes location param', () => {
    const url = googleCalendarLink({ title: 'T', start: FIXED_START, location: 'HQ' })
    expect(new URL(url).searchParams.get('location')).toBe('HQ')
  })

  it('omits details param when no description provided', () => {
    const url = googleCalendarLink({ title: 'T', start: FIXED_START })
    expect(new URL(url).searchParams.has('details')).toBe(false)
  })

  it('stays under 2000 chars for maximal reasonable inputs', () => {
    const url = googleCalendarLink({
      title: 'A'.repeat(200),
      description: 'B'.repeat(500),
      location: 'C'.repeat(200),
      start: FIXED_START,
      durationMinutes: 60,
    })
    expect(url.length).toBeLessThan(2000)
  })

  it('handles midnight UTC correctly', () => {
    const midnight = new Date('2026-07-10T00:00:00.000Z')
    const url = googleCalendarLink({ title: 'T', start: midnight, durationMinutes: 30 })
    const dates = new URL(url).searchParams.get('dates')
    expect(dates).toBe('20260710T000000Z/20260710T003000Z')
  })
})
