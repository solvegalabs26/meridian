import type { CheckinStatsData } from '@/lib/reporting/types'

interface Props {
  orgSource: string
  stats: CheckinStatsData
}

export function CheckinEngagementCard({ orgSource, stats }: Props) {
  if (stats.totalEligible === 0) return null

  function completionColor(pct: number) {
    if (pct >= 70) return '#22c55e'
    if (pct >= 40) return '#C9A227'
    return '#f87171'
  }

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border)]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text3)] mb-3">
        Weekly Check-in Engagement · {orgSource}
      </p>

      <div className="flex items-baseline gap-2 mb-3">
        <span
          className="text-[22px] font-semibold"
          style={{ color: completionColor(stats.overallCompletionRate) }}
        >
          {stats.overallCompletionRate}%
        </span>
        <span className="text-[12px] text-[var(--text3)]">
          completion · {stats.totalSubmitted} of {stats.totalEligible} eligible fellows
        </span>
      </div>

      {stats.weeklyRows.length > 0 && (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-1.5 font-medium text-[var(--text3)]">Week of</th>
              <th className="text-center pb-1.5 font-medium text-[var(--text3)]">Submitted</th>
              <th className="text-center pb-1.5 font-medium text-[var(--text3)]">Rate</th>
              <th className="text-center pb-1.5 font-medium text-[var(--text3)]">Avg Rating</th>
              <th className="text-center pb-1.5 font-medium text-[var(--text3)]">Flags</th>
            </tr>
          </thead>
          <tbody>
            {stats.weeklyRows.map(row => (
              <tr key={row.weekOf} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5 text-[var(--text2)]">{row.weekOf}</td>
                <td className="py-1.5 text-center text-[var(--text2)]">{row.submitted}/{row.eligible}</td>
                <td className="py-1.5 text-center font-semibold" style={{ color: completionColor(row.completionPct) }}>
                  {row.completionPct}%
                </td>
                <td className="py-1.5 text-center text-[var(--text2)]">
                  {row.avgRating != null ? `${row.avgRating}/5` : '—'}
                </td>
                <td className="py-1.5 text-center" style={{ color: row.flagged > 0 ? '#C9A227' : 'var(--text3)' }}>
                  {row.flagged > 0 ? row.flagged : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
