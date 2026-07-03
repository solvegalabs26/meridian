import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Stage 1 invite code pre-validation — lightweight check before account
// creation. Uses service role because invite_codes has no public RLS
// policies (anon and authenticated clients cannot read it directly).
export async function POST(request: NextRequest) {
  const body = await request.json() as { code?: string }
  const code = (body.code ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ status: 'invalid' })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('invite_codes')
    .select('status')
    .eq('code', code)
    .maybeSingle()

  if (!data) return NextResponse.json({ status: 'invalid' })
  if (data.status === 'unused') return NextResponse.json({ status: 'valid' })
  if (data.status === 'redeemed') return NextResponse.json({ status: 'already_used' })
  if (data.status === 'expired') return NextResponse.json({ status: 'expired' })
  return NextResponse.json({ status: 'invalid' })
}
