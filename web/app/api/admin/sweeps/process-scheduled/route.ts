import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Kick-off only — account processing handled by process-account-queue worker

// Vercel Cron only — never callable by an end user. Secured with CRON_SECRET.
// Responsibilities:
//   1. Reap sweep rows stuck at status='running' longer than Vercel's max function duration.
//   2. Transition bulk_sweep_jobs that are due (scheduled_at <= now) from 'scheduled' -> 'running'.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 1. Reap sweeps stuck at status='running' for more than 10 minutes.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: staleSweeps, error: staleErr } = await supabase
    .from('sweeps')
    .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: 'Timed out — reaped by watchdog' })
    .eq('status', 'running')
    .lt('started_at', staleThreshold)
    .select('id, user_id')

  if (staleErr) {
    console.error('[cron:stale-recovery] error marking stale sweeps failed:', staleErr)
  } else if (staleSweeps && staleSweeps.length > 0) {
    console.log(`[cron:stale-recovery] marked ${staleSweeps.length} stale sweep(s) failed:`, staleSweeps.map(s => s.id))
  }

  // 2. Transition due bulk_sweep_jobs from 'scheduled' -> 'running'.
  const { data: dueJobs } = await supabase
    .from('bulk_sweep_jobs')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  if (!dueJobs || dueJobs.length === 0) {
    return NextResponse.json({ kicked_off: 0, stale_reaped: staleSweeps?.length ?? 0 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const secret = process.env.CRON_SECRET ?? ''

  for (const job of dueJobs) {
    await supabase.from('bulk_sweep_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)
    console.log(`[cron:job-started] ${job.id} — kicking off queue worker`)
  }

  // Kick off the queue worker once — it self-chains until the queue is empty.
  fetch(`${baseUrl}/api/admin/sweeps/process-account-queue`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${secret}` },
  }).catch(err => console.error('[cron:kick-off] queue worker invoke failed:', err))

  return NextResponse.json({ kicked_off: dueJobs.length, stale_reaped: staleSweeps?.length ?? 0 })
}
