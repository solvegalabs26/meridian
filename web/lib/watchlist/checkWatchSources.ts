import { createHash } from 'crypto'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWatchAlert } from '@/lib/email/sendWatchAlert'
import { sendSmsAlert } from '@/lib/watchlist/sendSmsAlert'
import { sendPushAlert } from '@/lib/watchlist/sendPushAlert'
import { getEffectiveTier, type TierProfile } from '@/lib/tiers'
import type webpush from 'web-push'

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
  url_provided: string
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

// Fetch a URL and run the AI signal-detection pass. Returns the parsed payload
// or null on fetch/parse failure. Does NOT update the DB — caller owns that.
async function fetchAndAnalyze(
  url: string,
  src: Pick<WatchSourceRow, 'watch_type' | 'target_signal'>,
): Promise<SonnetPayload | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)

  let html: string
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MeridianArc/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    html = await res.text()
  } catch {
    clearTimeout(timer)
    return null
  }

  const extracted = extractScopedText(html, src.watch_type)

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
          `TARGET SIGNAL (what specifically to look for): ${src.target_signal ?? 'Not specified'}`,
          '',
          'NOISE FILTER: A page change that does not directly relate to the target signal above is NOT a confirmed signal. Company news, product updates, unrelated job categories, or structural page changes must return signal_confirmed: false. Only return signal_confirmed: true if the page content directly evidences progress toward the objective\'s success condition as defined by the target signal.',
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

  try {
    return JSON.parse(rawText) as SonnetPayload
  } catch {
    return null
  }
}

async function fireAlert(
  src: WatchSourceRow,
  userId: string,
  supabase: ReturnType<typeof createServiceClient>,
  userEmail: string | null,
  tierProfile: TierProfile,
  phoneNumber: string | null,
  smsAlertsEnabled: boolean,
  payload: SonnetPayload,
  triggeredByUrl: string,
): Promise<string | undefined> {
  const alertLevel =
    src.priority_tier === 1 ? 'critical' : src.priority_tier === 2 ? 'high' : 'medium'

  const { data: alertRow } = await supabase
    .from('watch_alerts')
    .insert({
      user_id: userId,
      watch_source_id: src.id,
      objective_id: src.objective_id,
      alert_level: alertLevel,
      signal_summary: payload.signal_summary,
      action_text: payload.action_text,
      direct_url: triggeredByUrl,
      confidence: Math.round(payload.confidence),
      triggered_by_url: triggeredByUrl,
    })
    .select('id')
    .single()

  const alertId = alertRow?.id as string | undefined

  const effectiveTier = getEffectiveTier(tierProfile)
  const isAcceleratorPlus =
    effectiveTier === 'accelerator' || effectiveTier === 'command' || effectiveTier === 'enterprise'

  const willEmail =
    !!userEmail &&
    ((alertLevel === 'critical' && effectiveTier !== 'trial') ||
      (alertLevel === 'high' && isAcceleratorPlus))
  const willSms = alertLevel === 'critical' && smsAlertsEnabled && !!phoneNumber && isAcceleratorPlus
  const willPush = alertLevel === 'critical' && isAcceleratorPlus

  if (willEmail || willSms || willPush) {
    const { data: obj } = await supabase
      .from('objectives')
      .select('title')
      .eq('id', src.objective_id!)
      .single()
    const objectiveTitle = (obj?.title as string | undefined) ?? ''

    if (willEmail) {
      await sendWatchAlert({
        to: userEmail!,
        objectiveTitle,
        signalSummary: payload.signal_summary,
        actionText: payload.action_text,
        directUrl: triggeredByUrl,
      })
    }

    if (willSms) {
      await sendSmsAlert({
        to: phoneNumber!,
        objectiveTitle,
        signalSummary: payload.signal_summary,
        actionText: payload.action_text,
        directUrl: triggeredByUrl,
      })
    }

    if (willPush) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', userId)
      await Promise.allSettled(
        (subs ?? []).map(row =>
          sendPushAlert({
            subscription: row.subscription as webpush.PushSubscription,
            objectiveTitle,
            signalSummary: payload.signal_summary,
            actionText: payload.action_text,
          })
        )
      )
    }
  }

  return alertId
}

