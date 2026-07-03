'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const TIER_BADGE: Record<string, string> = {
  trial:       'bg-gray-100 text-gray-600',
  explorer:    'bg-blue-100 text-blue-700',
  accelerator: 'bg-amber-100 text-amber-700',
  command:     'bg-purple-100 text-purple-700',
}

const TIER_LABELS: Record<string, string> = {
  trial: 'Trial', explorer: 'Explorer', accelerator: 'Accelerator', command: 'Command',
}

const VALID_TIERS = ['trial', 'explorer', 'accelerator', 'command'] as const

interface Objective {
  id: string
  obj_id: string
  title: string
  category: string
  status: string
  confidence: number
}

interface Sweep {
  id: string
  status: string
  trigger_type: string
  objectives_swept: number | null
  cost_usd: number | null
  created_at: string
}

interface ConfidencePoint {
  date: string
  [objectiveTitle: string]: number | string
}

interface ActionLog {
  id: string
  action: string
  payload: Record<string, unknown>
  note: string | null
  created_at: string
}

interface Props {
  userId: string
  email: string
  profile: {
    full_name: string | null
    account_type: string
    tier: string
    sweep_count: number
    sweep_credits: number
    is_beta: boolean
    trial_ends_at: string | null
    created_at: string
    onboarded_at: string | null
  }
  objectives: Objective[]
  sweeps: Sweep[]
  confidenceHistory: ConfidencePoint[]
  objectiveTitles: string[]
  actionLog: ActionLog[]
}

