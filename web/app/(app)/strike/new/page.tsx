'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TAXONOMY_OPTIONS = [
  { value: 'elk.bull.archery', label: 'Elk · Bull · Archery' },
  { value: 'elk.bull.rifle', label: 'Elk · Bull · Rifle' },
  { value: 'elk.cow.archery', label: 'Elk · Cow · Archery' },
  { value: 'deer.whitetail.archery', label: 'Deer · Whitetail · Archery' },
  { value: 'deer.whitetail.rifle', label: 'Deer · Whitetail · Rifle' },
  { value: 'deer.mule.archery', label: 'Deer · Mule Deer · Archery' },
  { value: 'turkey.eastern.archery', label: 'Turkey · Eastern · Archery' },
  { value: 'fishing.trout.flyfish', label: 'Fishing · Trout · Fly Fishing' },
]

export default function StrikeNewPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    taxonomy_key: 'elk.bull.archery',
    state: '',
    unit: '',
    lat: '',
    lon: '',
    trip_start: '',
    trip_end: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const geo: Record<string, unknown> = {}
      if (form.state) geo.state = form.state
      if (form.unit) geo.unit = form.unit
      if (form.lat) geo.lat = parseFloat(form.lat)
      if (form.lon) geo.lon = parseFloat(form.lon)

      const timing: Record<string, unknown> = {}
      if (form.trip_start) timing.trip_start = form.trip_start
      if (form.trip_end) timing.trip_end = form.trip_end

      const res = await fetch('/api/objectives/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: form.taxonomy_key.split('.')[0],
          taxonomy_key: form.taxonomy_key,
          geo,
          timing,
          priority_stack: [],
          org_source: 'strike',
          user_id: user.id,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const { objective_id } = await res.json() as { objective_id: string }
      router.push(`/strike/${objective_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700">
        <button
          onClick={() => router.push('/strike')}
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Back
        </button>
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Strike</div>
          <div className="text-lg font-semibold">New Objective</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5 max-w-lg">
        {/* Species */}
        <div>
          <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
            Species / Method
          </label>
          <select
            value={form.taxonomy_key}
            onChange={e => set('taxonomy_key', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {TAXONOMY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
            Location
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="State (e.g. UT)"
              value={form.state}
              onChange={e => set('state', e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
            />
            <input
              type="text"
              placeholder="Unit (e.g. HD316)"
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              type="text"
              placeholder="Latitude"
              value={form.lat}
              onChange={e => set('lat', e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
            />
            <input
              type="text"
              placeholder="Longitude"
              value={form.lon}
              onChange={e => set('lon', e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
            />
          </div>
        </div>

        {/* Dates */}
        <div>
          <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
            Hunt Window
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-500 mb-1">Start</div>
              <input
                type="date"
                value={form.trip_start}
                onChange={e => set('trip_start', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm [color-scheme:dark]"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">End</div>
              <input
                type="date"
                value={form.trip_end}
                onChange={e => set('trip_end', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-xl transition-colors text-sm"
        >
          {submitting ? 'Creating objective…' : 'Create Objective'}
        </button>
      </form>
    </div>
  )
}
