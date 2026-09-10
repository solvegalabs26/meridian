// lib/sweep/subAgent/domainDetector.ts
// FF-064 — Sub-Agent Dispatch Layer: domain detection for objective routing.

export type ObjectiveDomain =
  | 'elk_hunt'
  | 'unknown'

export function detectDomain(objective: {
  title: string
  category: string
  notes?: string
}): ObjectiveDomain {
  const text = `${objective.title} ${objective.category} ${objective.notes || ''}`.toLowerCase()

  const elkKeywords = [
    'elk', 'hunt', 'archery', 'rifle hunt', 'bull', 'unit 10',
    'diamond mountain', 'mule deer', 'deer hunt', 'big game',
  ]

  if (elkKeywords.some(kw => text.includes(kw))) {
    return 'elk_hunt'
  }

  return 'unknown'
}
