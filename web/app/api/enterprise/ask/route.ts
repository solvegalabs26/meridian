import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { question?: string; institutionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const question = (body.question ?? '').trim()
  const institutionId = (body.institutionId ?? '').trim()

  if (!question || question.length > 1000) {
    return NextResponse.json({ error: 'question is required and must be under 1000 characters' }, { status: 400 })
  }
  if (!institutionId) {
    return NextResponse.json({ error: 'institutionId is required' }, { status: 400 })
  }

  // Confirm the user has RLS access to this institution
  const { data: inst } = await supabase
    .from('enterprise_institutions')
    .select('id, name')
    .eq('id', institutionId)
    .single()

  if (!inst) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
  }

  // Load active objectives with their latest result summary
  const { data: rawObjectives } = await supabase
    .from('enterprise_objectives')
    .select(`
      title, objective_state,
      enterprise_objective_results (
        alert_triggered, alert_reason, affecting_it, lite_summary, computed_at
      )
    `)
    .eq('institution_id', institutionId)
    .eq('status', 'active')
    .order('objective_order', { ascending: true })

  type RawResult = {
    alert_triggered: boolean
    alert_reason: string | null
    affecting_it: string | null
    lite_summary: string | null
    computed_at: string
  }

  const objContext = (rawObjectives ?? []).map(o => {
    const results = (o.enterprise_objective_results as RawResult[] ?? [])
      .sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime())
    const latest = results[0]
    const alertNote = latest?.alert_triggered ? ` [ALERT: ${latest.alert_reason ?? 'threshold crossed'}]` : ''
    const summary = (latest?.lite_summary ?? latest?.affecting_it ?? 'No sweep data yet').slice(0, 200)
    return `- ${o.title} (${o.objective_state})${alertNote}: ${summary}`
  }).join('\n') || 'No active objectives.'

  // Load latest portfolio metrics snapshot
  const { data: metrics } = await supabase
    .from('enterprise_portfolio_metrics')
    .select('portfolio_health_score, health_trend, delinquency_rate_pct, total_cases, critical_count, alert_count')
    .eq('institution_id', institutionId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  const metricsContext = metrics
    ? [
        `Health score: ${metrics.portfolio_health_score ?? '—'} (${metrics.health_trend ?? 'unknown trend'})`,
        `Delinquency rate: ${(((metrics.delinquency_rate_pct as number) ?? 0) * 100).toFixed(1)}%`,
        `Total accounts: ${metrics.total_cases ?? '—'}`,
        `Critical: ${metrics.critical_count ?? 0} · Alert: ${metrics.alert_count ?? 0}`,
      ].join(' · ')
    : 'No portfolio metrics available yet.'

  const systemPrompt = `You are Meridian Fusion, an enterprise auto loan portfolio intelligence platform built by Solvega Labs, serving ${inst.name}.

You help portfolio managers, risk officers, and executive leadership understand and act on their auto loan portfolio — including delinquency risk, account drift, macro signal exposure, and strategic objectives.

Guidelines:
- Give specific, grounded, actionable answers using the portfolio data provided below.
- Reference active objectives, metrics, and alerts by name when relevant.
- Be direct and concise. Prose is preferred over bullet-point soup.
- If a question is outside the scope of available data, say what data would be needed to answer it.
- Never fabricate metrics — always qualify if data is unavailable.`

  const contextBlock = [
    `## Institution: ${inst.name}`,
    `## Portfolio metrics (latest sweep)\n${metricsContext}`,
    `## Active portfolio objectives\n${objContext}`,
    `## Question\n${question}`,
  ].join('\n\n---\n\n')

  let responseText: string
  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: contextBlock }],
    })
    responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  } catch (err) {
    console.error('[enterprise/ask] Anthropic error:', err)
    return NextResponse.json(
      { error: 'Meridian Fusion is temporarily unavailable. Please try again.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ response: responseText })
}
