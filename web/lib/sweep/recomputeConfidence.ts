/**
 * recomputeConfidenceFromAction — lightweight Haiku call that assigns a
 * directional confidence effect to a user-logged action and persists it.
 *
 * Does NOT make external web-search calls. Not subject to the 23h sweep
 * rate limit — fires immediately on action log.
 */

import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'

interface ActionInput {
  description: string
  action_date: string
  action_class: string | null
  signal_id: string
}

interface ObjectiveSnapshot {
  id: string
  user_id: string
  title: string
  outcome: string
  confidence: number
  deadline_type: string
  reservation_price: number | null
  target_date: string | null
}

interface RecomputeResult {
  newConfidence: number
  reasoning: string
}

export async function recomputeConfidenceFromAction(
  action: ActionInput,
  objective: ObjectiveSnapshot,
  sweepId: string
): Promise<RecomputeResult> {
  const supabase = createClient()

  const reservationLine = objective.reservation_price != null
    ? `\nReservation / floor price: $${objective.reservation_price.toLocaleString()}`
    : ''
  const targetLine = objective.target_date
    ? `\nTarget date: ${objective.target_date}`
    : ''
  const classLine = action.action_class
    ? `\n  Category: ${action.action_class}`
    : ''

  // Static rules block — cached across all recompute calls.
  const STATIC_RECOMPUTE_SYSTEM = `You are a confidence scoring engine for a personal objective tracking system.

A user just logged a real-world action they took. Use it as first-party ground truth — user-reported events are the most reliable signal you have.

Scoring rules:
- First-party action reports carry the highest evidential weight
- Typical directional effects for resale objectives:
    listed / posted          → +5 to +12 (progress; now in market)
    price_change (reduction) → +8 to +18 (increased buyer urgency)
    inquiry / showing        → +8 to +15 (demand signal)
    offer at/above floor     → +20 to +30 (near-confirmation for soft objectives)
    offer below floor        → −5 to 0 (decision trigger, not failure)
    no activity / stale      → −5 to −15
- For soft/reservation objectives: confidence = P(terms met at or above floor by horizon)
- Never move more than 20 points in either direction from a single action
- Floor: 5. Ceiling: 95. Stay within [5, 95] after the update.

Return ONLY valid JSON — no markdown, no preamble:
{"new_confidence": <integer>, "reasoning": "<one sentence citing the specific action>"}`

  // Dynamic block — objective + action specifics, varies per call.
  const dynamicContext = `Current confidence: ${objective.confidence}%
Objective: ${objective.title}
Outcome: ${objective.outcome}
Deadline type: ${objective.deadline_type === 'soft' ? 'soft (reservation/floor — "retained" at floor price is a valid success)' : 'hard (must complete by date)'}${reservationLine}${targetLine}

User's logged action:
  Date: ${action.action_date}
  Description: ${action.description}${classLine}`

  let newConfidence = objective.confidence
  let reasoning = 'Action logged; confidence unchanged.'

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      system: [
        { type: 'text', text: STATIC_RECOMPUTE_SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: dynamicContext },
      ] satisfies TextBlockParam[],
      messages: [{ role: 'user', content: 'Recompute confidence.' }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { new_confidence?: number; reasoning?: string }
      if (typeof parsed.new_confidence === 'number') {
        // Enforce ±20 max delta and [5, 95] absolute bounds
        const delta = Math.max(-20, Math.min(20, parsed.new_confidence - objective.confidence))
        newConfidence = Math.max(5, Math.min(95, objective.confidence + delta))
      }
      if (typeof parsed.reasoning === 'string' && parsed.reasoning.length > 0) {
        reasoning = parsed.reasoning
      }
    }
  } catch (err) {
    console.error('[recomputeConfidence] Haiku call failed:', err)
    // Return unchanged confidence — never block the action log on this
  }

  // Write confidence_scores row — signal_id is the grounding source.
  // user_id is NOT NULL in the schema; omitting it caused a silent NOT NULL
  // violation that threw before objectives.update() was reached (Bug 3).
  await supabase.from('confidence_scores').insert({
    objective_id: objective.id,
    user_id: objective.user_id,
    sweep_id: sweepId,
    score: newConfidence,
    factors: {
      source: 'user_action',
      signal_id: action.signal_id,
      action_class: action.action_class,
      confidence_blocked: false,
      grounded_signal_count: 1,
    },
    signal_gap: null,
    recommended_actions: [],
  })

  // Update objective confidence
  await supabase.from('objectives').update({
    confidence_prev: objective.confidence,
    confidence: newConfidence,
    updated_at: new Date().toISOString(),
  }).eq('id', objective.id)

  return { newConfidence, reasoning }
}