async function checkOne(
  src: WatchSourceRow,
  userId: string,
  supabase: ReturnType<typeof createServiceClient>,
  userEmail: string | null,
  tierProfile: TierProfile,
  phoneNumber: string | null,
  smsAlertsEnabled: boolean,
): Promise<CheckResult> {
  // --- Primary check: url_resolved (hash-gated) ---
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)

  let primaryHtml: string | null = null
  let primaryHash: string | null = null
  let fetchError: string | null = null

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
      fetchError = `HTTP ${res.status} ${res.statusText}`
    } else {
      primaryHtml = await res.text()
      primaryHash = createHash('sha256').update(extractScopedText(primaryHtml, src.watch_type)).digest('hex')
    }
  } catch (err) {
    clearTimeout(timer)
    fetchError = err instanceof Error ? err.message : String(err)
  }

  if (fetchError) {
    await supabase
      .from('watch_sources')
      .update({ last_checked_at: new Date().toISOString(), last_error: fetchError })
      .eq('id', src.id)
    return { watchSourceId: src.id, url: src.url_resolved, status: 'error', note: fetchError }
  }

  // Hash match on primary — check secondary before declaring unchanged
  const primaryUnchanged = primaryHash === src.last_hash

  // --- Secondary check: url_provided (if it's a valid https:// URL distinct from url_resolved) ---
  const checkSecondary =
    src.url_provided.startsWith('https://') && src.url_provided !== src.url_resolved

  // Run secondary independently (no hash gating — always fresh)
  const secondaryPayload = checkSecondary
    ? await fetchAndAnalyze(src.url_provided, src)
    : null

  const secondarySignals =
    secondaryPayload !== null &&
    secondaryPayload.signal_found &&
    secondaryPayload.confidence >= 50

  // If primary is unchanged AND secondary has no signal, return early
  if (primaryUnchanged && !secondarySignals) {
    await supabase
      .from('watch_sources')
      .update({ last_checked_at: new Date().toISOString(), last_error: null })
      .eq('id', src.id)
    return { watchSourceId: src.id, url: src.url_resolved, status: 'hash_match', note: 'Content unchanged' }
  }

  // --- Analyze primary (if content changed) ---
  let primaryPayload: SonnetPayload | null = null
  if (!primaryUnchanged && primaryHtml !== null) {
    primaryPayload = await fetchAndAnalyze(src.url_resolved, src)
  }

  const primarySignals =
    primaryPayload !== null &&
    primaryPayload.signal_found &&
    primaryPayload.confidence >= 50

  // Decide which signal wins — primary takes precedence; secondary is fallback
  const winningPayload = primarySignals ? primaryPayload : secondarySignals ? secondaryPayload : null
  const triggeredByUrl = primarySignals
    ? src.url_resolved
    : secondarySignals
    ? src.url_provided
    : src.url_resolved

  const hadSignal = src.last_state === 'signal_confirmed' || src.last_state === 'signal_detected'
  const shouldAlert = winningPayload !== null

  let newState: string
  if (winningPayload && winningPayload.confidence >= 70) {
    newState = 'signal_confirmed'
  } else if (winningPayload && winningPayload.confidence >= 50) {
    newState = 'signal_detected'
  } else {
    newState = hadSignal ? 'signal_gone' : 'no_signal'
  }

  await supabase
    .from('watch_sources')
    .update({
      last_hash: primaryHash ?? src.last_hash,
      last_checked_at: new Date().toISOString(),
      last_state: newState,
      last_error: null,
      ...(shouldAlert ? { alert_fired_at: new Date().toISOString() } : {}),
    })
    .eq('id', src.id)
    .throwOnError()

  let alertId: string | undefined
  if (shouldAlert && src.objective_id && winningPayload) {
    alertId = await fireAlert(
      src, userId, supabase, userEmail, tierProfile,
      phoneNumber, smsAlertsEnabled, winningPayload, triggeredByUrl,
    )
    console.log(`[watch:alert] source=${src.id} triggered_by=${triggeredByUrl} state=${newState}`)
  }

  const status = (
    newState === 'signal_confirmed' ? 'signal_confirmed'
    : newState === 'signal_detected' ? 'signal_detected'
    : newState === 'signal_gone'     ? 'signal_gone'
    : 'no_signal'
  ) as CheckResult['status']

  return {
    watchSourceId: src.id,
    url: triggeredByUrl,
    status,
    confidence: winningPayload?.confidence,
    rationale: winningPayload?.rationale,
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
      .select('id, url_provided, url_resolved, watch_type, target_signal, last_hash, last_state, priority_tier, objective_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .not('url_resolved', 'is', null),
    supabase.auth.admin.getUserById(userId),
    supabase
      .from('profiles')
      .select('tier, account_type, phone_number, sms_alerts_enabled')
      .eq('id', userId)
      .single(),
  ])

  if (error) throw new Error(`checkWatchSources: failed to load sources: ${error.message}`)
  if (!sources?.length) return []

  const userEmail = authUser?.email ?? null
  const tierProfile: TierProfile = {
    tier: (profile as { tier?: string | null } | null)?.tier ?? null,
    account_type: (profile as { account_type?: string | null } | null)?.account_type ?? null,
  }
  const phoneNumber: string | null =
    (profile as { phone_number?: string | null } | null)?.phone_number ?? null
  const smsAlertsEnabled: boolean =
    (profile as { sms_alerts_enabled?: boolean | null } | null)?.sms_alerts_enabled ?? false

  const settled = await Promise.allSettled(
    (sources as WatchSourceRow[]).map(src =>
      checkOne(src, userId, supabase, userEmail, tierProfile, phoneNumber, smsAlertsEnabled)
    )
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
