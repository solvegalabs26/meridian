export interface GoogleCalendarLinkInput {
  title: string
  description?: string
  location?: string
  start: Date
  durationMinutes?: number
}

export function googleCalendarLink(input: GoogleCalendarLinkInput): string {
  const end = new Date(input.start.getTime() + (input.durationMinutes ?? 30) * 60_000)
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${fmt(input.start)}/${fmt(end)}`,
    ...(input.description ? { details: input.description } : {}),
    ...(input.location ? { location: input.location } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
