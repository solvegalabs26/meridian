'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

const CATEGORIES = ['Career/Aviation','Finance','Health','Business','Travel','Home','Lifestyle']

export default function OnboardingObjectivePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Career/Aviation')
  const [outcome, setOutcome] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!title.trim() || !outcome.trim()) return
    setSaving(true)

    const res = await fetch('/api/objectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, outcome, target_date: targetDate || undefined }),
    })

    if (res.ok) {
      // Mark as onboarded
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarded_at: new Date().toISOString() }),
      })
      router.push('/onboarding/sweep')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <MeridianBeacon size={40} variant="gold" animate={false} />
          <p className="text-[11px] text-white/30 mt-3 tracking-widest uppercase">Step 3 of 4</p>
          <h1 className="text-[24px] font-light text-white mt-1">Add your first objective</h1>
          <p className="text-[13px] text-white/40 mt-1">What&apos;s the most important thing you&apos;re working toward?</p>
        </div>

        <div className="bg-white rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Alaska Airlines First Officer Hire"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] focus:outline-none focus:border-[var(--blue)]" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] bg-white focus:outline-none focus:border-[var(--blue)]">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
              Outcome — &ldquo;I will have...&rdquo;
            </label>
            <textarea rows={3} value={outcome} onChange={e => setOutcome(e.target.value)}
              placeholder="I will have received and accepted a Conditional Job Offer..."
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] resize-none focus:outline-none focus:border-[var(--blue)]" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Target date</label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] bg-white focus:outline-none focus:border-[var(--blue)]" />
          </div>

          <button onClick={handleCreate} disabled={saving || !title.trim() || !outcome.trim()}
            className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors">
            {saving ? 'Creating...' : 'Create objective →'}
          </button>
        </div>
      </div>
    </div>
  )
}
