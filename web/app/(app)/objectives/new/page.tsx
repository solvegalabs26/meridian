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

  async function onSubmit(data: FormData) {
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

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-[var(--border)] p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{error}</div>
        )}

        {/* Title */}
        <div>
          <label className="block text-[12px] font-semibold text-[var(--text2)] mb-1.5 uppercase tracking-wide">Title</label>
          <input
            {...register('title')}
            placeholder="Alaska Airlines First Officer Hire"
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
            placeholder="I will have received and accepted a Conditional Job Offer from Alaska Airlines..."
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
            placeholder="Signed offer letter with confirmed training class date."
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
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create objective'}
          </button>
        </div>
      </form>
    </div>
  )
}
