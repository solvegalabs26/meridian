import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processSingleJobAccount } from '@/lib/sweep/executeBulkSweepJob'
import { sendBulkSweepFailureAlert } from '@/lib/email/resend'

export const dynamic = 'force-dynamic'
// Each invocation handles exactly one account — budget is the full 300 s.
export const maxDuration = 300

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// Secured with CRON_SECRET. Can be called by the Vercel cron or by self-chaining.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Pick the oldest pending account across all running jobs.
  const { data: nextAccount } = await supabase
    .from('bulk_sweep_job_accounts')
    .select('id, job_id, user_id')
    .eq('sweep_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!nextAccount) {
    return NextResponse.json({ processed: 0, message: 'Queue empty' })
  }

  console.log(`[queue-worker] processing account=${nextAccount.id} job=${nextAccount.job_id} user=${nextAccount.user_id}`)

  const result = await processSingleJobAccount(
    nextAccount.id,
    nextAccount.job_id,
    nextAccount.user_id
  )

  // Check if the job is now fully complete (no pending or running accounts remain).
  const { count: remaining } = await supabase
    .from('bulk_sweep_job_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', nextAccount.job_id)
    .in('sweep_status', ['pending', 'running'])

  if (remaining === 0) {
    await supabase.from('bulk_sweep_jobs')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', nextAccount.job_id)

    // Send a single consolidated failure alert if any accounts failed.
    const { data: failedAccounts } = await supabase
      .from('bulk_sweep_job_accounts')
      .select('user_id, sweep_error')
      .eq('job_id', nextAccount.job_id)
      .eq('sweep_status', 'failed')

    if (failedAccounts && failedAccounts.length > 0) {
      const { data: job } = await supabase
        .from('bulk_sweep_jobs').select('cohort_filter').eq('id', nextAccount.job_id).single()
      const { count: totalCount } = await supabase
        .from('bulk_sweep_job_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', nextAccount.job_id)

      await sendBulkSweepFailureAlert({
        jobId: nextAccount.job_id,
        cohort: job?.cohort_filter ?? 'unknown',
        totalAccounts: totalCount ?? 0,
        failures: failedAccounts.map(a => ({
          userId: a.user_id,
          email: null,
          error: (a.sweep_error as string | null) ?? 'Unknown error',
        })),
      }).catch(console.error)
    }

    console.log(`[queue-worker] job ${nextAccount.job_id} complete`)
  } else if ((remaining ?? 0) > 0) {
    // Self-chain: fire next invocation without blocking this response.
    const baseUrl = getBaseUrl()
    const secret = process.env.CRON_SECRET ?? ''
    fetch(`${baseUrl}/api/admin/sweeps/process-account-queue`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${secret}` },
    }).catch(err => console.error('[queue-worker] self-chain failed:', err))
    console.log(`[queue-worker] ${remaining} account(s) remaining — self-chain fired`)
  }

  return NextResponse.json({
    processed: 1,
    account_id: nextAccount.id,
    job_id: nextAccount.job_id,
    success: result.success,
    remaining,
  })
}
