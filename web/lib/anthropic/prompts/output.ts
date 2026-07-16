export interface InferenceBlock {
  unstated_implications: string[]
  decision_gate: {
    exists: boolean
    description: string | null
    deadline_days: number | null
  }
  absence_signal: {
    is_meaningful: boolean
    description: string | null
  }
  confidence_pivot: {
    upside_trigger: string
    downside_trigger: string
    upside_delta: number
    downside_delta: number
  }
  cross_objective_flags: Array<{
    related_objective: string
    flag_type: 'conflict' | 'dependency' | 'sequence' | 'opportunity'
    description: string
  }>
  user_blind_spot: string
  inference_confidence: 'high' | 'medium' | 'low'
  inference_confidence_rationale: string
}

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
  inference_block?: InferenceBlock
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

  // Ensure arrays exist on each objective; normalise inference_block if present
  parsed.objectives = parsed.objectives.map(obj => {
    const normalised: ObjectiveResult = {
      ...obj,
      actions: obj.actions ?? [],
      cross_dependencies: obj.cross_dependencies ?? [],
      opportunities: obj.opportunities ?? [],
      risks: obj.risks ?? [],
      confidence: Math.max(0, Math.min(100, Math.round(obj.confidence))),
    }

    if (obj.inference_block) {
      normalised.inference_block = {
        unstated_implications: obj.inference_block.unstated_implications ?? [],
        decision_gate: {
          exists: obj.inference_block.decision_gate?.exists ?? false,
          description: obj.inference_block.decision_gate?.description ?? null,
          deadline_days: obj.inference_block.decision_gate?.deadline_days ?? null,
        },
        absence_signal: {
          is_meaningful: obj.inference_block.absence_signal?.is_meaningful ?? false,
          description: obj.inference_block.absence_signal?.description ?? null,
        },
        confidence_pivot: {
          upside_trigger: obj.inference_block.confidence_pivot?.upside_trigger ?? '',
          downside_trigger: obj.inference_block.confidence_pivot?.downside_trigger ?? '',
          upside_delta: obj.inference_block.confidence_pivot?.upside_delta ?? 0,
          downside_delta: obj.inference_block.confidence_pivot?.downside_delta ?? 0,
        },
        cross_objective_flags: obj.inference_block.cross_objective_flags ?? [],
        user_blind_spot: obj.inference_block.user_blind_spot ?? '',
        inference_confidence: obj.inference_block.inference_confidence ?? 'low',
        inference_confidence_rationale: obj.inference_block.inference_confidence_rationale ?? '',
      }
    }

    return normalised
  })

  parsed.cross_objective_dependencies = parsed.cross_objective_dependencies ?? []

  return parsed
}
