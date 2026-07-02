'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'
import { Check, Pencil, X } from 'lucide-react'
import { getCategoriesForAccount, CATEGORY_COLORS } from '@/lib/utils/categories'
import { createClient } from '@/lib/supabase/client'

interface ExtractedGoal {
  title: string
  category: string
  outcome: string
  target_date: string | null
}

export default function OnboardingObjectivePage() {
  const router = useRouter()
  const supabase = createClient()

  // Step A — free text input
  const [bio, setBio] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Load account_type on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('profiles').select('account_type').eq('id', user.id).single()
        .then(({ data }) => setAccountType(data?.account_type ?? 'personal'))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const CATEGORIES = getCategoriesForAccount(accountType)

  // Step B — review extracted goals
  const [goals, setGoals] = useState<ExtractedGoal[] | null>(null)
  const [selected, setSelected] = useState<boolean[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  // Supabase row id for each goal once it's been persisted, or null if not yet saved
  const [savedIds, setSavedIds] = useState<(string | null)[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)

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
    setSavedIds(data.goals.map(() => null))
    setExtracting(false)

    // All goals start selected — persist each immediately rather than
    // waiting for the final button, so nothing is lost if the user leaves.
    // Sequential (not parallel) — /api/objectives derives obj_id from a
    // row count, so concurrent creates would race and collide.
    for (let i = 0; i < data.goals.length; i++) {
      await createGoal(i, data.goals[i])
    }
  }

  function updateGoal(i: number, updates: Partial<ExtractedGoal>) {
    setGoals(prev => prev ? prev.map((g, idx) => idx === i ? { ...g, ...updates } : g) : prev)
  }

  // Create a new objective row and record its id against this goal's index.
  async function createGoal(i: number, goal: ExtractedGoal) {
    const res = await fetch('/api/objectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: goal.title,
        category: goal.category,
        outcome: goal.outcome,
        target_date: goal.target_date || undefined,
        // The shared freeform bio this goal was extracted from — the
        // closest thing to "what the user originally typed" for a goal
        // that came out of a multi-goal extraction rather than its own form.
        goal_description: bio,
      }),
    })

    if (!res.ok) {
      setSyncError('Could not save an objective — please try re-checking it.')
      return
    }

    const data = await res.json() as { objective: { id: string } }
    setSavedIds(prev => prev.map((id, idx) => idx === i ? data.objective.id : id))
  }

  // Update an already-persisted objective row in place.
  async function updateSavedGoal(id: string, goal: ExtractedGoal) {
    if (!userId) return
    const { error } = await supabase
      .from('objectives')
      .update({
        title: goal.title,
        category: goal.category,
        outcome: goal.outcome,
        target_date: goal.target_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) setSyncError('Could not save your edit — please try again.')
  }

  // Remove a persisted objective row (unchecked, deleted, or abandoned).
  async function deleteSavedGoal(id: string) {
    if (!userId) return
    const { error } = await supabase
      .from('objectives')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) setSyncError('Could not remove that objective — please try again.')
  }

  function toggleSelected(i: number) {
    const goal = goals?.[i]
    if (!goal) return
    const nowSelected = !selected[i]
    setSelected(prev => prev.map((s, idx) => idx === i ? nowSelected : s))

    if (nowSelected) {
      void createGoal(i, goal)
    } else {
      const id = savedIds[i]
      if (id) {
        void deleteSavedGoal(id)
        setSavedIds(prev => prev.map((sid, idx) => idx === i ? null : sid))
      }
    }
  }

  function finishEditing(i: number) {
    setEditing(null)
    const goal = goals?.[i]
    const id = savedIds[i]
    if (goal && selected[i] && id) {
      void updateSavedGoal(id, goal)
    }
  }

  function removeGoal(i: number) {
    const id = savedIds[i]
    if (id) void deleteSavedGoal(id)
    setGoals(prev => prev ? prev.filter((_, idx) => idx !== i) : prev)
    setSelected(prev => prev.filter((_, idx) => idx !== i))
    setSavedIds(prev => prev.filter((_, idx) => idx !== i))
  }

  function startOver() {
    // Clean up anything already persisted from this extraction pass
    savedIds.forEach(id => { if (id) void deleteSavedGoal(id) })
    setGoals(null)
    setBio('')
    setSelected([])
    setSavedIds([])
  }

  // ── Step A — Tell us about yourself ──────────────────────────
  if (!goals) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <MeridianBeacon size={40} variant="gold" animate={false} />
            <p className="text-[11px] text-white/30 mt-3 tracking-widest uppercase">Step 4 of 5</p>
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
          <p className="text-[11px] text-white/30 mt-3 tracking-widest uppercase">Step 4 of 5</p>
          <h1 className="text-[24px] font-light text-white mt-1">Here are your objectives</h1>
          <p className="text-[13px] text-white/40 mt-1">
            Select the ones you want to track. You can edit any of them.
          </p>
        </div>

        {syncError && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{syncError}</div>
        )}

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
                      onClick={() => finishEditing(i)}
                      className="text-[12px] font-medium text-[var(--blue)] hover:text-[var(--night)]"
                    >
                      Done editing
                    </button>
                  </div>
                ) : (
                  <div className="p-4 flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelected(i)}
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
                        onClick={() => removeGoal(i)}
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
            onClick={() => router.push('/onboarding/sweep')}
            disabled={selectedCount === 0}
            className="w-full py-3 rounded-xl bg-gold text-navy text-[14px] font-semibold hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {`Add ${selectedCount} objective${selectedCount !== 1 ? 's' : ''} and run first sweep →`}
          </button>
          <button
            onClick={startOver}
            className="w-full py-2 text-[12px] text-white/30 hover:text-white/60 transition-colors"
          >
            ← Start over
          </button>
        </div>
      </div>
    </div>
  )
}
