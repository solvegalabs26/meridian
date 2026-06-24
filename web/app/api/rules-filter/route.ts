import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const objectiveId = searchParams.get('objective_id')

  let query = supabase.from('rules_filter').select('*').eq('user_id', user.id)
  if (objectiveId) query = query.eq('objective_id', objectiveId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    objective_id: string
    keywords_high?: string[]
    keywords_med?: string[]
    keywords_low?: string[]
    keywords_block?: string[]
    source_tiers?: { tier1: string[]; tier2: string[]; tier3: string[] }
  }

  const { data, error } = await supabase
    .from('rules_filter')
    .upsert({
      user_id: user.id,
      objective_id: body.objective_id,
      keywords_high: body.keywords_high ?? [],
      keywords_med: body.keywords_med ?? [],
      keywords_low: body.keywords_low ?? [],
      keywords_block: body.keywords_block ?? [],
      source_tiers: body.source_tiers ?? { tier1: [], tier2: [], tier3: [] },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,objective_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}
