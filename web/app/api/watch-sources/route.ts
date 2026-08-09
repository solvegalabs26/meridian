import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveUrl } from '@/lib/watchlist/resolveUrl'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const objectiveId = request.nextUrl.searchParams.get('objectiveId')
  if (!objectiveId) return NextResponse.json({ error: 'objectiveId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('watch_sources')
    .select('id, url_provided, url_resolved, url_resolved_at, priority_tier, watch_type, target_signal, last_state, last_checked_at, requires_confirmation, is_active')
    .eq('objective_id', objectiveId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('priority_tier', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    objectiveId: string
    urlProvided: string
    targetSignal: string | null
    priorityTier: number
    watchType: string
  }

  const { objectiveId, urlProvided, targetSignal, priorityTier, watchType } = body
  if (!objectiveId || !urlProvided?.trim()) {
    return NextResponse.json({ error: 'objectiveId and urlProvided are required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: row, error: insertError } = await svc
    .from('watch_sources')
    .insert({
      user_id: user.id,
      objective_id: objectiveId,
      url_provided: urlProvided.trim(),
      target_signal: targetSignal?.trim() || null,
      priority_tier: priorityTier,
      watch_type: watchType,
    })
    .select('id')
    .single()

  if (insertError || !row) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Fire resolveUrl — best-effort; don't fail the POST if inference errors
  try {
    await resolveUrl({ objectiveId, urlProvided: urlProvided.trim() })
  } catch (err) {
    console.error('[watch-sources POST] resolveUrl failed:', err)
  }

  const { data: finalRow } = await svc
    .from('watch_sources')
    .select('id, url_provided, url_resolved, url_resolved_at, priority_tier, watch_type, target_signal, last_state, last_checked_at, requires_confirmation, is_active')
    .eq('id', row.id as string)
    .single()

  return NextResponse.json(finalRow ?? { id: row.id }, { status: 201 })
}
