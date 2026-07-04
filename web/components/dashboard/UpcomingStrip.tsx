import { CalendarDays } from 'lucide-react'

export interface UpcomingEvent {
  id: string
  starts_at: string
  summary: string | null
  objective_ids: string[]
}

interface ObjectiveRef {
  id: string
  title: string
  target_date: string | null
}

interface Props {
  events: UpcomingEvent[]
  objectives: ObjectiveRef[]
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isNearDeadline(eventStartsAt: string, targetDate: string): boolean {
  const eventDate = new Date(eventStartsAt)
  const deadline = new Date(targetDate)
  const diffMs = Math.abs(eventDate.getTime() - deadline.getTime())
  return diffMs <= 7 * 24 * 60 * 60 * 1000
}

export default function UpcomingStrip({ events, objectives }: Props) {
  if (events.length === 0) return null

  const objectiveMap = new Map(objectives.map(o => [o.id, o]))
  const displayed = events.slice(0, 5)

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)' }}>
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays size={13} style={{ color: 'var(--blue-mid)' }} />
        <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: 'var(--blue-mid)' }}>
          Upcoming
        </p>
      </div>

      <div className="space-y-2">
        {displayed.map(event => {
          const matchedObjectives = event.objective_ids
            .map(id => objectiveMap.get(id))
            .filter((o): o is ObjectiveRef => !!o)

          const nearDeadline = matchedObjectives.some(
            o => o.target_date && isNearDeadline(event.starts_at, o.target_date)
          )

          return (
            <div key={event.id} className="flex items-start gap-2.5">
              <span
                className="text-[10px] font-mono font-medium flex-shrink-0 mt-0.5 w-14 text-right"
                style={{ color: 'var(--ov-text-dim)' }}
              >
                {formatEventDate(event.starts_at)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] truncate" style={{ color: 'var(--ov-text-hi)' }}>
                    {event.summary ?? 'Untitled event'}
                  </span>
                  {nearDeadline && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'rgba(201,162,39,0.18)', color: 'var(--gold)' }}
                    >
                      near deadline
                    </span>
                  )}
                </div>
                {matchedObjectives.length > 0 && (
                  <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--ov-text-dim)' }}>
                    re: {matchedObjectives.map(o => o.title).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
