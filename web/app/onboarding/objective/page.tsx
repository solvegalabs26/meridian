'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'
import { Check, Pencil, X } from 'lucide-react'

interface ExtractedGoal {
  title: string
  category: string
  outcome: string
  target_date: string | null
}

const CATEGORIES = ['Career/Aviation','Finance','Health','Business','Travel','Home','Lifestyle']

const CATEGORY_COLORS: Record<string, string> = {
  'Career/Aviation': '#2E7CB8',
  'Finance':         '#0F6E56',
  'Health':          '#C9A227',
  'Business':        '#534AB7',
  'Travel':          '#BA7517',
  'Home':            '#5090C0',
  'Lifestyle':       '#8098B4',
}

export default function OnboardingObjectivePage() {
  const router = useRouter()

  // Step A — free text input
  const [bio, setBio] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  // Step B — review extracted goals
  const [goals, setGoals] = useState<ExtractedGoal[] | null>(null)
  const [selected, setSelected] = useState<boolean[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleExtract() {
    if (!bio.trim()) return
    setExtracting(true)
    setExtractError(null)

    const res = await fetch('/api/extract-goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: bio }),
    })

    if (!res.ok) {
      setExtractError('Could not extract goals — please try rephrasing or add objectives manually.')
      setExtracting(false)
      return
    }

    const data = await res.json() as { goals: ExtractedGoal[] }
    setGoals(data.goals)
    setSelected(data.goals.map(() => true))
    setExtracting(false)
  }

  function updateGoal(i: number, updates: Partial<ExtractedGoal>) {
    setGoals(prev => prev ? prev.map((g, idx) => idx === i ? { ...g, ...updates } : g) : prev)
  }

  async function handleConfirm() {
    if (!goals) return
    const toSave = goals.filter((_, i) => selected[i])
    if (toSave.length === 0) return

    setSaving(true)

    for (const goal of toSave.slice(0, 5)) { // max 5 on trial tier
      await fetch('/api/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goal.title,
          category: goal.category,
          outcome: goal.outcome,
          target_date: goal.target_date || undefined,
        }),
      })
    }

    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarded_at: new Date().toISOString() }),
    })

    router.push('/onboarding/sweep')
  }

  // ── Step A — Tell us about yourself ──────────────────────────
  if (!goals) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <MeridianBeacon size={40} variant="gold" animate={false} />
            <p className="text-[11px] text-white/30 mt-3 tracking-widest uppercase">Step 3 of 4</p>
            <h1 className="text-[24px] font-light text-white mt-1">Tell us about yourself</h1>
            <p className="text-[13px] text-white/40 mt-1 max-w-sm mx-auto">
              Share your life, goals, and what you&apos;re working toward. Meridian will extract your objectives automatically.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 space-y-4">
            {extractError && (
              <div className="p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{extractError}</div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
                About you and your goals
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={7}
                placeholder={`e.g. "Mother of 3 children ages 3–8, enjoy reading, fitness, and traveling. Goals: run a marathon within two years, travel to Europe within 4 years, build a four-month emergency savings account, help my kids read 5 books this summer, help my family eat healthier, read a book with my husband in the next six months."`}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] resize-none leading-relaxed"
              />
              <p className="text-[11px] text-[var(--text3)] mt-1.5">
                Be as detailed or brief as you like. Meridian will identify up to 5 objectives from your description.
              </p>
            </div>

            <button
              onClick={handleExtract}
              disabled={extracting || !bio.trim()}
              className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {extracting ? (
                <>
                  <MeridianBeacon size={16} variant="gold" animate={true} />
                  Extracting your objectives...
                </>
              ) : (
                'Extract my objectives →'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step B — Review extracted goals ──────────────────────────
  const selectedCount = selected.filter(Boolean).length

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <MeridianBeacon size={40} variant="gold" animate={false} />
          <p className="text-[11px] text-white/30 mt-3 tracking-widest uppercase">Step 3 of 4</p>
          <h1 className="text-[24px] font-light text-white mt-1">Here are your objectives</h1>
          <p className="text-[13px] text-white/40 mt-1">
            Select the ones you want to track. You can edit any of them.
          </p>
        </div>

        <div className="space-y-3 mb-5">
          {goals.map((goal, i) => {
            const catColor = CATEGORY_COLORS[goal.category] ?? '#8098B4'
            const isSelected = selected[i]
            const isEditing = editing === i

            return (
              <div
                key={i}
                className={`bg-white rounded-xl border-2 transition-all ${
                  isSelected ? 'border-[var(--blue)]' : 'border-transparent opacity-60'
                }`}
              >
                {isEditing ? (
                  <div className="p-4 space-y-3">
                    <input
                      value={goal.title}
                      onChange={e => updateGoal(i, { title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] font-medium focus:outline-none focus:border-[var(--blue)]"
                    />
                    <select
                      value={goal.category}
                      onChange={e => updateGoal(i, { category: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[12px] bg-white focus:outline-none"
                    >
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <textarea
                      value={goal.outcome}
                      onChange={e => updateGoal(i, { outcome: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[12px] resize-none focus:outline-none focus:border-[var(--blue)]"
                    />
                    <input
                      type="date"
                      value={goal.target_date ?? ''}
                      onChange={e => updateGoal(i, { target_date: e.target.value || null })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[12px] bg-white focus:outline-none"
                    />
                    <button
                      onClick={() => setEditing(null)}
                      className="text-[12px] font-medium text-[var(--blue)] hover:text-[var(--night)]"
                    >
                      Done editing
                    </button>
                  </div>
                ) : (
                  <div className="p-4 flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => setSelected(prev => prev.map((s, idx) => idx === i ? !s : s))}
                      className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all ${
                        isSelected ? 'bg-[var(--blue)] border-[var(--blue)]' : 'border-[var(--border)]'
                      }`}
                    >
                      {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: catColor, backgroundColor: `${catColor}18` }}
                        >
                          {goal.category}
                        </span>
                        {goal.target_date && (
                          <span className="text-[10px] text-[var(--text3)]">
                            By {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-medium text-[var(--text)] leading-snug">{goal.title}</p>
                      <p className="text-[11.5px] text-[var(--text3)] mt-0.5 leading-relaxed">{goal.outcome}</p>
                    </div>

                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => setEditing(i)}
                        className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--blue)] hover:bg-[#E6F1FB] transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => {
                          setGoals(prev => prev ? prev.filter((_, idx) => idx !== i) : prev)
                          setSelected(prev => prev.filter((_, idx) => idx !== i))
                        }}
                        className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--red)] hover:bg-[var(--red-lt)] transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-2">
          <button
            onClick={handleConfirm}
            disabled={saving || selectedCount === 0}
            className="w-full py-3 rounded-xl bg-gold text-navy text-[14px] font-semibold hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {saving
              ? 'Saving objectives...'
              : `Add ${selectedCount} objective${selectedCount !== 1 ? 's' : ''} and run first sweep →`}
          </button>
          <button
            onClick={() => { setGoals(null); setBio('') }}
            className="w-full py-2 text-[12px] text-white/30 hover:text-white/60 transition-colors"
          >
            ← Start over
          </button>
        </div>
      </div>
    </div>
  )
}
