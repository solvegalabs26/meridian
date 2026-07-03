import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_TIERS = ['trial', 'explorer', 'accelerator', 'command'] as const

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { tier?: string }
  const tier = body.tier

  if (!tier || !VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { tier }

  if (tier === 'trial') {
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 7)
    updates.trial_ends_at = trialEnd.toISOString()
  }

  // TODO: replace with Stripe checkout when billing is built (v1.1)
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, tier })
}
