import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    .select('status, is_multi_use, use_count, max_uses, account_type_grant, pricing_tier_grant, requires_idme, onboarding_context_grant, org_source, complimentary_months')
    .eq('code', code)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  if (invite.status === 'expired') return NextResponse.json({ error: 'code_expired' }, { status: 400 })

  const useCount = (invite.use_count as number) ?? 0

  if (invite.is_multi_use) {
    if (invite.max_uses != null && useCount >= (invite.max_uses as number)) {
      return NextResponse.json({ error: 'code_already_used' }, { status: 400 })
    }
  } else {
    if (invite.status === 'redeemed') return NextResponse.json({ error: 'code_already_used' }, { status: 400 })
  }

  // Build profile update with correct column names.
  // account_type: veteran codes park at 'veteran_pending' until ID.me verification.
  // pricing_tier: the raw grant value (e.g. 'lifetime_explorer'), not the short alias.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileUpdate: Record<string, any> = {
    account_type: invite.requires_idme ? 'veteran_pending' : (invite.account_type_grant ?? null),
    pricing_tier: invite.pricing_tier_grant ?? null,
  }

  if (invite.onboarding_context_grant) {
    profileUpdate.onboarding_context = invite.onboarding_context_grant
  }
  if (invite.org_source) {
    profileUpdate.org_source = invite.org_source
    profileUpdate.cohort_data_consent = true
  }
  const complimentaryMonths = (invite.complimentary_months as number) ?? 0
  if (complimentaryMonths > 0) {
    const expires = new Date()
    expires.setMonth(expires.getMonth() + complimentaryMonths)
    profileUpdate.complimentary_expires_at = expires.toISOString()
  }

  // Profile write first — if this fails the invite code is untouched.
  const { error: profileError } = await service
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id)

  if (profileError) {
    console.error('[redeem] profile update failed:', profileError)
    return NextResponse.json({ error: 'profile_update_failed' }, { status: 500 })
  }

  // Profile confirmed — mark code consumed. use_count increments on every
  // redemption (single-use and multi-use) so the counter is always accurate.
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
