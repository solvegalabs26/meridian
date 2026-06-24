import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const week = searchParams.get('week')

  if (week) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('entry_number', parseInt(week))
      .single()
    if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entry: data ?? null })
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_number, week_of, section_h_rating, is_complete, updated_at')
    .eq('user_id', user.id)
    .order('entry_number')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { entry_number, ...fields } = body as { entry_number: number; [key: string]: unknown }

  // Upsert — create or update
  const { data, error } = await supabase
    .from('journal_entries')
    .upsert({
      user_id: user.id,
      entry_number,
      ...fields,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,entry_number' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}
