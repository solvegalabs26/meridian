export interface ObjectiveResult {
  obj_id: string
  confidence: number
  confidence_reasoning: string
  signal_quality: 'high' | 'medium' | 'low'
  signal_gap: string
  actions: string[]
  cross_dependencies: string[]
  opportunities: string[]
  risks: string[]
  changed_since_last_sweep: string
}

export interface CrossDependency {
  from_obj: string
  to_obj: string
  description: string
  urgency: 'high' | 'medium' | 'low'
}

export interface SweepAPIResponse {
  sweep_summary: string
  objectives: ObjectiveResult[]
  cross_objective_dependencies: CrossDependency[]
  top_priority_action: string
}

export function parseAnthropicResponse(content: string): SweepAPIResponse {
  // Strip any markdown code fences if present
  let cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  // Attempt to repair truncated JSON by finding the last complete objective
  let parsed: SweepAPIResponse
  try {
    parsed = JSON.parse(cleaned) as SweepAPIResponse
  } catch {
    // Try to close the JSON at the last complete objective entry
    const lastCompleteObj = cleaned.lastIndexOf('},\n    {')
    if (lastCompleteObj > 0) {
      cleaned = cleaned.slice(0, lastCompleteObj + 1) + ']}}'
      try {
        parsed = JSON.parse(cleaned) as SweepAPIResponse
      } catch {
        // Last resort: extract what we can
        throw new Error(`Anthropic response truncated — increase max_tokens. Original: ${content.slice(0, 200)}`)
      }
    } else {
      throw new Error(`Invalid JSON from Anthropic: ${content.slice(0, 200)}`)
    }
  }

  // Validate required fields
  if (!parsed.sweep_summary || !Array.isArray(parsed.objectives)) {
    throw new Error('Invalid Anthropic response structure')
  }

  // Ensure arrays exist on each objective
  parsed.objectives = parsed.objectives.map(obj => ({
    ...obj,
    actions: obj.actions ?? [],
    cross_dependencies: obj.cross_dependencies ?? [],
    opportunities: obj.opportunities ?? [],
    risks: obj.risks ?? [],
    confidence: Math.max(0, Math.min(100, Math.round(obj.confidence))),
  }))

  parsed.cross_objective_dependencies = parsed.cross_objective_dependencies ?? []

  return parsed
}
