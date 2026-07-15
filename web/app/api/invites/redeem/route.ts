import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PRICING_TIER_TO_TIER: Record<string, string> = {
  lifetime_explorer:    'explorer',
  lifetime_accelerator: 'accelerator',
  lifetime_command:     'command',
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { code?: string }
  const code = (body.code ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 })

  const service = createServiceClient()

  const { data: invite } = await service
    .from('invite_codes')
    .select('status, is_multi_use, use_count, max_uses, pricing_tier_grant, requires_idme, onboarding_context_grant, org_source, complimentary_months')
    .eq('code', code)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  if (invite.status === 'expired') return NextResponse.json({ error: 'code_expired' }, { status: 400 })

  const useCount = (invite.use_count as number) ?? 0

  if (invite.is_multi_use) {
    // Multi-use: enforce max_uses cap if set
    if (invite.max_uses != null && useCount >= (invite.max_uses as number)) {
      return NextResponse.json({ error: 'code_already_used' }, { status: 400 })
    }
  } else {
    // Single-use: must be unused
    if (invite.status === 'redeemed') return NextResponse.json({ error: 'code_already_used' }, { status: 400 })
  }

  // Profile update first — if this fails the invite code is untouched
  const tier = PRICING_TIER_TO_TIER[invite.pricing_tier_grant as string ?? ''] ?? 'trial'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileUpdate: Record<string, any> = { tier }

  if (invite.onboarding_context_grant) {
    profileUpdate.onboarding_context = invite.onboarding_context_grant
  }
  if (invite.org_source) {
    profileUpdate.org_source = invite.org_source
  }
  const complimentaryMonths = (invite.complimentary_months as number) ?? 0
  if (complimentaryMonths > 0) {
    const expires = new Date()
    expires.setMonth(expires.getMonth() + complimentaryMonths)
    profileUpdate.complimentary_expires_at = expires.toISOString()
  }

  const { error: profileError } = await service
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id)

  if (profileError) {
    console.error('[redeem] profile update failed:', profileError)
    return NextResponse.json({ error: 'profile_update_failed' }, { status: 500 })
  }

  // Profile confirmed — now mark the code as consumed
  const codeUpdate: Record<string, unknown> = { use_count: useCount + 1 }
  if (!invite.is_multi_use) {
    codeUpdate.status = 'redeemed'
    codeUpdate.redeemed_by = user.id
    codeUpdate.redeemed_at = new Date().toISOString()
  }

  const { error: codeError } = await service
    .from('invite_codes')
    .update(codeUpdate)
    .eq('code', code)

  if (codeError) {
    // Profile already updated — log but don't fail the request.
    // Worst case: code can be reused once; ops can correct manually.
    console.error('[redeem] code update failed after profile write:', codeError)
  }

  return NextResponse.json({ success: true, requires_idme: !!(invite.requires_idme) })
}
