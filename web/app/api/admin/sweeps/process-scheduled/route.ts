import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { executeBulkSweepJob } from '@/lib/sweep/executeBulkSweepJob'

export const dynamic = 'force-dynamic'
// Same tradeoff as the immediate-run path in /api/admin/sweeps/bulk — due
// jobs are executed inline within this cron invocation. Fine for the
// occasional small job tonight; revisit if multiple large jobs can be due
// in the same 5-minute window.
export const maxDuration = 300

// Vercel Cron only — never callable by an end user. Vercel signs cron
// requests with `Authorization: Bearer $CRON_SECRET`; reject anything else.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Recover sweeps left stuck at status='running' from a prior Vercel hard-kill.
  // A Vercel function kill bypasses try/catch, so runSweepForUser never marks
  // them failed. Vercel functions max out at 300 s, so anything still running
  // after 60 minutes is a true orphan. status='scheduled' rows are intentionally
  // excluded — they are waiting for this cron, not stuck.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min — Vercel max is 300s
  const { data: staleSweeps, error: staleErr } = await supabase
    .from('sweeps')
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('started_at', staleThreshold)
    .select('id, user_id')

  if (staleErr) {
    console.error('[cron:stale-recovery] error marking stale sweeps failed:', staleErr)
  } else if (staleSweeps && staleSweeps.length > 0) {
    console.log(`[cron:stale-recovery] marked ${staleSweeps.length} stale sweep(s) failed:`, staleSweeps.map(s => s.id))
  }

  const { data: dueJobs } = await supabase
    .from('bulk_sweep_jobs')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  if (!dueJobs || dueJobs.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  for (const job of dueJobs) {
    await supabase.from('bulk_sweep_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)

    await executeBulkSweepJob(job.id)
  }

  return NextResponse.json({ processed: dueJobs.length })
}
