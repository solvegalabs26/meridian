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
