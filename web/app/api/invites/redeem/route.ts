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

  if (invite.is_multi_use) {
    // Multi-use: enforce max_uses cap if set
    const useCount = (invite.use_count as number) ?? 0
    if (invite.max_uses != null && useCount >= (invite.max_uses as number)) {
      return NextResponse.json({ error: 'code_already_used' }, { status: 400 })
    }
    // Increment use_count — leave status as 'unused'
    const { error: codeError } = await service
      .from('invite_codes')
      .update({ use_count: useCount + 1 })
      .eq('code', code)
    if (codeError) {
      console.error('[redeem] code increment failed:', codeError)
      return NextResponse.json({ error: 'redeem_failed' }, { status: 500 })
    }
  } else {
    // Single-use: must be unused; flip status to redeemed
    if (invite.status === 'redeemed') return NextResponse.json({ error: 'code_already_used' }, { status: 400 })
    const { error: codeError } = await service
      .from('invite_codes')
      .update({ status: 'redeemed', redeemed_by: user.id, redeemed_at: new Date().toISOString() })
      .eq('code', code)
    if (codeError) {
      console.error('[redeem] code redeem failed:', codeError)
      return NextResponse.json({ error: 'redeem_failed' }, { status: 500 })
    }
  }

  // Build profile update
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

  return NextResponse.json({ success: true, requires_idme: !!(invite.requires_idme) })
}
