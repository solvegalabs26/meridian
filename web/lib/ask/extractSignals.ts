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

// Returns the subset of keywords that appear in the question
function matchKeywords(question: string, keywords: string[]): string[] {
  const q = normalise(question)
  return keywords.filter(kw => q.includes(normalise(kw)))
}

// Classify the concern type from the question for signal_type
function classifyConcern(question: string): string {
  const q = normalise(question)
  if (/\b(risk|danger|threat|warn|embargo|sanction|tariff|drop|fall|decline|lose|loss)\b/.test(q)) return 'risk'
  if (/\b(opportunit|upside|grow|gain|increase|rise|surge|jump|best time|right time)\b/.test(q)) return 'opportunity'
  return 'neutral'
}

export async function extractAskSignals(
  supabase: SupabaseClient,
  params: {
    userId: string
    askQueryId: string
    question: string
    objectiveContext: Objective[]   // already loaded in the route — reuse it
  }
): Promise<AskSignalInsert[]> {
  const { userId, askQueryId, question, objectiveContext } = params
  const signals: AskSignalInsert[] = []
  const signalType = classifyConcern(question)

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

  return signals
}
