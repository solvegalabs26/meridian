function formatDtUTC(date: Date): string {
  // YYYYMMDDTHHMMSSZ
  return date.toISOString().replace(/[-:.]/g, '').replace(/\d{3}Z$/, 'Z')
}

function escapeValue(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// RFC 5545 line folding — fold at 75 octets
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= 75) return line

  const parts: string[] = []
  let offset = 0
  while (offset < bytes.length) {
    const chunkLen = offset === 0 ? 75 : 74 // continuation lines start with a space
    const chunk = bytes.slice(offset, offset + chunkLen)
    parts.push(new TextDecoder().decode(chunk))
    offset += chunkLen
  }
  return parts.join('\r\n ')
}

export function generateIcs(input: {
  title: string
  description?: string
  start: Date
  durationMinutes?: number
  location?: string
}): string {
  const { title, description, start, durationMinutes = 30, location } = input
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  const uid = `${crypto.randomUUID()}@meridianarc.ai`
  const now = formatDtUTC(new Date())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meridian Arc//Solvega Labs//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}`),
    foldLine(`DTSTAMP:${now}`),
    foldLine(`DTSTART:${formatDtUTC(start)}`),
    foldLine(`DTEND:${formatDtUTC(end)}`),
    foldLine(`SUMMARY:${escapeValue(title)}`),
    ...(description ? [foldLine(`DESCRIPTION:${escapeValue(description)}`)] : []),
    ...(location ? [foldLine(`LOCATION:${escapeValue(location)}`)] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n') + '\r\n'
}
