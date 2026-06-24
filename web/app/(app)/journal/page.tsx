import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const EXPERIMENT_START = new Date('2026-06-23')

function getWeekOf(weekNum: number): Date {
  const d = new Date(EXPERIMENT_START)
  d.setDate(d.getDate() + (weekNum - 1) * 7)
  return d
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function JournalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('entry_number, week_of, section_h_rating, is_complete, updated_at')
    .eq('user_id', user.id)
    .order('entry_number')

  const entryMap = new Map((entries ?? []).map(e => [e.entry_number, e]))
  const now = new Date()

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--text)]">Founder Journal</h1>
        <p className="text-[13px] text-[var(--text3)] mt-0.5">30-week Persistent Objective State experiment · Started June 23, 2026</p>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--gray-lt)]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider w-16">Week</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Week of</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Rating</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 30 }, (_, i) => i + 1).map(week => {
              const weekOf = getWeekOf(week)
              const entry = entryMap.get(week)
              const isFuture = weekOf > now

              let status: 'complete' | 'in_progress' | 'not_started' | 'future' = 'future'
              if (entry?.is_complete) status = 'complete'
              else if (entry) status = 'in_progress'
              else if (!isFuture) status = 'not_started'

              const statusDisplay = {
                complete:    { label: 'Complete',    cls: 'bg-[var(--green-lt)] text-[var(--green)]' },
                in_progress: { label: 'In progress', cls: 'bg-[var(--amber-lt)] text-[var(--amber-brand)]' },
                not_started: { label: 'Not started', cls: 'bg-[var(--gray-lt)] text-[var(--text3)]' },
                future:      { label: 'Not yet',     cls: 'bg-[var(--gray-lt)] text-[var(--text3)]' },
              }[status]

              return (
                <tr key={week} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--gray-lt)/50] transition-colors">
                  <td className="px-4 py-3 font-mono text-[var(--text3)]">W{String(week).padStart(2, '0')}</td>
                  <td className="px-4 py-3 text-[var(--text2)]">{formatDate(weekOf)}</td>
                  <td className="px-4 py-3">
                    {isFuture ? (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusDisplay.cls}`}>
                        {statusDisplay.label}
                      </span>
                    ) : (
                      <Link href={`/journal/${week}`} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusDisplay.cls} hover:opacity-80`}>
                        {statusDisplay.label}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry?.section_h_rating ? (
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(star => (
                          <span key={star} className={`text-[13px] ${star <= (entry.section_h_rating ?? 0) ? 'text-[var(--gold)]' : 'text-[var(--border)]'}`}>★</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--text3)]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
