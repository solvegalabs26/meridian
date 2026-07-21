'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type CohortFilter = 'alpha' | 'beta' | 'veteran' | 'all' | 'custom'

interface Account {
  id: string
  email: string
  fullName: string | null
  accountType: string | null
}

interface JobSummary {
  id: string
  cohortFilter: string
  status: string
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  total: number
  succeeded: number
  failed: number
  emailsSent: number
}

interface Props {
  accounts: Account[]
  jobs: JobSummary[]
}

const COHORTS: { value: CohortFilter; label: string }[] = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'veteran', label: 'Veteran' },
  { value: 'all', label: 'All' },
  { value: 'custom', label: 'Custom' },
]

// Mirrors the resolution logic in app/api/admin/sweeps/bulk/route.ts —
// this is a preview only, the server resolves and snapshots the real list.
function resolveCohortPreview(cohort: CohortFilter, customIds: Set<string>, accounts: Account[]): Account[] {
  if (cohort === 'custom') return accounts.filter(a => customIds.has(a.id))
  if (cohort === 'alpha') return accounts.filter(a => a.accountType?.startsWith('alpha'))
  if (cohort === 'beta') return accounts.filter(a => a.accountType === 'beta')
  if (cohort === 'veteran') return accounts.filter(a => a.accountType === 'veteran_pending' || a.accountType === 'veteran_verified')
  return accounts
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function AdminSweepsClient({ accounts, jobs }: Props) {
  const router = useRouter()
  const [cohort, setCohort] = useState<CohortFilter>('alpha')
  const [customIds, setCustomIds] = useState<Set<string>>(new Set())
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ jobId: string; count: number; status: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(() => resolveCohortPreview(cohort, customIds, accounts), [cohort, customIds, accounts])

  function toggleCustom(id: string) {
    setCustomIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (preview.length === 0) return
    setSubmitting(true)
    setError(null)
    setResult(null)

    const body: { cohort_filter: CohortFilter; user_ids?: string[]; scheduled_at?: string | null } = {
      cohort_filter: cohort,
    }
    if (cohort === 'custom') body.user_ids = Array.from(customIds)
    if (scheduleMode === 'later' && scheduledAt) body.scheduled_at = new Date(scheduledAt).toISOString()

    const res = await fetch('/api/admin/sweeps/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { job_id?: string; account_count?: number; status?: string; error?: string }
    setSubmitting(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to start sweep job')
      return
    }

    setResult({ jobId: data.job_id!, count: data.account_count!, status: data.status! })
    router.refresh()
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--text)]">Bulk Sweep Scheduler</h1>
        <p className="text-[13px] text-[var(--text3)] mt-0.5">Admin only · not the full Admin Panel</p>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border)] p-6 space-y-5 mb-8">
        {/* Cohort selector */}
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">Cohort</label>
          <div className="flex gap-2 flex-wrap">
            {COHORTS.map(c => (
              <button
                key={c.value}
                onClick={() => setCohort(c.value)}
                className={`px-4 py-2 rounded-lg border text-[13px] font-medium transition-all ${
                  cohort === c.value ? 'border-[var(--blue)] bg-[#E6F1FB] text-[var(--blue)]' : 'border-[var(--border)] text-[var(--text2)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom multi-select */}
        {cohort === 'custom' && (
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">
              Select accounts
            </label>
            <div className="border border-[var(--border)] rounded-lg max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
              {accounts.map(a => (
                <label key={a.id} className="flex items-center gap-3 px-3 py-2 text-[13px] cursor-pointer hover:bg-[var(--gray-lt)]">
                  <input
                    type="checkbox"
                    checked={customIds.has(a.id)}
                    onChange={() => toggleCustom(a.id)}
                    className="w-4 h-4"
                  />
                  <span className="flex-1 text-[var(--text)]">{a.fullName || a.email}</span>
                  <span className="text-[11px] text-[var(--text3)]">{a.email}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--gray-lt)] text-[var(--text3)]">
                    {a.accountType ?? 'personal'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="p-3 rounded-lg bg-[var(--gray-lt)] border border-[var(--border)]">
          <p className="text-[13px] font-medium text-[var(--text)] mb-1">
            {preview.length} account{preview.length !== 1 ? 's' : ''} will be swept
          </p>
          {preview.length > 0 && (
            <p className="text-[11px] text-[var(--text3)] leading-relaxed">
              {preview.slice(0, 8).map(a => a.fullName || a.email).join(', ')}
              {preview.length > 8 ? `, +${preview.length - 8} more` : ''}
            </p>
          )}
        </div>

        {/* Schedule control */}
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">When</label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setScheduleMode('now')}
              className={`px-4 py-2 rounded-lg border text-[13px] font-medium transition-all ${
                scheduleMode === 'now' ? 'border-[var(--blue)] bg-[#E6F1FB] text-[var(--blue)]' : 'border-[var(--border)] text-[var(--text2)]'
              }`}
            >
              Run now
            </button>
            <button
              onClick={() => setScheduleMode('later')}
              className={`px-4 py-2 rounded-lg border text-[13px] font-medium transition-all ${
                scheduleMode === 'later' ? 'border-[var(--blue)] bg-[#E6F1FB] text-[var(--blue)]' : 'border-[var(--border)] text-[var(--text2)]'
              }`}
            >
              Schedule for later
            </button>
          </div>
          {scheduleMode === 'later' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] bg-white focus:outline-none focus:border-[var(--blue)]"
            />
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{error}</div>
        )}
        {result && (
          <div className="p-3 rounded-lg bg-[var(--green-lt)] text-[var(--green)] text-[13px]">
            {result.status === 'scheduled'
              ? `Sweep scheduled for ${result.count} account${result.count !== 1 ? 's' : ''}.`
              : result.status === 'queued'
                ? `Queued ${result.count} account${result.count !== 1 ? 's' : ''} — queue worker processes one every 5 min.`
                : `Sweep ${result.status} for ${result.count} account${result.count !== 1 ? 's' : ''}.`}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || preview.length === 0 || (scheduleMode === 'later' && !scheduledAt)}
          className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Running...' : scheduleMode === 'now' ? `Run sweep for ${preview.length} account${preview.length !== 1 ? 's' : ''} →` : 'Schedule sweep →'}
        </button>
      </div>

      {/* Job history */}
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-3">Job history</h2>
        {jobs.length === 0 ? (
          <p className="text-[13px] text-[var(--text3)]">No bulk sweep jobs yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--gray-lt)]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Cohort</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Scheduled</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Completed</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Accounts</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5 text-[var(--text)]">{j.cohortFilter}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--gray-lt)] text-[var(--text2)]">
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text3)]">{formatDate(j.scheduledAt)}</td>
                    <td className="px-4 py-2.5 text-[var(--text3)]">{formatDate(j.completedAt)}</td>
                    <td className="px-4 py-2.5 text-right text-[var(--text2)]">
                      {j.succeeded}/{j.total} ok
                      {j.failed > 0 && <span className="text-[var(--red)]"> · {j.failed} failed</span>}
                      <span className="text-[var(--text3)]"> · {j.emailsSent} emailed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
