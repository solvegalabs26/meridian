export interface MatchableObjective {
  id: string
  title: string
  signal_keywords: string[] | null
}

export interface MatchableEvent {
  summary: string | null
  description: string | null
}

export function matchEventToObjectives(
  event: MatchableEvent,
  objectives: MatchableObjective[]
): string[] {
  const eventText = `${event.summary ?? ''} ${event.description ?? ''}`.toLowerCase().trim()
  if (!eventText) return []

  const matched: string[] = []

  for (const obj of objectives) {
    let found = false

    // Check signal_keywords first
    if (obj.signal_keywords) {
      for (const kw of obj.signal_keywords) {
        if (kw && kw.trim() && eventText.includes(kw.toLowerCase().trim())) {
          found = true
          break
        }
      }
    }

    // Check significant words from objective title (>3 chars, alpha-start)
    if (!found) {
      const titleWords = obj.title
        .toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 3 && /^[a-z]/.test(w))

      for (const word of titleWords) {
        if (eventText.includes(word)) {
          found = true
          break
        }
      }
    }

    if (found) matched.push(obj.id)
  }

  return matched
}
