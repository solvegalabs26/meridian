// app/api/ask/route.ts
// FF-017 — Ask Meridian: On-Demand Intelligence Queries
// Solvega Labs LLC · Meridian Arc · Confidential

import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { extractAskSignals } from '@/lib/ask/extractSignals'
import { extractResponseSignals } from '@/lib/ask/extractResponseSignals'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── Tier gate ──────────────────────────────────────────────────────────────
// command=10, accelerator=3 (+credits), explorer=1 (teaser), trial/null=0
const ASK_LIMITS: Record<string, number> = {
  command: 10,
  accelerator: 3,
  explorer: 1,
  trial: 0,
}

function getEffectiveTier(profile: {
  pricing_tier: string | null
  tier: string | null
  complimentary_expires_at: string | null
}): string {
  // complimentary_expires_at check fires before all other tier logic (per MPB v7.9)
  if (
    profile.complimentary_expires_at &&
    new Date(profile.complimentary_expires_at) > new Date()
  ) {
    return 'explorer'
  }
  const raw = profile.pricing_tier ?? profile.tier ?? 'trial'
  if (raw.includes('explorer')) return 'explorer'
  if (raw.includes('accelerator')) return 'accelerator'
  if (raw.includes('command')) return 'command'
  return raw
}

// ── Optional Brave Search ──────────────────────────────────────────────────
// Set BRAVE_SEARCH_API_KEY in Vercel env to enable live web data.
// Without the key the route still works — Claude answers from training
// knowledge + objective context, and web_search_used = false.
async function braveSearch(query: string): Promise<string> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) return ''

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
      query
    )}&count=5&text_decorations=false`

    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      // Hard 6-second timeout so a slow search never blocks the user
      signal: AbortSignal.timeout(6000),
    })

    if (!resp.ok) return ''

    const data = await resp.json()
    const results: Array<{ title: string; url: string; description?: string }> =
      data.web?.results ?? []

    return results
      .slice(0, 5)
      .map(
        (r) =>
          `[${r.title}](${r.url})\n${r.description ?? '(no snippet)'}`
      )
      .join('\n\n')
  } catch {
    // Timeout or network error — degrade gracefully
    return ''
  }
}

// ── Phase C: synchronous action candidate extraction ──────────────────────
function extractActionCandidates(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const actionPatterns = [
    /^(consider|check|contact|reach out|apply|submit|register|update|review|schedule|confirm|follow up)/i,
    /you should /i,
    /the next step is/i,
    /i recommend/i,
    /action:/i,
  ]
  return sentences
    .filter(s => actionPatterns.some(p => p.test(s.trim())))
    .map(s => s.trim())
    .slice(0, 3)
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse + validate request body
  let body: { question?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const question = (body.question ?? '').trim()
  if (!question || question.length > 1000) {
    return NextResponse.json(
      { error: 'question is required and must be under 1000 characters' },
      { status: 400 }
    )
  }

  // 3. Load profile for tier + credit check
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tier, pricing_tier, complimentary_expires_at, sweep_credits, ask_credits')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const effectiveTier = getEffectiveTier(profile)
  const baseLimit = ASK_LIMITS[effectiveTier] ?? 0

  // Explorer/trial gate
  if (baseLimit === 0) {
    return NextResponse.json(
      {
        error:
          'Ask Meridian is not available on your current plan. Upgrade to Explorer or higher to get started.',
        upgrade_required: true,
      },
      { status: 403 }
    )
  }

  // 4. Count this month's queries (RLS ensures user_id scope)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: monthlyCount, error: countError } = await supabase
    .from('ask_queries')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart.toISOString())

  if (countError) {
    console.error('[ask] Usage count failed:', countError.message)
    return NextResponse.json(
      { error: 'Failed to check usage. Please try again.' },
      { status: 500 }
    )
  }

  const used = monthlyCount ?? 0

  // 5. Enforce limit — ask_credits are overflow for all tiers;
  //    sweep_credits are a secondary fallback for Accelerator only.
  const askCredits = profile.ask_credits ?? 0
  let useAskCredit = false
  let useCredit = false

  if (used >= baseLimit) {
    if (askCredits > 0) {
      useAskCredit = true
    } else if (effectiveTier === 'accelerator' && (profile.sweep_credits ?? 0) > 0) {
      useCredit = true
    } else {
      const upgradeHint =
        effectiveTier === 'explorer'
          ? ' Upgrade to Command for 10/month.'
          : effectiveTier === 'accelerator'
          ? ' Add ask query credits in Settings or upgrade to Command.'
          : ''

      return NextResponse.json(
        {
          error: `You've used all ${baseLimit} Ask ${
            baseLimit === 1 ? 'query' : 'queries'
          } for this month.${upgradeHint}`,
          limit_reached: true,
          used,
          limit: baseLimit,
        },
        { status: 429 }
      )
    }
  }

  // 6. Load active objectives as context (no raw_response guard mirrors dashboard)
  const { data: objectives } = await supabase
    .from('objectives')
    .select('id, title, description, status, deadline, objective_type, context, signal_keywords')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(12)

  const objectiveContext = objectives ?? []

  // 7. Web search (optional, degrades gracefully)
  const searchSnippet = await braveSearch(question)
  const webSearchUsed = searchSnippet.length > 0

  // 8. Build Claude prompt
  const objectivesSummary =
    objectiveContext.length > 0
      ? objectiveContext
          .map((o) => {
            const deadline = o.deadline ? ` · deadline ${o.deadline}` : ''
            const type = o.objective_type ? ` [${o.objective_type}]` : ''
            return `- ${o.title}${type}${deadline}`
          })
          .join('\n')
      : 'No active objectives on file.'

  const systemPrompt = `You are Meridian Arc, an objective intelligence platform built by Solvega Labs.
