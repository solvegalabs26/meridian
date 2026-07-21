import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Kick-off only — account processing handled by process-account-queue worker

// Vercel Cron only — never callable by an end user. Secured with CRON_SECRET.
// Responsibilities:
//   1. Reap sweep rows stuck at status='running' longer than Vercel's max function duration.
//   2. Transition bulk_sweep_jobs that are due (scheduled_at <= now) from 'scheduled' -> 'running'.
// Account-by-account processing is handled by the separate /api/admin/sweeps/process-account-queue
// worker cron (runs every 5 minutes), which picks one pending account per invocation so each
// sweep gets its own 300 s Vercel budget regardless of cohort size.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 1. Reap sweeps stuck at status='running'. Vercel hard-kills functions at 300 s,
  //    bypassing try/catch, so runSweepForUser never gets a chance to mark them failed.
  //    Anything still running after 10 minutes is a true orphan.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min — Vercel max is 300s
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

  // 2. Transition due bulk_sweep_jobs from 'scheduled' -> 'running' so the
  //    account-queue worker can pick up their pending accounts.
  const { data: dueJobs } = await supabase
    .from('bulk_sweep_jobs')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  if (!dueJobs || dueJobs.length === 0) {
    return NextResponse.json({ kicked_off: 0, stale_reaped: staleSweeps?.length ?? 0 })
  }

  for (const job of dueJobs) {
    await supabase.from('bulk_sweep_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)
    console.log(`[cron:job-started] ${job.id} — accounts will be processed by queue worker`)
  }

  return NextResponse.json({ kicked_off: dueJobs.length, stale_reaped: staleSweeps?.length ?? 0 })
}
