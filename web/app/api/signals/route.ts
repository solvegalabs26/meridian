import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const objectiveId = searchParams.get('objective_id')
  const relevance = searchParams.get('relevance')
  const unread = searchParams.get('unread')
  const signalType = searchParams.get('signal_type')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('signals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (objectiveId) query = query.contains('objective_ids', [objectiveId])
  if (relevance && relevance !== 'all') query = query.eq('relevance', relevance)
  if (unread === 'true') query = query.eq('is_read', false)
  if (signalType && signalType !== 'all') query = query.eq('signal_type', signalType)

  const { data: signals, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ signals: signals ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    title: string
    body?: string
    objective_ids?: string[]
    relevance?: string
    signal_type?: string
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data: signal, error } = await supabase
    .from('signals')
    .insert({
      user_id: user.id,
      title: body.title.trim(),
      body: body.body?.trim() ?? null,
      objective_ids: body.objective_ids ?? [],
      source_type: 'manual',
      relevance: body.relevance ?? 'medium',
      signal_type: body.signal_type ?? 'neutral',
      is_read: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ signal })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { id: string; is_read: boolean }

  const { error } = await supabase
    .from('signals')
    .update({ is_read: body.is_read })
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
