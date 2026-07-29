import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALPHA_ACCOUNT_TYPES = new Set(['alpha_personal', 'alpha_business'])
const CHECKIN_COOLDOWN_DAYS = 6

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gate: only alpha accounts with checkin_enabled may submit
  const { data: profile } = await supabase
    .from('profiles')
    .select('checkin_enabled, account_type, last_checkin_at')
    .eq('id', user.id)
    .single()

  if (!profile?.checkin_enabled) {
    return NextResponse.json({ error: 'Check-in not enabled for this account' }, { status: 403 })
  }

  if (!ALPHA_ACCOUNT_TYPES.has(profile.account_type ?? '')) {
    return NextResponse.json({ error: 'Check-in is only available to alpha accounts' }, { status: 403 })
  }

  const body = await request.json() as {
    reflection?: string | null
    signal_content?: string | null
    signal_objective?: string | null
    briefing_rating?: number | null
    briefing_note?: string | null
    confidence_flag?: string | null
    confidence_note?: string | null
    feature_tags?: string[] | null
    feature_note?: string | null
  }
  // week_of = Monday of the current ISO week (UTC)
  const now = new Date()
  const daysSinceMonday = (now.getUTCDay() + 6) % 7
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysSinceMonday)
  const weekOf = monday.toISOString().slice(0, 10)

  const { error: reflectionError } = await supabase
    .from('user_reflections')
    .insert({
      user_id:                user.id,
      week_of:                weekOf,
      reflection:             body.reflection?.trim() || null,
      found_signal_content:   body.signal_content?.trim() || null,
      signal_objective_label: body.signal_objective?.trim() || null,
      briefing_rating:        body.briefing_rating ?? null,
      other_notes:            body.briefing_note?.trim() || null,
      confidence_flag:        body.confidence_flag || null,
      confidence_note:        body.confidence_note?.trim() || null,
      feature_tags:           body.feature_tags ?? null,
      feature_note:           body.feature_note?.trim() || null,
    })

  if (reflectionError) {
    return NextResponse.json({ error: reflectionError.message }, { status: 500 })
  }

  // Write signal row if signal_content is present
  const foundContent = body.signal_content?.trim()
  if (foundContent) {
    const titlePreview = foundContent.length > 60
      ? foundContent.slice(0, 57) + '…'
      : foundContent

    await supabase.from('signals').insert({
      user_id:     user.id,
      title:       titlePreview,
      body:        foundContent,
      source_type: 'user_signal',
      relevance:   'high',
      signal_type: 'neutral',
      is_read:     false,
    })
    // Non-fatal: reflection is already committed if this fails
  }

  // Update last_checkin_at
  await supabase
    .from('profiles')
    .update({ last_checkin_at: now.toISOString() })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}

// Eligibility check — called by CheckinWrapper on mount
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ eligible: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('checkin_enabled, account_type, last_checkin_at')
    .eq('id', user.id)
    .single()

  if (!profile?.checkin_enabled) return NextResponse.json({ eligible: false })
  if (!ALPHA_ACCOUNT_TYPES.has(profile.account_type ?? '')) return NextResponse.json({ eligible: false })

  if (profile.last_checkin_at) {
    const daysSince = (Date.now() - new Date(profile.last_checkin_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince <= CHECKIN_COOLDOWN_DAYS) return NextResponse.json({ eligible: false })
  }

  // Fetch active objectives for the modal selectors
  const { data: objectives } = await supabase
    .from('objectives')
    .select('id, obj_id, title')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('sort_order')

  // Latest completed sweep id (for sweep_id on the reflection row)
  const { data: latestSweep } = await supabase
    .from('sweeps')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    eligible:   true,
    objectives: objectives ?? [],
    sweepId:    latestSweep?.id ?? null,
  })
}
