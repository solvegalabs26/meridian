import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TIER_BADGE: Record<string, string> = {
  trial:       'bg-gray-100 text-gray-600',
  explorer:    'bg-blue-100 text-blue-700',
  accelerator: 'bg-amber-100 text-amber-700',
  command:     'bg-purple-100 text-purple-700',
}

const ACTYPE_BADGE: Record<string, string> = {
  alpha_personal: 'bg-emerald-100 text-emerald-700',
  alpha_business: 'bg-emerald-100 text-emerald-700',
  beta:           'bg-teal-100 text-teal-700',
}

export default async function AdminUsersPage() {
  const service = createServiceClient()

  const [{ data: profiles }, { data: usersData }] = await Promise.all([
    service
      .from('profiles')
      .select('id, full_name, account_type, tier, sweep_count, sweep_credits, is_beta, created_at, trial_ends_at')
      .order('created_at', { ascending: false }),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailById = new Map(usersData?.users.map(u => [u.id, u.email ?? '']) ?? [])

  const users = (profiles ?? []).map(p => ({
    id: p.id as string,
    email: emailById.get(p.id as string) ?? '(no email)',
    fullName: (p.full_name as string | null),
    accountType: (p.account_type as string) ?? 'personal',
    tier: (p.tier as string) ?? 'trial',
    sweepCount: (p.sweep_count as number) ?? 0,
    sweepCredits: (p.sweep_credits as number) ?? 0,
    isBeta: p.is_beta as boolean,
    createdAt: p.created_at as string,
  }))

  const tierLabels: Record<string, string> = {
    trial: 'Trial', explorer: 'Explorer', accelerator: 'Accelerator', command: 'Command',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-medium text-[var(--text)]">Users</h1>
        <span className="text-[13px] text-[var(--text3)]">{users.length} total</span>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--gray-lt)]">
              <th className="text-left px-4 py-3 font-semibold text-[var(--text2)] text-[11px] uppercase tracking-wide">User</th>
              <th className="text-left px-4 py-3 font-semibold text-[var(--text2)] text-[11px] uppercase tracking-wide">Account type</th>
              <th className="text-left px-4 py-3 font-semibold text-[var(--text2)] text-[11px] uppercase tracking-wide">Tier</th>
              <th className="text-right px-4 py-3 font-semibold text-[var(--text2)] text-[11px] uppercase tracking-wide">Sweeps</th>
              <th className="text-right px-4 py-3 font-semibold text-[var(--text2)] text-[11px] uppercase tracking-wide">Credits</th>
              <th className="text-left px-4 py-3 font-semibold text-[var(--text2)] text-[11px] uppercase tracking-wide">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isAlphaBeta = ['alpha_personal', 'alpha_business', 'beta'].includes(u.accountType)
              return (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--gray-lt)] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="hover:underline">
                      <p className="font-medium text-[var(--text)]">{u.fullName ?? '—'}</p>
                      <p className="text-[11px] text-[var(--text3)]">{u.email}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {isAlphaBeta ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ACTYPE_BADGE[u.accountType] ?? ''}`}>
                        {u.accountType}
                      </span>
                    ) : (
                      <span className="text-[var(--text3)]">{u.accountType}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TIER_BADGE[u.tier] ?? TIER_BADGE.trial}`}>
                      {tierLabels[u.tier] ?? u.tier}
                    </span>
                    {u.isBeta && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-teal-100 text-teal-700">β</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text2)]">{u.sweepCount}</td>
                  <td className="px-4 py-3 text-right text-[var(--text2)]">{u.sweepCredits}</td>
                  <td className="px-4 py-3 text-[var(--text3)]">
                    {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--text3)]">No users yet.</div>
        )}
      </div>
    </div>
  )
}
