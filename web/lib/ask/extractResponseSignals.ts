// lib/ask/extractResponseSignals.ts
// FF-018 Phase B — Layer 2: Haiku extraction on Claude response content.
//
// Takes the Ask Meridian response text and extracts factual claims,
// recommended actions, and sentiment. Writes signal rows to the signals
// table and updates the ask_queries row with the extracted payload.

import { getAnthropicClient } from '@/lib/anthropic/client'
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'
import type { SupabaseClient } from '@supabase/supabase-js'

const STATIC_EXTRACT_SYSTEM = `You are a signal extraction engine for Meridian Arc.
Given a question and response about a user's objective, extract:
1. Up to 5 factual claims relevant to the objective (one sentence each)
2. Up to 3 recommended actions (imperative, specific, actionable)
3. Overall sentiment on objective trajectory: "positive", "neutral", or "negative"
Return JSON only, no prose. Schema: { "claims": string[], "actions": string[], "sentiment": "positive"|"neutral"|"negative" }`

interface ResponseExtraction {
  claims: string[]
  actions: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
}

export async function extractResponseSignals(
  supabase: SupabaseClient,
  params: {
    userId: string
    askQueryId: string
    question: string
    response: string
    objectiveIds: string[]
  }
): Promise<void> {
  const { userId, askQueryId, question, response, objectiveIds } = params

  // If no objectives matched Phase A there is nothing to link signals to.
  if (objectiveIds.length === 0) return

  let extraction: ResponseExtraction

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: [
        { type: 'text', text: STATIC_EXTRACT_SYSTEM, cache_control: { type: 'ephemeral' } },
      ] satisfies TextBlockParam[],
      messages: [
        {
          role: 'user',
          content: `Question: ${question}\n\nResponse: ${response}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const rawJson = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
    extraction = JSON.parse(rawJson) as ResponseExtraction
  } catch (err) {
    console.error('[ask:extract-b] Haiku call or JSON parse failed:', err)
    await supabase
      .from('ask_queries')
      .update({ extraction_status: 'failed' })
      .eq('id', askQueryId)
    return
  }

  const claims: string[] = Array.isArray(extraction.claims) ? extraction.claims.slice(0, 5) : []
  const actions: string[] = Array.isArray(extraction.actions) ? extraction.actions.slice(0, 3) : []
  const sentiment = extraction.sentiment ?? 'neutral'

  const signalRows = [
    ...claims.map(claim => ({
      user_id: userId,
      objective_ids: objectiveIds,
      ask_query_id: askQueryId,
      sweep_id: null,
      title: `Claim: ${claim.slice(0, 80)}`,
      body: claim,
      source: 'ask_query',
      source_type: 'internal',
      relevance: 'medium',
      signal_type: 'neutral',
      signal_class: 'internal',
      is_cross_dep: false,
      is_read: false,
    })),
    ...actions.map(action => ({
      user_id: userId,
      objective_ids: objectiveIds,
      ask_query_id: askQueryId,
      sweep_id: null,
      title: `Action: ${action.slice(0, 80)}`,
      body: action,
      source: 'ask_query',
      source_type: 'internal',
      relevance: 'high',
      signal_type: 'opportunity',
      signal_class: 'internal',
      is_cross_dep: false,
      is_read: false,
    })),
  ]

  if (signalRows.length > 0) {
    const { error: signalError } = await supabase.from('signals').insert(signalRows)
    if (signalError) console.error('[ask:extract-b] signal insert failed:', signalError.message)
  }

  await supabase
    .from('ask_queries')
    .update({
      extraction_status: 'complete',
      extracted_signals: { claims, actions, sentiment },
    })
    .eq('id', askQueryId)
}
