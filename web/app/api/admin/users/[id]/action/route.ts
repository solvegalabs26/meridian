import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'

export const dynamic = 'force-dynamic'

const VALID_TIERS = ['trial', 'explorer', 'accelerator', 'command'] as const

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: targetUserId } = params
  if (!targetUserId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

  const body = await request.json() as {
    action: 'add_credits' | 'change_tier' | 'mark_beta'
    value?: unknown
    note?: string
  }

  const { action, value, note } = body
  const service = createServiceClient()

  if (action === 'add_credits') {
    const credits = Number(value)
    if (!Number.isInteger(credits) || credits <= 0) {
      return NextResponse.json({ error: 'value must be a positive integer' }, { status: 400 })
    }
    const { error } = await service.rpc('increment_sweep_credits', {
      user_id: targetUserId,
      amount: credits,
    }).throwOnError().then(() => ({ error: null })).catch(e => ({ error: e }))

    if (error) {
      // Fallback: manual fetch-then-update if RPC doesn't exist yet
      const { data: profile } = await service.from('profiles').select('sweep_credits').eq('id', targetUserId).single()
      const current = (profile?.sweep_credits as number) ?? 0
      await service.from('profiles').update({ sweep_credits: current + credits }).eq('id', targetUserId)
    }

    await service.from('admin_action_log').insert({
      admin_id: admin.id,
      target_user_id: targetUserId,
      action: 'add_credits',
      payload: { credits },
      note: note ?? null,
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'change_tier') {
    const tier = value as string
    if (!VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { tier }
    if (tier === 'trial') {
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 7)
      updates.trial_ends_at = trialEnd.toISOString()
    }

    await service.from('profiles').update(updates).eq('id', targetUserId)
    await service.from('admin_action_log').insert({
      admin_id: admin.id,
      target_user_id: targetUserId,
      action: 'change_tier',
      payload: { tier },
      note: note ?? null,
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'mark_beta') {
    const isBeta = Boolean(value)
    await service.from('profiles').update({ is_beta: isBeta }).eq('id', targetUserId)
    await service.from('admin_action_log').insert({
      admin_id: admin.id,
      target_user_id: targetUserId,
      action: 'mark_beta',
      payload: { is_beta: isBeta },
      note: note ?? null,
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
