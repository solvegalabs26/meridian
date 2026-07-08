/**
 * autoConfig — fires after objective creation (fire-and-forget).
 *
 * 1. Classifies the objective into the closed taxonomy (objective_type)
 * 2. Seeds a rules_filter row from objective_type_sources for the detected type
 *
 * Uses the service-role client so it can run outside the authenticated request
 * context. Errors are caught by the caller and logged; they never fail the
 * creation response.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'

// Closed taxonomy — extend as new types are seeded into objective_type_sources.
const TAXONOMY_KEYS = [
  'asset.resale.recreational_vehicle',
  'asset.resale.real_estate',
  'asset.resale.vehicle',
  'asset.resale.boat',
  'career.job_search',
  'career.promotion',
  'finance.debt_payoff',
  'finance.savings_goal',
  'finance.investment',
  'health.fitness',
  'health.medical',
  'business.revenue',
  'business.hiring',
  'personal.travel',
  'personal.education',
] as const

type TaxonomyKey = typeof TAXONOMY_KEYS[number]

interface ObjectiveInput {
  title: string
  outcome: string
  category: string
}

async function classifyObjectiveType(input: ObjectiveInput): Promise<TaxonomyKey | null> {
  const prompt = `Classify this objective into exactly one taxonomy key from the list below, or "none" if no key fits well.

Objective title: "${input.title}"
Outcome: "${input.outcome}"
Category: "${input.category}"

Taxonomy keys:
${TAXONOMY_KEYS.map(k => `- ${k}`).join('\n')}

Rules:
- Return ONLY the matching key (e.g. "asset.resale.recreational_vehicle") or the word "none"
- asset.resale.recreational_vehicle = selling an RV, motorhome, camper, trailer, 5th wheel
- asset.resale.real_estate = selling a house, condo, land, property
- asset.resale.vehicle = selling a car, truck, motorcycle (not RV)
- asset.resale.boat = selling a boat, watercraft
- Use "none" when the objective is advisory, informational, or doesn't match

Respond with just the key or "none". No other text.`

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (msg.content[0].type === 'text' ? msg.content[0].text : '').trim().toLowerCase()
    if (raw === 'none') return null
    const match = TAXONOMY_KEYS.find(k => k === raw)
    return match ?? null
  } catch {
    return null
  }
}

export async function autoConfigObjective(
  objectiveId: string,
  input: ObjectiveInput
): Promise<void> {
  const supabase = createServiceClient()

  // 1. Classify
  const objectiveType = await classifyObjectiveType(input)
  if (!objectiveType) return

  // 2. Write objective_type back to the row
  await supabase
    .from('objectives')
    .update({ objective_type: objectiveType })
    .eq('id', objectiveId)

  // 3. Load sources for this type (tier 1 + 2 only for initial seed)
  const { data: sources } = await supabase
    .from('objective_type_sources')
    .select('source_name, tier, weight')
    .eq('taxonomy_key', objectiveType)
    .lte('tier', 2)
    .order('tier')
    .order('weight', { ascending: false })

  if (!sources || sources.length === 0) return

  // 4. Seed rules_filter row — high-relevance source names as keywords_high,
  //    tier-2 sources as keywords_med. Upsert so re-runs are idempotent.
  const keywordsHigh = sources.filter(s => s.tier === 1).map(s => s.source_name)
  const keywordsMed  = sources.filter(s => s.tier === 2).map(s => s.source_name)

  // Fetch user_id from the objective (needed for rules_filter FK)
  const { data: obj } = await supabase
    .from('objectives')
    .select('user_id')
    .eq('id', objectiveId)
    .single()

  if (!obj) return

  await supabase
    .from('rules_filter')
    .upsert({
      objective_id:  objectiveId,
      user_id:       obj.user_id,
      keywords_high: keywordsHigh,
      keywords_med:  keywordsMed,
      keywords_low:  [],
      keywords_block: [],
      source_tiers: {
        tier1: keywordsHigh,
        tier2: keywordsMed,
        tier3: [],
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'objective_id' })
}
