// lib/sweep/domainEvents/domainEventRetriever.ts
// FF-066 — Retrieves historical domain events from external sources via Brave Search.
// Events are extracted by Haiku from raw search results — different events each year,
// not repeated metrics. Retrieved, not fabricated.

import { executeBraveSearch } from '@/lib/signals/braveSearch'
import Anthropic from '@anthropic-ai/sdk'

export interface DomainEvent {
  eventYear: number
  eventDate?: string
  source: string
  signalClass: string
  eventText: string
  geoTags: string[]
  sectorTags: string[]
  directionScore: number  // -3 to +3; negative = bad for objective
  impactConfidence: number // 0-100
  sourceUrl?: string
}

export async function retrieveDomainEvents(
  domain: string,
  geographicScope: { states: string[]; counties: string[] },
  lookbackYears: number = 5
): Promise<DomainEvent[]> {
  const currentYear = new Date().getFullYear()
  const startYear = currentYear - lookbackYears
  const events: DomainEvent[] = []

  if (domain === 'elk_hunt') {
    const geo = geographicScope.counties.slice(0, 2).join(' ') || 'Utah'
    const queries = buildElkHuntHistoricalQueries(geo, startYear, currentYear)

    const results = await Promise.all(
      queries.map(async ({ query, year, signalClass }) => {
        try {
          const result = await executeBraveSearch(query)
          return result ? { result, year, signalClass } : null
        } catch {
          return null
        }
      })
    )

    const rawData = results
      .filter(Boolean)
      .map(r => `YEAR: ${r!.year}\nSIGNAL CLASS: ${r!.signalClass}\nDATA: ${r!.result}`)
      .join('\n\n---\n\n')

    if (!rawData) return []

    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract historical domain events from this data for an elk hunting intelligence system.

DOMAIN: elk_hunt
GEOGRAPHY: ${geo}, Utah
TIME RANGE: ${startYear} to ${currentYear}

RAW DATA:
${rawData.slice(0, 10000)}

Extract real events that affected elk hunting outcomes. Each event should be specific, dated, and from a named source.
Return ONLY valid JSON array:
[
  {
    "eventYear": 2021,
    "eventDate": "2021-08-15",
    "source": "Utah DWR",
    "signalClass": "WILDLIFE_MANAGEMENT",
    "eventText": "Utah DWR issues 450 emergency antlerless elk permits for northeastern Utah units due to severe drought conditions",
    "geoTags": ["UT", "Duchesne", "Uintah"],
    "sectorTags": ["wildlife", "hunting", "drought"],
    "directionScore": -2,
    "impactConfidence": 85,
    "sourceUrl": ""
  }
]

Only include events you can clearly identify from the data. Do not fabricate. If unsure about a date, use the year only (YYYY-01-01).
Signal classes: WILDLIFE_MANAGEMENT, DROUGHT_DECLARATION, WEATHER_EVENT, REGULATORY_CHANGE, LAND_ACCESS, HABITAT_CONDITION`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean) as DomainEvent[]
      if (Array.isArray(parsed)) {
        events.push(...parsed)
        console.log(`[FF-066] Retrieved ${parsed.length} historical events for ${domain}`)
      }
    } catch {
      console.error('[FF-066] Event parse failed:', text.slice(0, 200))
    }
  }

  return events
}

function buildElkHuntHistoricalQueries(
  geo: string,
  startYear: number,
  currentYear: number
): { query: string; year: number; signalClass: string }[] {
  const queries: { query: string; year: number; signalClass: string }[] = []

  for (let year = startYear; year <= currentYear; year++) {
    queries.push({
      query: `Utah DWR elk permit changes emergency antlerless ${geo} ${year}`,
      year,
      signalClass: 'WILDLIFE_MANAGEMENT',
    })
  }

  queries.push({
    query: `NOAA drought classification ${geo} Utah ${startYear} ${currentYear} D2 D3 severe`,
    year: currentYear,
    signalClass: 'DROUGHT_DECLARATION',
  })

  queries.push({
    query: `Utah elk hunting unit conditions harvest report ${geo} ${startYear} ${currentYear}`,
    year: currentYear,
    signalClass: 'HABITAT_CONDITION',
  })

  return queries
}
