import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMaxObjectives } from '@/lib/subscription/tiers'
import { autoConfigObjective } from '@/lib/sweep/autoConfig'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('objectives')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ objectives: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    title: string
    category: string
    outcome: string
    success_condition?: string
    target_date?: string
    notes?: string
    goal_description?: string
    goal_context?: string | null
    deadline_type?: 'hard' | 'soft'
    reservation_price?: number
    context?: Record<string, unknown>
  }

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from('profiles').select('tier, account_type').eq('id', user.id).single(),
    supabase.from('objectives').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const tier = (profile?.tier ?? 'trial') as Parameters<typeof getMaxObjectives>[0]
  const accountType = (profile?.account_type ?? 'personal') as string
  const max = getMaxObjectives(tier, accountType)
  const currentCount = count ?? 0

  if (max !== null && currentCount >= max) {
    return NextResponse.json({ error: 'objective_limit_reached', max }, { status: 403 })
  }

  // Reject a target_date that is already in the past — almost always an input
  // error (most commonly a wrong-year extraction from the AI goal parser).
  if (body.target_date) {
    const today = new Date().toISOString().split('T')[0]
    if (body.target_date < today) {
      return NextResponse.json({ error: 'past_target_date', target_date: body.target_date }, { status: 400 })
    }
  }

  const obj_id = `OBJ-${String(currentCount + 1).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('objectives')
    .insert({
      user_id: user.id,
      obj_id,
      title: body.title,
      category: body.category,
      outcome: body.outcome,
      success_condition: body.success_condition ?? null,
      target_date: body.target_date ?? null,
      notes: body.notes ?? null,
      goal_description: body.goal_description ?? null,
      goal_context: body.goal_context ?? null,
      deadline_type: body.deadline_type ?? 'hard',
      reservation_price: body.reservation_price ?? null,
      context: body.context ?? {},
      status: 'active',
      confidence: 50,
      sort_order: currentCount + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget: classify type + seed rules_filter. Does not block the response.
  if (data) {
    autoConfigObjective(data.id, { title: data.title, outcome: data.outcome, category: data.category })
      .catch(err => console.error('[autoConfig] failed for', data.id, err))
  }

  return NextResponse.json({ objective: data })
}
