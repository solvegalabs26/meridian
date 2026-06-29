'use client'

import { useState, useEffect } from 'react'
import { Calendar, CheckCircle, XCircle, ExternalLink, Trash2 } from 'lucide-react'

interface CalEvent {
  title: string
  start: string
  daysUntil: number
  location: string | null
}

interface Props {
  initialUrl: string | null
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
      'Change "webcal://" to "https://" in the URL',
    ],
  },
]

export default function CalendarConnect({ initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [status, setStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>( initialUrl ? 'connected' : 'idle')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load preview events on mount if already connected
  useEffect(() => {
    if (initialUrl) {
      fetch('/api/calendar')
        .then(r => r.json())
        .then((d: { events?: CalEvent[] }) => { if (d.events) setEvents(d.events.slice(0, 5)) })
        .catch(() => {})
    }
  }, [initialUrl])

  async function handleConnect() {
    if (!url.trim()) return
    setSaving(true)
    setStatus('testing')
    setMessage(null)

    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    })
    const data = await res.json() as { ok?: boolean; events?: CalEvent[]; error?: string; warning?: string }

    if (!res.ok || data.error) {
      setStatus('error')
      setMessage(data.error ?? 'Could not connect to calendar. Check the URL and try again.')
    } else {
      setStatus('connected')
      setEvents((data.events ?? []).slice(0, 5))
      setMessage(data.warning ?? null)
    }
    setSaving(false)
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect your calendar? Meridian Arc will no longer include calendar events in sweeps.')) return
    setSaving(true)
    await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: '' }),
    })
    setUrl('')
    setStatus('idle')
    setEvents([])
    setMessage(null)
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--blue)]" />
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider">Calendar integration</h2>
        </div>
        {status === 'connected' && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--green)]">
            <CheckCircle size={12} /> Connected
          </span>
        )}
      </div>

      <p className="text-[13px] text-[var(--text2)] mb-4 leading-relaxed">
        Connect your calendar so Meridian Arc can factor upcoming events into your sweep — surfacing time-sensitive actions and flagging conflicts with your objectives.
      </p>

      {/* URL input */}
      <div className="flex gap-2 mb-3">
        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setStatus('idle') }}
          placeholder="Paste your iCal URL here (https://...)"
          className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors font-mono text-[11px]"
        />
        <button
          onClick={handleConnect}
          disabled={saving || !url.trim()}
          className="px-4 py-2.5 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {saving ? 'Testing...' : status === 'connected' ? 'Update' : 'Connect'}
        </button>
      </div>

      {/* Status messages */}
      {status === 'error' && message && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[12px] mb-3">
          <XCircle size={14} className="flex-shrink-0 mt-0.5" />
          {message}
        </div>
      )}
      {status === 'connected' && message && (
        <div className="p-3 rounded-lg bg-[var(--amber-lt)] text-[var(--amber-brand)] text-[12px] mb-3">{message}</div>
      )}

      {/* Upcoming events preview */}
      {status === 'connected' && events.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2">
            Next {events.length} upcoming events (preview)
          </p>
          <div className="space-y-1.5">
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[12px]">
                <span className="text-[10px] font-mono bg-[var(--gray-lt)] text-[var(--text3)] px-1.5 py-0.5 rounded w-10 text-center flex-shrink-0">
                  {e.daysUntil}d
                </span>
                <span className="text-[var(--text2)] truncate">{e.title}</span>
                {e.location && <span className="text-[var(--text3)] text-[10px] truncate hidden sm:block">@ {e.location}</span>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--text3)] mt-2">These events will be included in your next sweep.</p>
        </div>
      )}

      {/* Disconnect */}
      {status === 'connected' && (
        <button
          onClick={handleDisconnect}
          disabled={saving}
          className="flex items-center gap-1.5 text-[11px] text-[var(--text3)] hover:text-[var(--red)] transition-colors"
        >
          <Trash2 size={11} />
          Disconnect calendar
        </button>
      )}

      {/* How to get the URL */}
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="text-[11px] text-[var(--blue)] hover:underline mt-3 block"
      >
        {showInstructions ? '▲ Hide instructions' : '▼ How to get your iCal URL'}
      </button>

      {showInstructions && (
        <div className="mt-3 space-y-4">
          {INSTRUCTIONS.map(inst => (
            <div key={inst.provider} className="border border-[var(--border)] rounded-xl p-4">
              <p className="text-[12px] font-semibold mb-2" style={{ color: inst.color }}>{inst.provider}</p>
              <ol className="space-y-1">
                {inst.steps.map((step, i) => (
                  <li key={i} className="text-[11.5px] text-[var(--text2)] flex gap-2">
                    <span className="text-[var(--text3)] flex-shrink-0 font-mono">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p className="text-[11px] text-[var(--text3)] flex items-center gap-1">
            <ExternalLink size={10} />
            The URL is read-only — Meridian cannot modify your calendar.
          </p>
        </div>
      )}
    </div>
  )
}
