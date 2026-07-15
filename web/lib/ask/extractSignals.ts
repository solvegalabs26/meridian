// lib/ask/extractSignals.ts
// FF-018 Phase A — Layer 1: keyword extraction from ask question text.
//
// Matches the question against each objective's signal_keywords array.
// No AI call — pure string matching. Returns signal rows ready for DB insert.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AskSignalInsert {
  user_id: string
  objective_ids: string[]
  ask_query_id: string
  sweep_id: null
  title: string
  body: string
  source: string           // 'ask_query'
  source_type: string      // 'internal'
  relevance: string
  signal_type: string
  signal_class: string     // 'internal'
  is_cross_dep: boolean
  is_read: boolean
}

interface Objective {
  id: string
  title: string
  signal_keywords: string[] | null
}

// Normalise text for matching: lowercase, collapse whitespace
function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Returns the subset of keywords that appear in the question.
// Splits each keyword into tokens and checks that all significant tokens
// (>= 4 chars) are present individually — exact substring matching breaks
// on partial phrases like "boeing max 10" vs "boeing 737 max 10 certification".
function matchKeywords(question: string, keywords: string[]): string[] {
  const q = normalise(question)
  return keywords.filter(kw => {
    const tokens = normalise(kw).split(/\s+/).filter(t => t.length >= 4)
    if (tokens.length === 0) return q.includes(normalise(kw))
    return tokens.every(t => q.includes(t))
  })
}

// Classify the concern type from the question for signal_type
function classifyConcern(question: string): string {
  const q = normalise(question)
  if (/\b(risk|danger|threat|warn|embargo|sanction|tariff|drop|fall|decline|lose|loss)\b/.test(q)) return 'risk'
  if (/\b(opportunit|upside|grow|gain|increase|rise|surge|jump|best time|right time)\b/.test(q)) return 'opportunity'
  return 'neutral'
}

export interface ExtractAskSignalsResult {
  signals: AskSignalInsert[]
  matchedObjectiveIds: string[]
}

export async function extractAskSignals(
  supabase: SupabaseClient,
  params: {
    userId: string
    askQueryId: string
    question: string
    objectiveContext: Objective[]
  }
): Promise<ExtractAskSignalsResult> {
  const { userId, askQueryId, question } = params
  const signals: AskSignalInsert[] = []
  const signalType = classifyConcern(question)

  // Fetch all active objectives with keywords directly — the route caps at 12
  // which can exclude objectives that have signal_keywords populated.
  const { data: allObjectives, error: objError } = await supabase
    .from('objectives')
    .select('id, title, signal_keywords')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('signal_keywords', 'is', null)

  if (objError) {
    console.error('[ask:extract] failed to load objectives:', objError.message)
    return { signals: [], matchedObjectiveIds: [] }
  }

  const objectiveContext: Objective[] = allObjectives ?? []
  console.log(
    '[ask:extract] objectives with keywords:',
    objectiveContext.length,
    '| sample:',
    objectiveContext[0]?.signal_keywords?.slice(0, 2)
  )

  for (const obj of objectiveContext) {
    const keywords = obj.signal_keywords ?? []
    if (keywords.length === 0) continue

    const matched = matchKeywords(question, keywords)
    if (matched.length === 0) continue

    signals.push({
      user_id: userId,
      objective_ids: [obj.id],
      ask_query_id: askQueryId,
      sweep_id: null,
      title: `User asked about: ${matched.slice(0, 3).join(', ')}`,
      body: question,
      source: 'ask_query',
      source_type: 'internal',
      relevance: matched.length >= 3 ? 'high' : matched.length === 2 ? 'medium' : 'low',
      signal_type: signalType,
      signal_class: 'internal',
      is_cross_dep: false,
      is_read: false,
    })
  }

  // Write an ask episode for each matched objective (Phase E)
  const perObjective = new Map<string, AskSignalInsert[]>()
  for (const s of signals) {
    const oid = s.objective_ids[0]
    if (!perObjective.has(oid)) perObjective.set(oid, [])
    perObjective.get(oid)!.push(s)
  }
  for (const [objectiveId, objSignals] of Array.from(perObjective.entries())) {
    await writeAskEpisode(
      supabase,
      userId,
      objectiveId,
      question,
      objSignals.map(s => ({
        signal_text: s.body,
        relevance_score: s.relevance === 'high' ? 3 : s.relevance === 'medium' ? 2 : 1,
        concern_class: s.signal_type,
      }))
    )
  }

  return {
    signals,
    matchedObjectiveIds: signals.map(s => s.objective_ids[0]),
  }
}

async function writeAskEpisode(
  supabase: SupabaseClient,
  userId: string,
  objectiveId: string,
  question: string,
  matchedSignals: Array<{ signal_text: string; relevance_score: number; concern_class: string }>
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('objective_episodes')
      .select('episode_number')
      .eq('objective_id', objectiveId)
      .order('episode_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextEpisodeNumber = (existing?.episode_number ?? 0) + 1

    console.log(`[ask:episode] writing episode ${nextEpisodeNumber} for objective ${objectiveId}`)

    const topSignals = matchedSignals.slice(0, 3).map(s => ({
      title: s.signal_text.slice(0, 120),
      relevance: s.relevance_score >= 3 ? 'high' : s.relevance_score === 2 ? 'medium' : 'low',
      body_excerpt: s.signal_text,
      signal_class: 'internal',
    }))

    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    await supabase.from('objective_episodes').insert({
      user_id: userId,
      objective_id: objectiveId,
      episode_number: nextEpisodeNumber,
      source: 'ask_query',
      signal_count: matchedSignals.length,
      top_signals: topSignals,
      cross_deps_detected: [],
      narrative: `User asked on ${date}: "${question.slice(0, 200)}${question.length > 200 ? '...' : ''}"`,
      sweep_id: null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ask:episode] failed to write episode:', msg)
    // Non-fatal — never block signal extraction
  }
}
