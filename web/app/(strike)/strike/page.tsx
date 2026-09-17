import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ObjectiveProfile = {
  id: string
  taxonomy_key: string
  geo: { state?: string; unit?: string } | null
  timing: { trip_start?: string; trip_end?: string } | null
  agent_build_status: string
}

const BUILD_STATUS_BADGE: Record<string, string> = {
  ready:   'bg-green-700 text-green-100',
  partial: 'bg-amber-700 text-amber-100',
  queued:  'bg-slate-600 text-slate-300',
}

function formatDates(timing: ObjectiveProfile['timing']): string {
  if (!timing?.trip_start) return 'Dates TBD'
  const start = new Date(timing.trip_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = timing.trip_end
    ? new Date(timing.trip_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  return end ? `${start} – ${end}` : start
}

export default async function StrikeListPage() {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createServiceClient()

  // Resolve canonical user_id by email — guards against session/preview env mismatch
  // where the JWT user.id may not match the profiles row's id.
  let canonicalUserId = user.id
  if (user.email) {
    const { data: adminData } = await supabase.auth.admin.listUsers()
    const match = (adminData?.users ?? []).find(u => u.email === user.email)
    if (match?.id) canonicalUserId = match.id
  }

  console.log('[strike/list] session user.id:', user.id, 'email:', user.email, 'canonicalUserId:', canonicalUserId)

  const { data: objectives, error: objError } = await supabase
    .from('objective_profiles')
    .select('id, taxonomy_key, geo, timing, agent_build_status')
    .eq('user_id', canonicalUserId)
    .eq('org_source', 'strike')
    .order('created_at', { ascending: false })

  console.log('[strike/list] objectives count:', objectives?.length ?? 0, 'error:', objError?.message ?? null)

  const list = (objectives ?? []) as ObjectiveProfile[]

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Meridian</div>
          <div className="text-lg font-semibold">Strike Objectives</div>
        </div>
        <Link
          href="/strike/new"
          className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors"
        >
          + New objective
        </Link>
      </div>

      {/* List */}
      <div className="px-4 py-4 space-y-3">
        {list.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-sm">No active objectives.</div>
            <Link href="/strike/new" className="text-blue-400 text-sm mt-2 inline-block">
              Create your first objective →
            </Link>
          </div>
        ) : (
          list.map(obj => (
            <Link
              key={obj.id}
              href={`/strike/${obj.id}`}
              className="block bg-slate-800 rounded-xl px-4 py-4 hover:bg-slate-750 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white font-medium">
                    {obj.taxonomy_key?.replace(/\./g, ' · ')}
                  </div>
                  {obj.geo?.unit && (
                    <div className="text-slate-400 text-sm mt-0.5">
                      Unit {obj.geo.unit}{obj.geo.state ? `, ${obj.geo.state}` : ''}
                    </div>
                  )}
                  <div className="text-slate-500 text-xs mt-1">{formatDates(obj.timing)}</div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${
                    BUILD_STATUS_BADGE[obj.agent_build_status] ?? BUILD_STATUS_BADGE.queued
                  }`}
                >
                  {obj.agent_build_status ?? 'queued'}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
