'use client'

import { useState } from 'react'
import { Calendar, CheckCircle, AlertCircle, Clock, RefreshCw, Trash2, Plus, ExternalLink } from 'lucide-react'
import type { CalendarConnection } from '@/lib/utils/types'
import { tierAtLeast } from '@/lib/tiers'

interface Props {
  initialConnections: CalendarConnection[]
  tier: string
  accountType: string
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const INSTRUCTIONS = [
  {
    provider: 'Google Calendar',
    color: '#4285F4',
    steps: [
      'Open Google Calendar → Settings (gear icon)',
      'Click your calendar name in the left sidebar',
      'Scroll to "Integrate calendar"',
      'Copy the "Secret address in iCal format" URL',
    ],
  },
  {
    provider: 'Outlook / Office 365',
    color: '#0078D4',
    steps: [
      'Go to outlook.com → Settings → View all Outlook settings',
      'Calendar → Shared calendars',
      'Under "Publish a calendar", select your calendar and "Can view all details"',
      'Click Publish and copy the ICS link',
    ],
  },
  {
    provider: 'Apple Calendar (iCloud)',
    color: '#1C1C1E',
    steps: [
      'Open iCloud.com → Calendar',
      'Click the share icon next to your calendar',
      'Enable "Public Calendar" and copy the URL',
      'Change "webcal://" to "https://" in the URL (or Meridian will do it for you)',
    ],
  },
]

export default function CalendarIntegrations({ initialConnections, tier, accountType }: Props) {
  const [connections, setConnections] = useState<CalendarConnection[]>(initialConnections)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})
  const [showInstructions, setShowInstructions] = useState(false)

  const canConnect = tierAtLeast({ tier, account_type: accountType }, 'explorer')

  async function handleAdd() {
    if (!newUrl.trim()) return
    setAdding(true)
    setAddError(null)

    const res = await fetch('/api/calendar/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ical_url: newUrl.trim(), label: newLabel.trim() || null }),
    })
    const data = await res.json() as { connection?: CalendarConnection; error?: string }

    if (!res.ok || !data.connection) {
      setAddError(data.error ?? 'Could not connect calendar. Check the URL and try again.')
    } else {
      setConnections(prev => [...prev, data.connection!])
      setNewUrl('')
      setNewLabel('')
      setShowAddForm(false)
    }
    setAdding(false)
  }

  async function handleSync(id: string) {
    setSyncing(prev => ({ ...prev, [id]: true }))
    const res = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection_id: id }),
    })
    const data = await res.json() as { sync_status?: string; last_error?: string; event_count?: number; message?: string }

    setConnections(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, sync_status: (data.sync_status ?? c.sync_status) as CalendarConnection['sync_status'], last_error: data.last_error ?? null, event_count: data.event_count ?? c.event_count, last_synced_at: new Date().toISOString() }
          : c
      )
    )
    setSyncing(prev => ({ ...prev, [id]: false }))
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this calendar? Meridian will stop using it in sweeps.')) return
    await fetch(`/api/calendar/connections?id=${id}`, { method: 'DELETE' })
    setConnections(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--blue)]" />
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider">Calendars</h2>
        </div>
        {canConnect && connections.length > 0 && (
          <button
            onClick={() => { setShowAddForm(v => !v); setAddError(null) }}
            className="flex items-center gap-1 text-[12px] text-[var(--blue)] hover:underline"
          >
            <Plus size={12} /> Add calendar
          </button>
        )}
      </div>

      <p className="text-[13px] text-[var(--text2)] mb-4 leading-relaxed">
        Connect your calendar so Meridian Arc can factor upcoming events into sweeps — surfacing time-sensitive actions and flagging conflicts with your objectives.
      </p>

      {/* Tier gate */}
      {!canConnect && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--gray-lt)] p-4 mb-4">
          <p className="text-[12px] text-[var(--text2)]">
            <span className="font-semibold text-[var(--text)]">Explorer plan or above</span> required to connect a calendar.{' '}
            <a href="/onboarding/plan" className="text-[var(--blue)] hover:underline">Upgrade your plan →</a>
          </p>
        </div>
      )}

      {/* Connected calendars list */}
      {connections.length > 0 && (
        <div className="space-y-3 mb-4">
          {connections.map(conn => (
            <div key={conn.id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-[var(--text)] truncate">
                      {conn.label || 'Calendar'}
                    </span>
                    {/* Status badge */}
                    {conn.sync_status === 'ok' && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-[#16a34a] bg-[#dcfce7] px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <CheckCircle size={9} /> Synced
                      </span>
                    )}
                    {conn.sync_status === 'pending' && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-[#92400e] bg-[#fef3c7] px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <Clock size={9} /> Pending
                      </span>
                    )}
                    {conn.sync_status === 'error' && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-[#b91c1c] bg-[#fee2e2] px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <AlertCircle size={9} /> Error
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[var(--text3)]">
                    {conn.event_count} event{conn.event_count !== 1 ? 's' : ''}
                    {conn.last_synced_at ? ` · synced ${timeAgo(conn.last_synced_at)}` : ' · not yet synced'}
                  </p>

                  {conn.sync_status === 'error' && conn.last_error && (
                    <p className="text-[11px] text-[var(--red)] mt-1">{conn.last_error}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncing[conn.id]}
                    title="Sync now"
                    className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--blue)] hover:bg-[var(--gray-lt)] transition-colors disabled:opacity-40"
                  >
                    <RefreshCw size={13} className={syncing[conn.id] ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => handleRemove(conn.id)}
                    title="Remove"
                    className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--red)] hover:bg-[var(--red-lt)] transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form — shown if no connections yet or user clicked Add */}
      {canConnect && (connections.length === 0 || showAddForm) && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--gray-lt)] p-4 mb-4">
          <p className="text-[12px] font-semibold text-[var(--text)] mb-3">Add calendar</p>

          <div className="space-y-2.5 mb-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-1">Label (optional)</label>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Work calendar"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-1">iCal URL</label>
              <input
                value={newUrl}
                onChange={e => { setNewUrl(e.target.value); setAddError(null) }}
                placeholder="https://calendar.google.com/calendar/ical/…"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[12px] text-[var(--text)] font-mono focus:outline-none focus:border-[var(--blue)] bg-white transition-colors"
              />
              <p className="text-[10px] text-[var(--text3)] mt-1">
                The URL is stored securely and used read-only — Meridian cannot modify your calendar.
              </p>
            </div>
          </div>

          {addError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[11px] mb-3">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              {addError}
            </div>
          )}

          <div className="flex gap-2">
            {connections.length > 0 && (
              <button
                onClick={() => { setShowAddForm(false); setAddError(null) }}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-[12px] text-[var(--text2)] hover:bg-white transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleAdd}
              disabled={adding || !newUrl.trim()}
              className="flex-1 py-2 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors"
            >
              {adding ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* How to get the URL */}
      <button
        onClick={() => setShowInstructions(v => !v)}
        className="text-[11px] text-[var(--blue)] hover:underline flex items-center gap-1"
      >
        {showInstructions ? '▲' : '▼'} How to get your iCal URL
      </button>

      {showInstructions && (
        <div className="mt-3 space-y-3">
          {INSTRUCTIONS.map(inst => (
            <div key={inst.provider} className="border border-[var(--border)] rounded-xl p-4">
              <p className="text-[12px] font-semibold mb-2" style={{ color: inst.color }}>{inst.provider}</p>
              <ol className="space-y-1">
                {inst.steps.map((step, i) => (
                  <li key={i} className="text-[11.5px] text-[var(--text2)] flex gap-2">
                    <span className="text-[var(--text3)] font-mono flex-shrink-0">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p className="text-[11px] text-[var(--text3)] flex items-center gap-1">
            <ExternalLink size={10} />
            The URL is read-only — Meridian Arc cannot modify your calendar.
          </p>
        </div>
      )}
    </div>
  )
}
