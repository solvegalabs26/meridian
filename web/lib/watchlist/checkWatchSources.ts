import { createHash } from 'crypto'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWatchAlert } from '@/lib/email/sendWatchAlert'
import { getEffectiveTier, type TierProfile } from '@/lib/tiers'

export type CheckResult = {
  watchSourceId: string
  url: string
  status: 'hash_match' | 'signal_confirmed' | 'signal_detected' | 'signal_gone' | 'no_signal' | 'error' | 'skipped'
  confidence?: number
  rationale?: string
  alertId?: string
  note?: string
}

type WatchSourceRow = {
  id: string
  url_resolved: string
  watch_type: string
  target_signal: string | null
  last_hash: string | null
  last_state: string
  priority_tier: number
  objective_id: string | null
}

type SonnetPayload = {
  signal_found: boolean
  confidence: number
  rationale: string
  signal_summary: string
  action_text: string
}

function extractScopedText(html: string, watchType: string): string {
  const stripped = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()

  const LIMIT = 8000

  switch (watchType) {
    case 'careers_listing': {
      const matches = stripped.match(
        /(?:job|position|role|career|hiring|opening|officer|captain|pilot|flight|requisition|vacancies?)[\s\S]{0,2000}/gi
      )
      return matches ? matches.slice(0, 6).join('\n\n').slice(0, LIMIT) : stripped.slice(0, LIMIT)
    }
    case 'registration': {
      const matches = stripped.match(
        /(?:register|sign.?up|enroll|apply|registration|open|available|spots?)[\s\S]{0,2000}/gi
      )
      return matches ? matches.slice(0, 6).join('\n\n').slice(0, LIMIT) : stripped.slice(0, LIMIT)
    }
    case 'status_page': {
      const matches = stripped.match(
        /(?:status|operational|degraded|outage|incident|maintenance|all systems|disruption)[\s\S]{0,2000}/gi
      )
      return matches ? matches.slice(0, 6).join('\n\n').slice(0, LIMIT) : stripped.slice(0, LIMIT)
    }
    default:
      return stripped.slice(0, LIMIT)
  }
}

