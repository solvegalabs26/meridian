// lib/sweep/patternDeviation/currentConditionsExtractor.ts
// FF-067 — Extracts a condition fingerprint from the FF-064 signal brief.
// The fingerprint is compared against historical year fingerprints to produce
// similarity scores.

import { SignalBrief } from '@/lib/sweep/subAgent/subAgentExecutor'

export interface ConditionFingerprint {
  domain: string
  year: number
  droughtLevel: 'none' | 'D0' | 'D1' | 'D2' | 'D3' | 'D4' | 'unknown'
  populationStatus: 'above_target' | 'at_target' | 'below_target' | 'unknown'
  permitPressure: 'elevated' | 'normal' | 'restricted' | 'unknown'
  weatherPattern: 'favorable' | 'neutral' | 'unfavorable' | 'unknown'
  accessConditions: 'open' | 'restricted' | 'unknown'
  economicPressure: 'high' | 'moderate' | 'low' | 'unknown'
  rawSignals: string[]
}

export function extractCurrentConditions(
  domain: string,
  signalBrief: SignalBrief | null
): ConditionFingerprint {
  const currentYear = new Date().getFullYear()
  const fingerprint: ConditionFingerprint = {
    domain,
    year: currentYear,
    droughtLevel: 'unknown',
    populationStatus: 'unknown',
    permitPressure: 'unknown',
    weatherPattern: 'unknown',
    accessConditions: 'unknown',
    economicPressure: 'unknown',
    rawSignals: signalBrief?.keyFindings || [],
  }

  if (!signalBrief) return fingerprint

  const text = signalBrief.rawSummary.toLowerCase() + ' ' + signalBrief.keyFindings.join(' ').toLowerCase()

  // Drought classification
  if (text.includes('d4') || text.includes('exceptional drought')) fingerprint.droughtLevel = 'D4'
  else if (text.includes('d3') || text.includes('extreme drought')) fingerprint.droughtLevel = 'D3'
  else if (text.includes('d2') || text.includes('severe drought')) fingerprint.droughtLevel = 'D2'
  else if (text.includes('d1') || text.includes('moderate drought')) fingerprint.droughtLevel = 'D1'
  else if (text.includes('d0') || text.includes('abnormally dry')) fingerprint.droughtLevel = 'D0'
  else if (text.includes('no drought') || text.includes('normal precip')) fingerprint.droughtLevel = 'none'

  // Population status
  if (text.includes('above') && (text.includes('target') || text.includes('objective'))) fingerprint.populationStatus = 'above_target'
  else if (text.includes('below') && (text.includes('target') || text.includes('objective'))) fingerprint.populationStatus = 'below_target'
  else if (text.includes('at target') || text.includes('meets objective')) fingerprint.populationStatus = 'at_target'

  // Permit pressure
  if (text.includes('additional') && text.includes('permit')) fingerprint.permitPressure = 'elevated'
  else if (text.includes('restricted') || text.includes('reduced permit')) fingerprint.permitPressure = 'restricted'
  else fingerprint.permitPressure = 'normal'

  // Weather
  if (text.includes('favorable') || text.includes('normal precip') || text.includes('good snowpack')) fingerprint.weatherPattern = 'favorable'
  else if (text.includes('drought') || text.includes('heat') || text.includes('dry')) fingerprint.weatherPattern = 'unfavorable'
  else fingerprint.weatherPattern = 'neutral'

  return fingerprint
}
