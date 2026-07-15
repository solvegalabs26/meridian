/**
 * autoConfig — fires after objective creation.
 *
 * 1. Classifies the objective into the closed taxonomy (objective_type)
 * 2. For resale types: extracts structured context (year, make, model, price
 *    floor, condition, region) and writes to objectives.context
 * 3. Seeds a rules_filter row from objective_type_sources for the detected type
 *
 * Uses the service-role client so it can run outside the authenticated request
 * context. Errors are logged to Vercel via console.error; they never fail the
 * creation response. All checkpoints are logged to console.log so the call
 * chain is visible in Vercel Function logs under the creation request.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'

// Static system prompts — cached across all autoConfig calls.
const STATIC_CLASSIFY_SYSTEM = `You are an objective classification engine. Classify the user's objective into exactly one taxonomy key from the list below, or "none" if no key fits well.

Taxonomy keys:
- asset.resale.recreational_vehicle
- asset.resale.real_estate
- asset.resale.vehicle
- asset.resale.boat
- career.job_search
- career.promotion
- finance.debt_payoff
- finance.savings_goal
- finance.investment
- health.fitness
- health.medical
- business.revenue
- business.hiring
- personal.travel
- personal.education

Rules:
- Return ONLY the matching key (e.g. "asset.resale.recreational_vehicle") or the word "none"
- asset.resale.recreational_vehicle = selling an RV, motorhome, camper, trailer, 5th wheel
- asset.resale.real_estate = selling a house, condo, land, property
- asset.resale.vehicle = selling a car, truck, motorcycle (not RV)
- asset.resale.boat = selling a boat, watercraft
- Use "none" when the objective is advisory, informational, or doesn't match

Respond with just the key or "none". No other text.`

const STATIC_EXTRACT_CONTEXT_SYSTEM = `You are a structured data extraction engine. Extract resale asset details from the user's objective text. Return ONLY valid JSON — no markdown, no explanation.

Return this exact shape (use null for any field not mentioned):
{
  "year": "string or null — model year of the asset (e.g. '2022')",
  "make": "string or null — brand/manufacturer (e.g. 'Grand Design', 'Toyota')",
  "model": "string or null — model name or floorplan (e.g. '31MB', 'Tacoma')",
  "condition": "string or null — 'excellent' | 'good' | 'fair' | 'poor' or descriptive phrase",
  "region": "string or null — city, state, or region mentioned",
  "listing_price": number or null — asking/listing price in USD if mentioned,
  "floor_price": number or null — minimum acceptable price/floor in USD if mentioned,
  "payoff": number or null — loan payoff amount in USD if mentioned
}`

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

const RESALE_TYPES = new Set<TaxonomyKey>([
  'asset.resale.recreational_vehicle',
  'asset.resale.real_estate',
  'asset.resale.vehicle',
  'asset.resale.boat',
])

export interface ResaleContext {
  year: string | null
  make: string | null
  model: string | null
  condition: string | null
  region: string | null
  listing_price: number | null
  floor_price: number | null
  payoff: number | null
}

export interface ObjectiveInput {
  title: string
  outcome: string
  category: string
  notes?: string | null
  goal_context?: string | null
}

async function classifyObjectiveType(
  objectiveId: string,
  input: ObjectiveInput
): Promise<TaxonomyKey | null> {
  const userContent = `Objective title: "${input.title}"
Outcome: "${input.outcome}"
Category: "${input.category}"`

  console.log(`[autoConfig:classify] ${objectiveId} — calling Haiku for "${input.title}"`)

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      system: [
        { type: 'text', text: STATIC_CLASSIFY_SYSTEM, cache_control: { type: 'ephemeral' } },
      ] satisfies TextBlockParam[],
      messages: [{ role: 'user', content: userContent }],
    })
    console.log('[autoConfig:classify:cache]', JSON.stringify(msg.usage))
    const raw = (msg.content[0].type === 'text' ? msg.content[0].text : '').trim().toLowerCase()
    console.log(`[autoConfig:classify] ${objectiveId} — Haiku returned: "${raw}"`)

    if (raw === 'none') return null
    const match = TAXONOMY_KEYS.find(k => k === raw)
    if (!match) {
      console.warn(`[autoConfig:classify] ${objectiveId} — response "${raw}" did not match any taxonomy key`)
    }
    return match ?? null
  } catch (err) {
    console.error(`[autoConfig:classify] ${objectiveId} — Anthropic API error:`, err)
    return null
  }
}

async function extractResaleContext(
  objectiveId: string,
  input: ObjectiveInput
): Promise<ResaleContext> {
  const corpus = [input.title, input.outcome, input.notes ?? '', input.goal_context ?? '']
    .filter(Boolean).join('\n')

  const userContent = `<objective_text>
${corpus.slice(0, 1200)}
</objective_text>`

  console.log(`[autoConfig:context] ${objectiveId} — calling Haiku for resale context extraction`)

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: [
        { type: 'text', text: STATIC_EXTRACT_CONTEXT_SYSTEM, cache_control: { type: 'ephemeral' } },
      ] satisfies TextBlockParam[],
      messages: [{ role: 'user', content: userContent }],
    })
    console.log('[autoConfig:context:cache]', JSON.stringify(msg.usage))
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
    console.log(`[autoConfig:context] ${objectiveId} — Haiku returned: ${raw.slice(0, 200)}`)

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn(`[autoConfig:context] ${objectiveId} — no JSON found in response`)
      return emptyResaleContext()
    }
    const parsed = { ...emptyResaleContext(), ...JSON.parse(jsonMatch[0]) } as ResaleContext
    console.log(`[autoConfig:context] ${objectiveId} — parsed context:`, JSON.stringify(parsed))
    return parsed
  } catch (err) {
    console.error(`[autoConfig:context] ${objectiveId} — error:`, err)
    return emptyResaleContext()
  }
}

function emptyResaleContext(): ResaleContext {
  return { year: null, make: null, model: null, condition: null, region: null, listing_price: null, floor_price: null, payoff: null }
}

export async function autoConfigObjective(
  objectiveId: string,
  input: ObjectiveInput
): Promise<void> {
  console.log(`[autoConfig] START ${objectiveId} — title: "${input.title}", category: "${input.category}"`)

  const supabase = createServiceClient()

  // 1. Classify
  const objectiveType = await classifyObjectiveType(objectiveId, input)

  if (!objectiveType) {
    console.log(`[autoConfig] ${objectiveId} — no taxonomy match; objective_type remains null (expected for non-resale/non-classified goals)`)
    return
  }

  console.log(`[autoConfig] ${objectiveId} — matched taxonomy: ${objectiveType}`)

  // 2. For resale types, extract structured context in parallel with source load
  const isResale = RESALE_TYPES.has(objectiveType)
  const [resaleContext, sourcesResult, objResult] = await Promise.all([
    isResale ? extractResaleContext(objectiveId, input) : Promise.resolve(null),
    supabase
      .from('objective_type_sources')
      .select('source_name, tier, weight')
      .eq('taxonomy_key', objectiveType)
      .lte('tier', 2)
      .order('tier')
      .order('weight', { ascending: false }),
    supabase
      .from('objectives')
      .select('user_id')
      .eq('id', objectiveId)
      .single(),
  ])

  if (sourcesResult.error) {
    console.error(`[autoConfig] ${objectiveId} — error loading objective_type_sources:`, sourcesResult.error)
  }
  if (objResult.error) {
    console.error(`[autoConfig] ${objectiveId} — error loading objective user_id:`, objResult.error)
  }

  const sources = sourcesResult.data ?? []
  const obj = objResult.data
  console.log(`[autoConfig] ${objectiveId} — sources loaded: ${sources.length} rows; obj found: ${!!obj}`)

  if (!obj) {
    console.error(`[autoConfig] ${objectiveId} — objective not found in DB; aborting`)
    return
  }

  // 3. Write objective_type + context in one update
  const contextUpdate: Record<string, unknown> = { objective_type: objectiveType }
  if (isResale && resaleContext) {
    const filtered = Object.fromEntries(
      Object.entries(resaleContext).filter(([, v]) => v !== null)
    )
    if (Object.keys(filtered).length > 0) {
      contextUpdate.context = filtered
    }
  }

  console.log(`[autoConfig] ${objectiveId} — writing objective_type=${objectiveType}, context keys: ${Object.keys(contextUpdate.context as object ?? {}).join(', ') || 'none'}`)
  const { error: updateError } = await supabase
    .from('objectives')
    .update(contextUpdate)
    .eq('id', objectiveId)

  if (updateError) {
    console.error(`[autoConfig] ${objectiveId} — objectives.update failed:`, updateError)
  } else {
    console.log(`[autoConfig] ${objectiveId} — objectives.update OK`)
  }

  // 4. Seed rules_filter — idempotent upsert
  if (sources.length === 0) {
    console.log(`[autoConfig] ${objectiveId} — no sources for ${objectiveType}; skipping rules_filter upsert`)
    return
  }

  const keywordsHigh = sources.filter(s => s.tier === 1).map(s => s.source_name)
  const keywordsMed  = sources.filter(s => s.tier === 2).map(s => s.source_name)

  if (isResale && resaleContext) {
    const entities = [resaleContext.year, resaleContext.make, resaleContext.model]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
    keywordsHigh.push(...entities)
  }

  console.log(`[autoConfig] ${objectiveId} — upserting rules_filter: high=[${keywordsHigh.join(', ')}] med=[${keywordsMed.join(', ')}]`)
  const { error: upsertError } = await supabase
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

  if (upsertError) {
    console.error(`[autoConfig] ${objectiveId} — rules_filter upsert failed:`, upsertError)
  } else {
    console.log(`[autoConfig] ${objectiveId} — rules_filter upsert OK`)
  }

  console.log(`[autoConfig] DONE ${objectiveId}`)
}