async function checkOne(
  src: WatchSourceRow,
  userId: string,
  supabase: ReturnType<typeof createServiceClient>,
  userEmail: string | null,
  tierProfile: TierProfile,
): Promise<CheckResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)

  let html: string
  try {
    const res = await fetch(src.url_resolved, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MeridianArc/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timer)

    if (!res.ok) {
      const errMsg = `HTTP ${res.status} ${res.statusText}`
      await supabase
        .from('watch_sources')
        .update({ last_checked_at: new Date().toISOString(), last_error: errMsg })
        .eq('id', src.id)
      return { watchSourceId: src.id, url: src.url_resolved, status: 'error', note: errMsg }
    }

    html = await res.text()
  } catch (err) {
    clearTimeout(timer)
    const errMsg = err instanceof Error ? err.message : String(err)
    await supabase
      .from('watch_sources')
      .update({ last_checked_at: new Date().toISOString(), last_error: errMsg })
      .eq('id', src.id)
    return { watchSourceId: src.id, url: src.url_resolved, status: 'error', note: errMsg }
  }

  const extracted = extractScopedText(html, src.watch_type)
  const hash = createHash('sha256').update(extracted).digest('hex')

  if (hash === src.last_hash) {
    await supabase
      .from('watch_sources')
      .update({ last_checked_at: new Date().toISOString(), last_error: null })
      .eq('id', src.id)
    return { watchSourceId: src.id, url: src.url_resolved, status: 'hash_match', note: 'Content unchanged' }
  }

  // Content changed — run AI validation pass
  const anthropic = getAnthropicClient()
  const aiMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system:
      "You are Meridian's signal detection engine. Analyze extracted webpage content and determine whether a target signal is present. Return ONLY valid JSON — no markdown, no preamble, no explanation outside the JSON.",
    messages: [
      {
        role: 'user',
        content: [
          `TARGET SIGNAL: ${src.target_signal ?? 'Not specified'}`,
          `WATCH TYPE: ${src.watch_type}`,
          '',
          'PAGE CONTENT (extracted):',
          extracted.slice(0, 6000),
          '',
          'Return JSON only:',
          '{ "signal_found": boolean, "confidence": number (0-100), "rationale": string, "signal_summary": string (1 sentence describing what was found, or "No signal detected"), "action_text": string (what the user should do next, 1 sentence) }',
        ].join('\n'),
      },
    ],
  })

  const rawText = aiMsg.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let payload: SonnetPayload
  try {
    payload = JSON.parse(rawText) as SonnetPayload
  } catch {
    const errMsg = `Sonnet returned non-JSON: ${rawText.slice(0, 200)}`
    await supabase
      .from('watch_sources')
      .update({ last_checked_at: new Date().toISOString(), last_hash: hash, last_error: errMsg })
      .eq('id', src.id)
    return { watchSourceId: src.id, url: src.url_resolved, status: 'error', note: errMsg }
  }

  const { confidence, signal_found, rationale, signal_summary, action_text } = payload

  // Determine new state
  let newState: string
  let shouldAlert = false

  const hadSignal =
    src.last_state === 'signal_confirmed' || src.last_state === 'signal_detected'

  if (signal_found && confidence >= 70) {
    newState = 'signal_confirmed'
    shouldAlert = true
  } else if (signal_found && confidence >= 50) {
    newState = 'signal_detected'
    shouldAlert = true
  } else {
    newState = hadSignal ? 'signal_gone' : 'no_signal'
  }

  const alertLevel =
    src.priority_tier === 1 ? 'critical' : src.priority_tier === 2 ? 'high' : 'medium'

  await supabase
    .from('watch_sources')
    .update({
      last_hash: hash,
      last_checked_at: new Date().toISOString(),
      last_state: newState,
      last_error: null,
      ...(shouldAlert ? { alert_fired_at: new Date().toISOString() } : {}),
    })
    .eq('id', src.id)
    .throwOnError()

  let alertId: string | undefined
  if (shouldAlert && src.objective_id) {
    const { data: alertRow } = await supabase
      .from('watch_alerts')
      .insert({
        user_id: userId,
        watch_source_id: src.id,
        objective_id: src.objective_id,
        alert_level: alertLevel,
        signal_summary,
        action_text,
        direct_url: src.url_resolved,
        confidence: Math.round(confidence),
      })
      .select('id')
      .single()
    alertId = alertRow?.id as string | undefined

    if (userEmail) {
      const effectiveTier = getEffectiveTier(tierProfile)
      const shouldEmail =
        (alertLevel === 'critical' && effectiveTier !== 'trial') ||
        (alertLevel === 'high' && (effectiveTier === 'accelerator' || effectiveTier === 'command'))

      if (shouldEmail) {
        let objectiveTitle = ''
        if (src.objective_id) {
          const { data: obj } = await supabase
            .from('objectives')
            .select('title')
            .eq('id', src.objective_id)
            .single()
          objectiveTitle = (obj?.title as string | undefined) ?? ''
        }
        await sendWatchAlert({
          to: userEmail,
          objectiveTitle,
          signalSummary: signal_summary,
          actionText: action_text,
          directUrl: src.url_resolved,
        })
      }
    }
  }

  const status = (
    newState === 'signal_confirmed' ? 'signal_confirmed'
    : newState === 'signal_detected' ? 'signal_detected'
    : newState === 'signal_gone'     ? 'signal_gone'
    : 'no_signal'
  ) as CheckResult['status']

  return {
    watchSourceId: src.id,
    url: src.url_resolved,
    status,
    confidence,
    rationale,
    alertId,
  }
}

export async function checkWatchSources(userId: string): Promise<CheckResult[]> {
  const supabase = createServiceClient()

  const [
    { data: sources, error },
    { data: { user: authUser } },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('watch_sources')
      .select('id, url_resolved, watch_type, target_signal, last_hash, last_state, priority_tier, objective_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .not('url_resolved', 'is', null),
    supabase.auth.admin.getUserById(userId),
    supabase.from('profiles').select('tier, account_type').eq('id', userId).single(),
  ])

  if (error) throw new Error(`checkWatchSources: failed to load sources: ${error.message}`)
  if (!sources?.length) return []

  const userEmail = authUser?.email ?? null
  const tierProfile: TierProfile = {
    tier: (profile as { tier?: string | null } | null)?.tier ?? null,
    account_type: (profile as { account_type?: string | null } | null)?.account_type ?? null,
  }

  const settled = await Promise.allSettled(
    (sources as WatchSourceRow[]).map(src => checkOne(src, userId, supabase, userEmail, tierProfile))
  )

  return settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const src = sources[i] as WatchSourceRow
    return {
      watchSourceId: src.id,
      url: src.url_resolved,
      status: 'error' as const,
      note: r.reason instanceof Error ? r.reason.message : String(r.reason),
    }
  })
}
