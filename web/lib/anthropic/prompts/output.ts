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
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned) as SweepAPIResponse

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
