export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/api/ask', request.url), 308)
}
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { userVoiceTier, canUseFull } from '@/lib/voice/voiceTier'
import { buildConciergeContext } from '@/lib/concierge/buildConciergeContext'
import { buildConciergePrompt, type ConciergeResponse } from '@/lib/concierge/conciergePrompt'

export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL('/api/ask', req.url), 308)
}

export async function POST_legacy(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Tier gate — Command only
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, account_type, voice_addon, ask_credits')
    .eq('id', user.id)
    .single()

  const voiceTier = userVoiceTier({
    pricing_tier: (profile as { tier?: string | null } | null)?.tier ?? null,
    account_type: profile?.account_type ?? null,
    voice_addon: (profile as { voice_addon?: boolean | null } | null)?.voice_addon ?? false,
  })
  if (!canUseFull(voiceTier)) {
    return NextResponse.json({ upgrade: true }, { status: 403 })
  }

  // Credits gate — Concierge costs 2
  const askCredits: number = (profile as { ask_credits?: number | null } | null)?.ask_credits ?? 0
  if (askCredits < 2) {
    return NextResponse.json({ error: 'Insufficient ask credits' }, { status: 402 })
  }

  const body = await req.json() as { question?: string }
  const question = body.question?.trim()
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

  // Build context + prompt
  const context = await buildConciergeContext(supabase, user.id)
  const prompt = buildConciergePrompt(question, context)

  // Call Sonnet
  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  let response: ConciergeResponse
  try {
    response = JSON.parse(raw.replace(/```json|```/g, '').trim()) as ConciergeResponse
  } catch {
    response = {
      answer_prose: raw,
      ranked_actions: [],
      log_offer: false,
      signals_to_watch: [],
      needs_sweep: false,
      needs_sweep_reason: null,
    }
  }

  // Decrement ask_credits by 2
  await supabase
    .from('profiles')
    .update({ ask_credits: Math.max(0, askCredits - 2) })
    .eq('id', user.id)

  return NextResponse.json({ response })
}
