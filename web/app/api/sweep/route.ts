import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { buildSystemPrompt } from '@/lib/anthropic/prompts/system'
import { buildObjectiveState } from '@/lib/anthropic/prompts/objective'
import { parseAnthropicResponse } from '@/lib/anthropic/prompts/output'
import { fetchNewsSignals } from '@/lib/signals/newsapi'
import { sendConfidenceAlert } from '@/lib/email/resend'
import { fetchCalendarEvents, formatEventsForPrompt } from '@/lib/calendar/ical'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    objective_ids?: string[]
    manual_signals?: string
  }

  // 2. Load user profile (including calendar URL)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, tone_pref, depth_pref, calendar_ical_url, sweep_count')
    .eq('id', user.id)
    .single()

  // 3. Load objectives
  let objectivesQuery = supabase
    .from('objectives')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('sort_order')

  if (body.objective_ids && body.objective_ids.length > 0) {
    objectivesQuery = objectivesQuery.in('id', body.objective_ids)
  }

  const { data: objectives } = await objectivesQuery
  if (!objectives || objectives.length === 0) {
    return NextResponse.json({ error: 'No active objectives found' }, { status: 400 })
  }

  // Create sweep record
  const { data: sweep } = await supabase
    .from('sweeps')
    .insert({
      user_id: user.id,
      status: 'running',
      trigger_type: 'manual',
      objectives_swept: objectives.map(o => o.id),
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (!sweep) return NextResponse.json({ error: 'Failed to create sweep' }, { status: 500 })

  try {
    // 4. Fetch confidence history per objective
    const { data: allScores } = await supabase
      .from('confidence_scores')
      .select('objective_id, score, created_at')
      .in('objective_id', objectives.map(o => o.id))
      .order('created_at', { ascending: true })

    // 5. Fetch NewsAPI signals for each objective
    const newsSignalsMap: Record<string, Awaited<ReturnType<typeof fetchNewsSignals>>> = {}
    for (const obj of objectives) {
      const keywords = obj.signal_keywords ?? []
      if (keywords.length > 0) {
        newsSignalsMap[obj.id] = await fetchNewsSignals(keywords, 3)
      } else {
        newsSignalsMap[obj.id] = []
      }
    }

    // 6. Build objective state JSON
    const objectiveInputs = objectives.map(obj => {
      const history = (allScores ?? [])
        .filter(s => s.objective_id === obj.id)
        .map(s => s.score)

      const newsArticles = newsSignalsMap[obj.id] ?? []
      const recentSignals = newsArticles.map(a => ({
        title: a.title.slice(0, 120),
        body: (a.description ?? '').slice(0, 200),
        source: a.source,
        relevance: 'medium' as const,
        date: a.publishedAt.split('T')[0],
      }))

      return { objective: obj, confidenceHistory: history, recentSignals }
    })

    // Fetch calendar events if user has connected a calendar
    let calendarContext = ''
    const calUrl = (profile as { calendar_ical_url?: string } | null)?.calendar_ical_url
    if (calUrl) {
      const calEvents = await fetchCalendarEvents(calUrl, 90)
      calendarContext = formatEventsForPrompt(calEvents)
    }

    const objectiveState = buildObjectiveState(objectiveInputs)
    const userMessage = {
      ...objectiveState,
      manual_signals: body.manual_signals ?? '',
      calendar_context: calendarContext || undefined,
      sweep_instructions: 'Focus on cross-dependencies. Flag any signal that changes urgency on open actions. If calendar events are provided, factor upcoming events into recommendations — identify which objectives have relevant events approaching and surface time-sensitive actions.',
    }

    // 7. Call Anthropic API
    const currentDate = new Date().toISOString().split('T')[0]
    const systemPrompt = buildSystemPrompt({
      userName: profile?.full_name ?? 'User',
      tone: (profile?.tone_pref as 'direct' | 'balanced' | 'encouraging') ?? 'balanced',
      depth: (profile?.depth_pref as 'brief' | 'standard' | 'detailed') ?? 'standard',
      currentDate,
    })

    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(userMessage) }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens
    const costUsd = (message.usage.input_tokens * 0.000003) + (message.usage.output_tokens * 0.000015)

    // 8. Parse Anthropic response
    const parsed = parseAnthropicResponse(responseText)

    // 9. Write signals to Supabase
    const signalInserts: Array<{
      user_id: string
      objective_ids: string[]
      sweep_id: string
      title: string
      body: string | null
      source: string | null
      source_type: string
      relevance: string
      signal_type: string
      is_cross_dep: boolean
    }> = []

    for (const obj of objectives) {
      const articles = newsSignalsMap[obj.id] ?? []
      for (const article of articles) {
        signalInserts.push({
          user_id: user.id,
          objective_ids: [obj.id],
          sweep_id: sweep.id,
          title: article.title,
          body: article.description,
          source: article.url,
          source_type: 'news',
          relevance: 'medium',
          signal_type: 'neutral',
          is_cross_dep: false,
        })
      }
    }

    // Add cross-dep signals
    for (const dep of parsed.cross_objective_dependencies) {
      const fromObj = objectives.find(o => o.obj_id === dep.from_obj)
      const toObj = objectives.find(o => o.obj_id === dep.to_obj)
      if (fromObj && toObj) {
        signalInserts.push({
          user_id: user.id,
          objective_ids: [fromObj.id, toObj.id],
          sweep_id: sweep.id,
          title: `Cross-dependency: ${dep.from_obj} → ${dep.to_obj}`,
          body: dep.description,
          source: null,
          source_type: 'news',
          relevance: dep.urgency === 'high' ? 'high' : dep.urgency === 'low' ? 'low' : 'medium',
          signal_type: 'cross_dep',
          is_cross_dep: true,
        })
      }
    }

    if (signalInserts.length > 0) {
      await supabase.from('signals').insert(signalInserts)
    }

    // 10. Write confidence scores and update objectives
    const objResults = []
    for (const obj of objectives) {
      const result = parsed.objectives.find(r => r.obj_id === obj.obj_id)
      if (!result) continue

      // Write confidence score record
      await supabase.from('confidence_scores').insert({
        objective_id: obj.id,
        user_id: user.id,
        sweep_id: sweep.id,
        score: result.confidence,
        factors: {
          signal_quality: result.signal_quality === 'high' ? 85 : result.signal_quality === 'medium' ? 60 : 35,
        },
        signal_gap: result.signal_gap,
        recommended_actions: result.actions,
      })

      // Update objective confidence
      await supabase.from('objectives').update({
        confidence_prev: obj.confidence,
        confidence: result.confidence,
        updated_at: new Date().toISOString(),
      }).eq('id', obj.id)

      // Email alert if confidence delta > 5 points
      const delta = result.confidence - obj.confidence
      if (Math.abs(delta) > 5 && user.email) {
        sendConfidenceAlert({
          toEmail: user.email,
          objectiveTitle: obj.title,
          prevScore: obj.confidence,
          newScore: result.confidence,
          delta,
        }).catch(console.error)
      }

      objResults.push({
        id: obj.id,
        obj_id: obj.obj_id,
        title: obj.title,
        confidence_prev: obj.confidence,
        confidence_new: result.confidence,
        delta: result.confidence - obj.confidence,
        actions: result.actions,
        cross_deps: result.cross_dependencies,
        signal_gap: result.signal_gap,
      })
    }

    // 11. Update sweep record as complete
    await supabase.from('sweeps').update({
      status: 'complete',
      signal_count: signalInserts.length,
      summary: parsed.sweep_summary,
      raw_response: parsed,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      completed_at: new Date().toISOString(),
    }).eq('id', sweep.id)

    // Increment user sweep count
    await supabase.from('profiles').update({
      sweep_count: (profile as { sweep_count?: number } | null)?.sweep_count
        ? ((profile as { sweep_count?: number }).sweep_count ?? 0) + 1
        : 1,
    }).eq('id', user.id)

    return NextResponse.json({
      sweep_id: sweep.id,
      status: 'complete',
      signal_count: signalInserts.length,
      objectives: objResults,
      summary: parsed.sweep_summary,
      top_priority_action: parsed.top_priority_action,
      cross_dependencies: parsed.cross_objective_dependencies,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
    })

  } catch (err) {
    // Mark sweep as failed
    await supabase.from('sweeps').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
    }).eq('id', sweep.id)

    console.error('Sweep error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sweep failed' },
      { status: 500 }
    )
  }
}
