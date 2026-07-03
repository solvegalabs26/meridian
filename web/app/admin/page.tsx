import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const service = createServiceClient()

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const [
    { count: totalUsers },
    { count: newThisWeek },
    { data: tierCounts },
    { data: acTypeCounts },
    { count: sweepsThisWeek },
    { data: recentJobs },
  ] = await Promise.all([
    service.from('profiles').select('*', { count: 'exact', head: true }),
    service.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()),
    service.from('profiles').select('tier'),
    service.from('profiles').select('account_type'),
    service.from('sweeps').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()),
    service.from('bulk_sweep_jobs')
      .select('id, cohort_filter, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const tierMap: Record<string, number> = {}
  for (const row of tierCounts ?? []) {
    const t = (row.tier as string) ?? 'trial'
    tierMap[t] = (tierMap[t] ?? 0) + 1
  }

  const alphaCount = (acTypeCounts ?? []).filter(r =>
    ['alpha_personal', 'alpha_business', 'beta'].includes(r.account_type as string)
  ).length

  const stats = [
    { label: 'Total users', value: totalUsers ?? 0 },
    { label: 'New this week', value: newThisWeek ?? 0 },
    { label: 'Alpha / Beta', value: alphaCount },
    { label: 'Sweeps this week', value: sweepsThisWeek ?? 0 },
  ]

  const tierOrder = ['trial', 'explorer', 'accelerator', 'command']
  const tierLabels: Record<string, string> = {
    trial: 'Trial', explorer: 'Explorer', accelerator: 'Accelerator', command: 'Command',
  }

  return (
    <div>
      <h1 className="text-[22px] font-medium text-[var(--text)] mb-6">Overview</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-[var(--border)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text3)] mb-1">{s.label}</p>
            <p className="text-[28px] font-medium text-[var(--text)]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tier breakdown */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-5 mb-4">
        <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Users by tier</h2>
        <div className="grid grid-cols-4 gap-3">
          {tierOrder.map(t => (
            <div key={t} className="text-center">
              <p className="text-[24px] font-medium text-[var(--text)]">{tierMap[t] ?? 0}</p>
              <p className="text-[11px] text-[var(--text3)]">{tierLabels[t]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent bulk sweep jobs */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider">Recent sweep jobs</h2>
          <Link href="/admin/sweeps" className="text-[12px] text-[var(--blue)] hover:underline">View all →</Link>
        </div>
        {(recentJobs ?? []).length === 0 ? (
          <p className="text-[13px] text-[var(--text3)]">No sweep jobs yet.</p>
        ) : (
          <div className="space-y-2">
            {(recentJobs ?? []).map(job => (
              <div key={job.id as string} className="flex items-center justify-between text-[13px] py-2 border-b border-[var(--border)] last:border-0">
                <div>
                  <span className="font-medium text-[var(--text)]">{job.cohort_filter as string}</span>
                  <span className="text-[var(--text3)] ml-2">{new Date(job.created_at as string).toLocaleDateString()}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  job.status === 'complete' ? 'bg-green-100 text-green-700'
                  : job.status === 'running' ? 'bg-blue-100 text-blue-700'
                  : job.status === 'failed' ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
                }`}>
                  {job.status as string}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