Your job is to give the user a specific, grounded, actionable answer to their question.

Guidelines:
- Draw on current web data (provided below when available) and the user's personal objective context.
- Be direct. If you have a clear recommendation, state it plainly. Avoid hedging into vagueness.
- Connect your answer to the user's real objectives where relevant — this is what makes Meridian different from a generic search.
- Keep the response concise and readable. Prose is preferred over bullet-point soup.
- Do not hallucinate sources. If web data wasn't provided, say your answer is based on training knowledge through your cutoff.`

  const contextBlock = [
    webSearchUsed
      ? `## Current web search results\n${searchSnippet}`
      : '## Web search\nNot available for this query — answering from training knowledge.',
    `## User's active objectives\n${objectivesSummary}`,
    `## Question\n${question}`,
  ].join('\n\n---\n\n')

  // 9. Claude API call
  let responseText: string
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: contextBlock }],
    })

    responseText =
      message.content[0].type === 'text' ? message.content[0].text : ''
  } catch (aiError: unknown) {
    console.error('[ask] Anthropic API error:', aiError)
    return NextResponse.json(
      { error: 'Meridian is temporarily unavailable. Please try again in a moment.' },
      { status: 502 }
    )
  }

  // 10. Log to ask_queries (RLS write — user_id enforced by auth context)
  const { data: insertedQuery, error: insertError } = await supabase
    .from('ask_queries')
    .insert({
      user_id: user.id,
      question,
      response: responseText,
      objective_context: objectiveContext,
      web_search_used: webSearchUsed,
      credits_used: 1,
      extraction_status: 'pending',
    })
    .select('id')
    .single()

  if (insertError) {
    // Non-fatal: response already generated — log and continue
    console.error('[ask] Failed to log query:', insertError.message)
  }

  // 11. FF-018 Phase A + B — keyword extraction then Haiku response extraction.
  // Runs after insert so we have the ask_query_id for provenance.
  // Phase A runs first to get matched objective IDs; Phase B consumes them.
  // Fire-and-forget via waitUntil: errors are non-fatal, user already has response.
  if (insertedQuery?.id) {
    const queryId = insertedQuery.id
    waitUntil(
      (async () => {
        try {
          // Phase A — keyword match question → signals
          const { signals, matchedObjectiveIds } = await extractAskSignals(supabase, {
            userId: user.id,
            askQueryId: queryId,
            question,
            objectiveContext,
          })

          if (signals.length > 0) {
            const { error: signalError } = await supabase.from('signals').insert(signals)
            if (signalError) console.error('[ask:extract-a] signal insert failed:', signalError.message)
          }

          // Phase B — Haiku extracts claims/actions/sentiment from the response.
          // Also owns the final extraction_status write; if no objectives matched
          // Phase A, Phase B skips and we write no_match here instead.
          if (matchedObjectiveIds.length > 0) {
            await extractResponseSignals(supabase, {
              userId: user.id,
              askQueryId: queryId,
              question,
              response: responseText,
              objectiveIds: matchedObjectiveIds,
            })
          } else {
            await supabase
              .from('ask_queries')
              .update({
                extraction_status: 'no_match',
                extracted_signals: { signals_found: 0, matched_objectives: [] },
              })
              .eq('id', queryId)
          }
        } catch (err) {
          console.error('[ask:extract] extraction failed:', err)
          await supabase
            .from('ask_queries')
            .update({ extraction_status: 'failed' })
            .eq('id', queryId)
        }
      })()
    )
  }

  // 13. Deduct credits if applicable
  if (!insertError) {
    if (useAskCredit) {
      const { error: askCreditError } = await supabase
        .from('profiles')
        .update({ ask_credits: Math.max(0, askCredits - 1) })
        .eq('id', user.id)
      if (askCreditError) console.error('[ask] Failed to deduct ask credit:', askCreditError.message)
    } else if (useCredit) {
      const { error: sweepCreditError } = await supabase
        .from('profiles')
        .update({ sweep_credits: Math.max(0, (profile.sweep_credits ?? 1) - 1) })
        .eq('id', user.id)
      if (sweepCreditError) console.error('[ask] Failed to deduct sweep credit:', sweepCreditError.message)
    }
  }

  // 14. Return response
  const askCreditsRemaining = useAskCredit ? Math.max(0, askCredits - 1) : askCredits

  return NextResponse.json({
    response: responseText,
    web_search_used: webSearchUsed,
    ask_query_id: insertedQuery?.id ?? null,
    suggested_actions: extractActionCandidates(responseText),
    usage: {
      used: used + 1,
      limit: baseLimit,
      tier: effectiveTier,
      credits_remaining: askCreditsRemaining,
      ask_credits_remaining: askCreditsRemaining,
    },
  })
}
