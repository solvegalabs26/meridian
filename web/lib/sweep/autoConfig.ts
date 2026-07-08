/**
 * autoConfig — fires after objective creation (fire-and-forget).
 *
 * 1. Classifies the objective into the closed taxonomy (objective_type)
 * 2. For resale types: extracts structured context (year, make, model, price
 *    floor, condition, region) and writes to objectives.context
 * 3. Seeds a rules_filter row from objective_type_sources for the detected type
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

async function extractResaleContext(input: ObjectiveInput): Promise<ResaleContext> {
  const corpus = [input.title, input.outcome, input.notes ?? '', input.goal_context ?? '']
    .filter(Boolean).join('\n')

  const prompt = `Extract structured resale asset details from the text below. Return ONLY valid JSON — no markdown, no explanation.

Text:
<objective_text>
${corpus.slice(0, 1200)}
</objective_text>

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

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return emptyResaleContext()
    return { ...emptyResaleContext(), ...JSON.parse(jsonMatch[0]) } as ResaleContext
  } catch {
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
  const supabase = createServiceClient()

  // 1. Classify
  const objectiveType = await classifyObjectiveType(input)
  if (!objectiveType) return

  // 2. For resale types, extract structured context in parallel with source load
  const isResale = RESALE_TYPES.has(objectiveType)
  const [resaleContext, sourcesResult, objResult] = await Promise.all([
    isResale ? extractResaleContext(input) : Promise.resolve(null),
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

  const sources = sourcesResult.data ?? []
  const obj = objResult.data
  if (!obj) return

  // 3. Write objective_type + context in one update
  const contextUpdate: Record<string, unknown> = { objective_type: objectiveType }
  if (isResale && resaleContext) {
    // Only write non-null fields so we don't stomp user-supplied context
    const filtered = Object.fromEntries(
      Object.entries(resaleContext).filter(([, v]) => v !== null)
    )
    if (Object.keys(filtered).length > 0) {
      contextUpdate.context = filtered
    }
  }
  await supabase.from('objectives').update(contextUpdate).eq('id', objectiveId)

  // 4. Seed rules_filter — idempotent upsert
  if (sources.length === 0) return

  const keywordsHigh = sources.filter(s => s.tier === 1).map(s => s.source_name)
  const keywordsMed  = sources.filter(s => s.tier === 2).map(s => s.source_name)

  // Inject extracted entities as additional high-value keywords
  if (isResale && resaleContext) {
    const entities = [resaleContext.year, resaleContext.make, resaleContext.model]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
    keywordsHigh.push(...entities)
  }

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
