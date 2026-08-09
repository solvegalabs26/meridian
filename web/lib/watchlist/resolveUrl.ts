import { getAnthropicClient } from '@/lib/anthropic/client'
import { createServiceClient } from '@/lib/supabase/server'

export type ResolveUrlResult = {
  watchSourceId: string
  resolvedUrl: string | null
  confidence: number | null
  requiresConfirmation: boolean
  rationale: string | null
  written: boolean
  note?: string
}

type HaikuPayload = {
  resolved_url: string
  rationale: string
  confidence: number
  requires_confirmation: boolean
}

export async function resolveUrl({
  objectiveId,
  urlProvided,
}: {
  objectiveId: string
  urlProvided: string
}): Promise<ResolveUrlResult> {
  const supabase = createServiceClient()

  const [{ data: objective, error: objErr }, { data: watchSource, error: wsErr }] =
    await Promise.all([
      supabase
        .from('objectives')
        .select('title, success_condition, category')
        .eq('id', objectiveId)
        .single(),
      supabase
        .from('watch_sources')
        .select('id')
        .eq('objective_id', objectiveId)
        .eq('url_provided', urlProvided)
        .single(),
    ])

  if (objErr || !objective) {
    throw new Error(`resolveUrl: objective not found (${objectiveId}): ${objErr?.message}`)
  }
  if (wsErr || !watchSource) {
    throw new Error(
      `resolveUrl: watch_source not found for objective ${objectiveId} / url "${urlProvided}": ${wsErr?.message}`
    )
  }

  const anthropic = getAnthropicClient()

  const userMessage = [
    `OBJECTIVE: ${objective.title}`,
    `SUCCESS CONDITION: ${objective.success_condition ?? 'Not specified'}`,
    `PROVIDED URL OR COMPANY: ${urlProvided}`,
    `CATEGORY: ${objective.category}`,
    '',
    'Return JSON only:',
    '{ "resolved_url": string, "rationale": string, "confidence": number (0.0–1.0), "requires_confirmation": boolean }',
  ].join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:
      "You are Meridian's URL resolution engine. Given an objective and a provided URL or company name, determine the most specific, direct URL that would contain evidence of progress toward this objective's success condition. Return ONLY valid JSON — no preamble, no markdown, no explanation outside the JSON.",
    messages: [{ role: 'user', content: userMessage }],
  })

  const rawText = msg.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let payload: HaikuPayload
  try {
    payload = JSON.parse(rawText) as HaikuPayload
  } catch {
    throw new Error(`resolveUrl: Haiku returned non-JSON: ${rawText.slice(0, 300)}`)
  }

  const { resolved_url, rationale, confidence } = payload

  // Below 0.60 — leave url_resolved null, don't write
  if (confidence < 0.60) {
    return {
      watchSourceId: watchSource.id as string,
      resolvedUrl: null,
      confidence,
      requiresConfirmation: false,
      rationale,
      written: false,
      note: `Confidence ${confidence} below 0.60 threshold — url_resolved not written`,
    }
  }

  // 0.60–0.84 → write + flag for confirmation; ≥0.85 → write direct
  const requiresConfirmation = confidence < 0.85

  await supabase
    .from('watch_sources')
    .update({
      url_resolved: resolved_url,
      url_resolved_at: new Date().toISOString(),
      requires_confirmation: requiresConfirmation,
    })
    .eq('id', watchSource.id as string)
    .throwOnError()

  return {
    watchSourceId: watchSource.id as string,
    resolvedUrl: resolved_url,
    confidence,
    requiresConfirmation,
    rationale,
    written: true,
  }
}
