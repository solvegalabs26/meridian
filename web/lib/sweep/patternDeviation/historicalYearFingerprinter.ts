// lib/sweep/patternDeviation/historicalYearFingerprinter.ts
// FF-067 — Reads enterprise_macro_events for a specific year and produces a
// ConditionFingerprint using the same dimensions as currentConditionsExtractor.

import { createServiceClient } from '@/lib/supabase/server'
import { ConditionFingerprint } from './currentConditionsExtractor'

export async function fingerprintHistoricalYear(
  domain: string,
  year: number,
  geographicScope: { states: string[]; counties: string[] }
): Promise<ConditionFingerprint> {
  const supabase = createServiceClient()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const stateTag = geographicScope.states[0] ?? 'UT'

  const { data: events } = await supabase
    .from('enterprise_macro_events')
    .select('event_category, event_name, description, direction, magnitude, relevant_industries, affected_regions')
    .gte('event_date', yearStart)
    .lte('event_date', yearEnd)
    .or(`affected_regions.cs.{"${stateTag}"},relevant_industries.cs.{"hunting"},relevant_industries.cs.{"wildlife"},relevant_industries.cs.{"drought"},relevant_industries.cs.{"climate"}`)

  const fingerprint: ConditionFingerprint = {
    domain,
    year,
    droughtLevel: 'unknown',
    populationStatus: 'unknown',
    permitPressure: 'unknown',
    weatherPattern: 'unknown',
    accessConditions: 'unknown',
    economicPressure: 'unknown',
    rawSignals: [],
  }

  if (!events || events.length === 0) return fingerprint

  const allText = events
    .map(e => `${e.event_name} ${e.description}`)
    .join(' ')
    .toLowerCase()

  fingerprint.rawSignals = events.map(e => e.event_name as string)

  if (allText.includes('d4') || allText.includes('exceptional drought')) fingerprint.droughtLevel = 'D4'
  else if (allText.includes('d3') || allText.includes('extreme drought')) fingerprint.droughtLevel = 'D3'
  else if (allText.includes('d2') || allText.includes('severe drought')) fingerprint.droughtLevel = 'D2'
  else if (allText.includes('d1') || allText.includes('moderate drought')) fingerprint.droughtLevel = 'D1'
  else if (allText.includes('d0') || allText.includes('abnormally dry')) fingerprint.droughtLevel = 'D0'
  else if (allText.includes('no drought') || allText.includes('normal')) fingerprint.droughtLevel = 'none'

  const permitEvents = events.filter(e => e.event_category === 'policy_regulatory')
  if (permitEvents.some(e => {
    const t = `${e.event_name} ${e.description}`.toLowerCase()
    return t.includes('additional') && t.includes('permit')
  })) {
    fingerprint.permitPressure = 'elevated'
  }

  if (allText.includes('above') && allText.includes('objective')) fingerprint.populationStatus = 'above_target'
  else if (allText.includes('below') && allText.includes('objective')) fingerprint.populationStatus = 'below_target'

  const droughtEvents = events.filter(e => e.event_category === 'natural_disaster')
  fingerprint.weatherPattern = droughtEvents.length > 0 ? 'unfavorable' : 'neutral'

  return fingerprint
}
