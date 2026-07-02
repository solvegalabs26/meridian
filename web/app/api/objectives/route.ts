import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  }

  const { count } = await supabase
    .from('objectives')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const obj_id = `OBJ-${String((count ?? 0) + 1).padStart(2, '0')}`

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
      status: 'active',
      confidence: 50,
      sort_order: (count ?? 0) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ objective: data })
}
