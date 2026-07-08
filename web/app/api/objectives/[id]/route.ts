import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    title?: string
    target_date?: string | null
    deadline_type?: 'hard' | 'soft'
    reservation_price?: number | null
    context?: Record<string, unknown>
    notes?: string | null
    outcome?: string
    success_condition?: string | null
  }

  // Reject a past target_date (same guard as POST)
  if (body.target_date) {
    const today = new Date().toISOString().split('T')[0]
    if (body.target_date < today) {
      return NextResponse.json({ error: 'past_target_date', target_date: body.target_date }, { status: 400 })
    }
  }

  // Build update payload — only include fields that were actually sent
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('title' in body)              update.title = body.title
  if ('target_date' in body)        update.target_date = body.target_date ?? null
  if ('deadline_type' in body)      update.deadline_type = body.deadline_type
  if ('reservation_price' in body)  update.reservation_price = body.reservation_price ?? null
  if ('context' in body)            update.context = body.context ?? {}
  if ('notes' in body)              update.notes = body.notes ?? null
  if ('outcome' in body)            update.outcome = body.outcome
  if ('success_condition' in body)  update.success_condition = body.success_condition ?? null

  // RLS: .eq('user_id') ensures a user can only edit their own objective
  const { data, error } = await supabase
    .from('objectives')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ objective: data })
}
