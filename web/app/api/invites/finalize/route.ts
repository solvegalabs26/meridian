import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Maps the invite_codes.pricing_tier_grant value to the profiles.tier column
// the app's effective-tier resolver reads. The redeem_invite_code RPC sets
// pricing_tier but not tier, so every redeemed alpha account resolves as
// 'trial' until this finalization step runs.
const PRICING_TIER_TO_TIER: Record<string, string> = {
  lifetime_explorer:    'explorer',
  lifetime_accelerator: 'accelerator',
  lifetime_command:     'command',
}

function mapTier(pricingTierGrant: string | null): string {
  return PRICING_TIER_TO_TIER[pricingTierGrant ?? ''] ?? 'trial'
}

export async function POST(request: NextRequest) {
  // Authenticate the caller — only the just-redeemed user can finalize their own tier.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { code?: string }
  const code = (body.code ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 })

  // Use service role to read invite_codes — no public RLS on that table.
  const service = createServiceClient()

  const { data: invite } = await service
    .from('invite_codes')
    .select('pricing_tier_grant, redeemed_by')
    .eq('code', code)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'code_not_found' }, { status: 404 })

  // Guard: the code must have been redeemed by this user.
  // Prevents one user from finalizing another user's tier by guessing codes.
  if (invite.redeemed_by !== user.id) {
    return NextResponse.json({ error: 'not_redeemed_by_caller' }, { status: 403 })
  }

  const tier = mapTier(invite.pricing_tier_grant as string | null)

  const { error } = await service
    .from('profiles')
    .update({ tier })
    .eq('id', user.id)

  if (error) {
    console.error('[finalize-tier] profile update failed:', error)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tier })
}
