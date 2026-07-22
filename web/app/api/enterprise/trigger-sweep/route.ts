import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const SUPABASE_PROJECT = 'naskidrydhxbxnpplvla'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { institution_id, objective_id, trigger_type = 'manual' } = await req.json()
  if (!institution_id || !objective_id) {
    return NextResponse.json({ error: 'institution_id and objective_id required' }, { status: 400 })
  }

  // Proxy to enterprise-sweep Edge Function (service role not needed — DPA gate is inside the function)
  const res = await fetch(
    `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/enterprise-sweep`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ institution_id, objective_id, trigger_type }),
    }
  )

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
