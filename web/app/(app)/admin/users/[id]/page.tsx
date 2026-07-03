import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'
import AdminNav from '@/components/admin/AdminNav'
import UserDetailClient from './UserDetailClient'

export const dynamic = 'force-dynamic'

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) notFound()

  const { id: userId } = params
  const service = createServiceClient()

  const [
    { data: profile },
    { data: authUser },
    { data: objectives },
    { data: sweeps },
    { data: confidenceScores },
    { data: actionLog },
  ] = await Promise.all([
    service
      .from('profiles')
      .select('full_name, account_type, tier, sweep_count, sweep_credits, is_beta, trial_ends_at, created_at, onboarded_at')
      .eq('id', userId)
      .single(),
    service.auth.admin.getUserById(userId),
    service
      .from('objectives')
      .select('id, obj_id, title, category, status, confidence')
      .eq('user_id', userId)
      .order('sort_order'),
    service
      .from('sweeps')
      .select('id, status, trigger_type, objectives_swept, cost_usd, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('confidence_scores')
      .select('score, created_at, objective_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100),
    service
      .from('admin_action_log')
      .select('id, action, payload, note, created_at')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!profile) notFound()

  const email = authUser.user?.email ?? '(no email)'

  // Build confidence history for chart
  const objectiveMap = new Map((objectives ?? []).map(o => [o.id as string, o.title as string]))
  const objectiveTitles = Array.from(new Set((confidenceScores ?? []).map(c => objectiveMap.get(c.objective_id as string) ?? c.objective_id as string)))

  // Group by date
  const dateMap = new Map<string, Record<string, number>>()
  for (const score of confidenceScores ?? []) {
    const date = new Date(score.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const title = objectiveMap.get(score.objective_id as string) ?? (score.objective_id as string)
    if (!dateMap.has(date)) dateMap.set(date, {})
    dateMap.get(date)![title] = score.score as number
  }

  const confidenceHistory = Array.from(dateMap.entries()).map(([date, scores]) => ({
    date,
    ...scores,
  }))

  return (
    <div>
      <AdminNav />
      <UserDetailClient
        userId={userId}
        email={email}
        profile={{
          full_name: profile.full_name as string | null,
          account_type: (profile.account_type as string) ?? 'personal',
          tier: (profile.tier as string) ?? 'trial',
          sweep_count: (profile.sweep_count as number) ?? 0,
          sweep_credits: (profile.sweep_credits as number) ?? 0,
          is_beta: profile.is_beta as boolean,
          trial_ends_at: profile.trial_ends_at as string | null,
          created_at: profile.created_at as string,
          onboarded_at: profile.onboarded_at as string | null,
        }}
        objectives={(objectives ?? []).map(o => ({
          id: o.id as string,
          obj_id: o.obj_id as string,
          title: o.title as string,
          category: o.category as string,
          status: o.status as string,
          confidence: o.confidence as number,
        }))}
        sweeps={(sweeps ?? []).map(s => ({
          id: s.id as string,
          status: s.status as string,
          trigger_type: s.trigger_type as string,
          objectives_swept: s.objectives_swept as number | null,
          cost_usd: s.cost_usd as number | null,
          created_at: s.created_at as string,
        }))}
        confidenceHistory={confidenceHistory}
        objectiveTitles={objectiveTitles}
        actionLog={(actionLog ?? []).map(a => ({
          id: a.id as string,
          action: a.action as string,
          payload: a.payload as Record<string, unknown>,
          note: a.note as string | null,
          created_at: a.created_at as string,
        }))}
      />
    </div>
  )
}
