import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'

export const dynamic = 'force-dynamic'

type CohortFilter = 'alpha' | 'beta' | 'veteran' | 'all' | 'custom'

async function resolveCohort(
  service: ReturnType<typeof createServiceClient>,
  cohortFilter: CohortFilter,
  userIds?: string[]
): Promise<string[]> {
  if (cohortFilter === 'custom') {
    if (!userIds || userIds.length === 0) return []
    const { data } = await service.from('profiles').select('id').in('id', userIds)
    return (data ?? []).map(p => p.id)
  }

  let query = service.from('profiles').select('id')

  if (cohortFilter === 'alpha') {
    query = query.like('account_type', 'alpha%')
  } else if (cohortFilter === 'beta') {
    query = query.eq('account_type', 'beta')
  } else if (cohortFilter === 'veteran') {
    query = query.in('account_type', ['veteran_pending', 'veteran_verified'])
  } else if (cohortFilter !== 'all') {
    throw new Error(`Invalid cohort_filter: ${cohortFilter}`)
  }

  const { data } = await query
  return (data ?? []).map(p => p.id)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    cohort_filter: CohortFilter
    user_ids?: string[]
    scheduled_at?: string | null
  }

  if (!body.cohort_filter) {
    return NextResponse.json({ error: 'cohort_filter is required' }, { status: 400 })
  }
  if (body.cohort_filter === 'custom' && (!body.user_ids || body.user_ids.length === 0)) {
    return NextResponse.json({ error: 'user_ids is required for cohort_filter=custom' }, { status: 400 })
  }

  const service = createServiceClient()

  // Resolve the target account list now and snapshot it into
  // bulk_sweep_job_accounts immediately — cohort membership is not
  // re-resolved at execution time, so a signup between scheduling and
  // execution is correctly excluded from a job scheduled before they existed.
  let userIds: string[]
  try {
    userIds = await resolveCohort(service, body.cohort_filter, body.user_ids)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid cohort_filter' },
      { status: 400 }
    )
  }

  if (userIds.length === 0) {
    return NextResponse.json({ error: 'No accounts matched this cohort' }, { status: 400 })
  }

  const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null
  const isFuture = scheduledAt !== null && scheduledAt.getTime() > Date.now()

  const { data: job, error: jobError } = await service
    .from('bulk_sweep_jobs')
    .insert({
      cohort_filter: body.cohort_filter,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      status: isFuture ? 'scheduled' : 'pending',
      created_by: admin.id,
    })
    .select()
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? 'Failed to create job' }, { status: 500 })
  }

  const { error: accountsError } = await service
    .from('bulk_sweep_job_accounts')
    .insert(userIds.map(userId => ({
      job_id: job.id,
      user_id: userId,
      sweep_status: 'pending',
      email_status: 'pending',
    })))

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 })
  }

  if (!isFuture) {
    // Mark the job running immediately so the account-queue worker picks it up
    // on its next invocation (every 5 min). We no longer process inline because
    // large cohorts (9+ accounts x ~180s each) blow past Vercel's 300s limit.
    await service.from('bulk_sweep_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)
  }

  return NextResponse.json({
    job_id: job.id,
    account_count: userIds.length,
    status: isFuture ? 'scheduled' : 'queued',
  })
}
