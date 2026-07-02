'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCategoriesForAccount } from '@/lib/utils/categories'

const schema = z.object({
  title:             z.string().min(3, 'Title must be at least 3 characters'),
  category:          z.string().min(1),
  outcome:           z.string().min(10, 'Describe the outcome in at least 10 characters'),
  success_condition: z.string().optional(),
  target_date:       z.string().optional(),
  notes:             z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewObjectivePage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('account_type').eq('id', user.id).single()
        .then(({ data }) => setAccountType(data?.account_type ?? 'personal'))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const categories = getCategoriesForAccount(accountType)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: categories[0] },
  })

  // AI clarifying questions, assessed once after the form is first submitted.
  const [clarifyQuestions, setClarifyQuestions] = useState<string[] | null>(null)
  const [clarifyAnswers, setClarifyAnswers] = useState<string[]>([])
  const [pendingData, setPendingData] = useState<FormData | null>(null)
  const [assessing, setAssessing] = useState(false)

  async function onSubmit(data: FormData) {
    // First submit — ask the AI whether this objective needs clarification
    // before actually creating it. Skip re-assessing once questions are
    // already showing (Continue/Skip below handles that path).
    if (clarifyQuestions === null) {
      setAssessing(true)
      setError(null)
      const res = await fetch('/api/assess-objective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          category: data.category,
          outcome: data.outcome,
          target_date: data.target_date || null,
        }),
      })
      const { questions } = res.ok ? await res.json() as { questions: string[] } : { questions: [] }
      setAssessing(false)

      if (questions.length > 0) {
        setClarifyQuestions(questions)
        setClarifyAnswers(questions.map(() => ''))
        setPendingData(data)
        return
      }
    }

    await createObjective(data, null)
  }

  async function createObjective(data: FormData, goalContext: string | null) {
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { count } = await supabase
      .from('objectives')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const objNum = String((count ?? 0) + 1).padStart(2, '0')
    const obj_id = `OBJ-${objNum}`

    const { error: insertError } = await supabase.from('objectives').insert({
      user_id: user.id,
      obj_id,
      title:             data.title,
      category:          data.category,
      outcome:           data.outcome,
      success_condition: data.success_condition || null,
      target_date:       data.target_date || null,
      notes:             data.notes || null,
      // No separate freeform-description step on this form — the outcome
      // field is the closest analog to "what the user typed in their own
      // words" for the Goal tab.
      goal_description:  data.outcome,
      goal_context:       goalContext,
      status:            'active',
      confidence:        50,
      sort_order:        (count ?? 0) + 1,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    router.push('/objectives')
    router.refresh()
  }

  function updateClarifyAnswer(qi: number, value: string) {
    setClarifyAnswers(prev => prev.map((a, i) => i === qi ? value : a))
  }

  async function continueWithAnswers() {
    if (!pendingData || !clarifyQuestions) return
    const answered = clarifyQuestions
      .map((q, qi) => ({ q, a: clarifyAnswers[qi]?.trim() }))
      .filter(({ a }) => !!a)
    const goalContext = answered.length > 0
      ? answered.map(({ q, a }) => `Q: ${q}\nA: ${a}`).join('\n\n')
      : null
    await createObjective(pendingData, goalContext)
  }

  async function skipClarify() {
    if (!pendingData) return
    await createObjective(pendingData, null)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/objectives" className="text-[var(--text3)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-[22px] font-medium text-[var(--text)]">New objective</h1>
          <p className="text-[13px] text-[var(--text3)]">Define what you want to achieve</p>
        </div>
      </div>

      {clarifyQuestions ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{error}</div>
          )}
          <div>
            <p className="text-[14px] font-medium text-[var(--text)] mb-1">A couple quick questions</p>
            <p className="text-[13px] text-[var(--text3)]">
              These help sharpen this goal for future scoring and recommendations — all optional.
            </p>
          </div>
          {clarifyQuestions.map((q, qi) => (
            <div key={qi}>
              <label className="block text-[12px] font-semibold text-[var(--text2)] mb-1.5">{q}</label>
              <input
                value={clarifyAnswers[qi] ?? ''}
                onChange={e => updateClarifyAnswer(qi, e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button
              onClick={skipClarify}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={continueWithAnswers}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create objective'}
            </button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-[var(--border)] p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{error}</div>
        )}

        {/* Title */}
        <div>
          <label className="block text-[12px] font-semibold text-[var(--text2)] mb-1.5 uppercase tracking-wide">Title</label>
          <input
            {...register('title')}
            placeholder="What do you want to achieve?"
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors"
          />
          {errors.title && <p className="text-[11px] text-[var(--red)] mt-1">{errors.title.message}</p>}
        </div>

        {/* Category — conditional on account_type */}
        <div>
          <label className="block text-[12px] font-semibold text-[var(--text2)] mb-1.5 uppercase tracking-wide">Category</label>
          <select
            {...register('category')}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] bg-white focus:outline-none focus:border-[var(--blue)] transition-colors"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Outcome */}
        <div>
          <label className="block text-[12px] font-semibold text-[var(--text2)] mb-1.5 uppercase tracking-wide">
            Outcome <span className="font-normal text-[var(--text3)] normal-case tracking-normal">— &ldquo;I will have...&rdquo;</span>
          </label>
          <textarea
            {...register('outcome')}
            rows={3}
            placeholder="Describe the specific result you're working toward..."
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors resize-none"
          />
          {errors.outcome && <p className="text-[11px] text-[var(--red)] mt-1">{errors.outcome.message}</p>}
        </div>

        {/* Success condition */}
        <div>
          <label className="block text-[12px] font-semibold text-[var(--text2)] mb-1.5 uppercase tracking-wide">
            Success condition <span className="font-normal normal-case tracking-normal text-[var(--text3)]">— how you know you won</span>
          </label>
          <textarea
            {...register('success_condition')}
            rows={2}
            placeholder="What does done look like?"
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors resize-none"
          />
        </div>

        {/* Target date */}
        <div>
          <label className="block text-[12px] font-semibold text-[var(--text2)] mb-1.5 uppercase tracking-wide">Target date</label>
          <input
            type="date"
            {...register('target_date')}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] bg-white focus:outline-none focus:border-[var(--blue)] transition-colors"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[12px] font-semibold text-[var(--text2)] mb-1.5 uppercase tracking-wide">Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Context, blockers, relationships, open actions..."
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/objectives"
            className="flex-1 text-center py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || assessing}
            className="flex-1 py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
          >
            {assessing ? 'Checking...' : saving ? 'Saving...' : 'Create objective'}
          </button>
        </div>
      </form>
      )}
    </div>
  )
}