export default function UserDetailClient({
  userId, email, profile, objectives, sweeps, confidenceHistory, objectiveTitles, actionLog,
}: Props) {
  const router = useRouter()
  const [creditAmount, setCreditAmount] = useState('')
  const [tierSelect, setTierSelect] = useState(profile.tier)
  const [betaFlag, setBetaFlag] = useState(profile.is_beta)
  const [actionNote, setActionNote] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  async function runAction(action: string, value: unknown) {
    setSaving(action)
    setActionError(null)
    setActionSuccess(null)
    const res = await fetch(`/api/admin/users/${userId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value, note: actionNote || null }),
    })
    if (res.ok) {
      setActionSuccess(action)
      setActionNote('')
      setTimeout(() => { setActionSuccess(null); router.refresh() }, 1500)
    } else {
      const d = await res.json() as { error?: string }
      setActionError(d.error ?? 'Action failed')
    }
    setSaving(null)
  }

  const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

  return (
    <div>
      {/* Back nav */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/users" className="text-[var(--text3)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <span className="text-[13px] text-[var(--text3)]">Users</span>
        <span className="text-[var(--text3)]">/</span>
        <span className="text-[13px] text-[var(--text)]">{profile.full_name ?? email}</span>
      </div>

      <div className="space-y-4">

        {/* Profile */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Profile</h2>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            {[
              ['Name', profile.full_name ?? '—'],
              ['Email', email],
              ['User ID', userId],
              ['Account type', profile.account_type],
              ['Member since', new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
              ['Onboarded', profile.onboarded_at ? new Date(profile.onboarded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'],
            ].map(([label, val]) => (
              <div key={label} className="flex flex-col">
                <span className="text-[11px] text-[var(--text3)] uppercase tracking-wide mb-0.5">{label}</span>
                <span className="text-[var(--text2)] break-all">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Plan &amp; Credits</h2>
          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <div>
              <span className="text-[11px] text-[var(--text3)] uppercase tracking-wide block mb-1">Tier</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${TIER_BADGE[profile.tier] ?? TIER_BADGE.trial}`}>
                {TIER_LABELS[profile.tier] ?? profile.tier}
              </span>
              {profile.is_beta && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-teal-100 text-teal-700">β</span>
              )}
            </div>
            <div>
              <span className="text-[11px] text-[var(--text3)] uppercase tracking-wide block mb-1">Sweep credits</span>
              <span className="text-[var(--text)] font-medium">{profile.sweep_credits}</span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--text3)] uppercase tracking-wide block mb-1">Sweeps run</span>
              <span className="text-[var(--text2)]">{profile.sweep_count}</span>
            </div>
            {profile.trial_ends_at && (
              <div>
                <span className="text-[11px] text-[var(--text3)] uppercase tracking-wide block mb-1">Trial ends</span>
                <span className="text-[var(--text2)]">
                  {new Date(profile.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Admin actions */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Admin Actions</h2>

          {actionError && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">{actionError}</div>
          )}
          {actionSuccess && (
            <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 text-[12px] text-green-700">
              {actionSuccess === 'add_credits' ? 'Credits added' : actionSuccess === 'change_tier' ? 'Tier updated' : 'Beta flag updated'} ✓
            </div>
          )}

          <div className="space-y-4">
            {/* Add sweep credits */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Add sweep credits</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-24 px-3 py-2 rounded-lg border border-[var(--border)] text-[14px] focus:outline-none focus:border-[var(--blue)]"
                />
                <button
                  onClick={() => runAction('add_credits', Number(creditAmount))}
                  disabled={!creditAmount || Number(creditAmount) <= 0 || saving === 'add_credits'}
                  className="px-4 py-2 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
                >
                  {saving === 'add_credits' ? 'Adding...' : 'Add credits'}
                </button>
              </div>
            </div>

            {/* Change tier */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Change tier</label>
              <div className="flex gap-2">
                <select
                  value={tierSelect}
                  onChange={e => setTierSelect(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] text-[14px] bg-white focus:outline-none focus:border-[var(--blue)]"
                >
                  {VALID_TIERS.map(t => (
                    <option key={t} value={t}>{TIER_LABELS[t]}</option>
                  ))}
                </select>
                <button
                  onClick={() => runAction('change_tier', tierSelect)}
                  disabled={tierSelect === profile.tier || saving === 'change_tier'}
                  className="px-4 py-2 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
                >
                  {saving === 'change_tier' ? 'Saving...' : 'Set tier'}
                </button>
              </div>
            </div>

            {/* Mark beta */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Beta flag</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setBetaFlag(!betaFlag); runAction('mark_beta', !betaFlag) }}
                  disabled={saving === 'mark_beta'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${betaFlag ? 'bg-teal-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${betaFlag ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-[13px] text-[var(--text2)]">{betaFlag ? 'Beta user' : 'Not beta'}</span>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Action note (optional)</label>
              <input
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                placeholder="Reason for this action..."
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--blue)]"
              />
            </div>
          </div>
        </div>

        {/* Objectives */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">
            Objectives ({objectives.length})
          </h2>
          {objectives.length === 0 ? (
            <p className="text-[13px] text-[var(--text3)]">No objectives yet.</p>
          ) : (
            <div className="space-y-2">
              {objectives.map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0 text-[13px]">
                  <div>
                    <span className="font-medium text-[var(--text)]">{o.title}</span>
                    <span className="ml-2 text-[11px] text-[var(--text3)]">{o.obj_id} · {o.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text2)]">{o.confidence}%</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      o.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confidence history chart */}
        {confidenceHistory.length > 0 && (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Confidence history</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={confidenceHistory} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {objectiveTitles.map((title, i) => (
                  <Line
                    key={title}
                    type="monotone"
                    dataKey={title}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent sweeps */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">
            Recent sweeps ({sweeps.length})
          </h2>
          {sweeps.length === 0 ? (
            <p className="text-[13px] text-[var(--text3)]">No sweeps yet.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 font-semibold text-[var(--text3)] uppercase tracking-wide">Date</th>
                  <th className="text-left py-2 font-semibold text-[var(--text3)] uppercase tracking-wide">Trigger</th>
                  <th className="text-right py-2 font-semibold text-[var(--text3)] uppercase tracking-wide">Objectives</th>
                  <th className="text-right py-2 font-semibold text-[var(--text3)] uppercase tracking-wide">Cost</th>
                  <th className="text-left py-2 font-semibold text-[var(--text3)] uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {sweeps.map(s => (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 text-[var(--text3)]">
                      {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2 text-[var(--text2)]">{s.trigger_type}</td>
                    <td className="py-2 text-right text-[var(--text2)]">{s.objectives_swept ?? '—'}</td>
                    <td className="py-2 text-right text-[var(--text3)]">
                      {s.cost_usd != null ? `$${s.cost_usd.toFixed(4)}` : '—'}
                    </td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        s.status === 'complete' ? 'bg-green-100 text-green-700'
                        : s.status === 'failed' ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Admin action log */}
        {actionLog.length > 0 && (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Action log</h2>
            <div className="space-y-2">
              {actionLog.map(entry => (
                <div key={entry.id} className="text-[12px] py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--text)]">{entry.action}</span>
                    <span className="text-[var(--text3)]">
                      {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-[var(--text3)] mt-0.5">
                    {JSON.stringify(entry.payload)}
                    {entry.note && <span className="ml-2 italic">{entry.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
