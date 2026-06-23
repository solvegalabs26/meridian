import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Target, Settings } from 'lucide-react'
import ConfidenceMeter from '@/components/objectives/ConfidenceMeter'
import ObjectiveDetailClient from './ObjectiveDetailClient'

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-[var(--green-lt)] text-[var(--green)]',
  paused:   'bg-[var(--amber-lt)] text-[var(--amber-brand)]',
  achieved: 'bg-[var(--purple-lt)] text-[var(--purple-brand)]',
  closed:   'bg-[var(--gray-lt)] text-[var(--text3)]',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Career/Aviation': '#2E7CB8',
  'Finance':         '#0F6E56',
  'Health':          '#C9A227',
  'Business':        '#534AB7',
  'Travel':          '#BA7517',
  'Home':            '#5090C0',
  'Lifestyle':       '#8098B4',
}

export default async function ObjectiveDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: obj } = await supabase
    .from('objectives')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!obj) notFound()

  // Fetch confidence history
  const { data: scores } = await supabase
    .from('confidence_scores')
    .select('score, created_at')
    .eq('objective_id', obj.id)
    .order('created_at', { ascending: true })
    .limit(20)

  const history = scores?.map(s => s.score) ?? []
  const catColor = CATEGORY_COLORS[obj.category] ?? '#8098B4'

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/objectives" className="text-[var(--text3)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: catColor, backgroundColor: `${catColor}18` }}
          >
            {obj.category}
          </span>
          <span className="text-[11px] font-mono text-[var(--text3)]">{obj.obj_id}</span>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-5">
          <h1 className="text-[20px] font-medium text-[var(--text)] leading-snug flex-1">{obj.title}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[obj.status]}`}>
              {obj.status}
            </span>
            <ObjectiveDetailClient obj={obj} />
          </div>
        </div>

        {/* Confidence meter lg */}
        <ConfidenceMeter
          score={obj.confidence}
          prev={obj.confidence_prev ?? undefined}
          history={history.length > 1 ? history : undefined}
          size="lg"
        />
      </div>

      {/* Outcome */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-5 mb-4">
        <h2 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2">Outcome</h2>
        <p className="text-[14px] text-[var(--text2)] leading-relaxed">{obj.outcome}</p>
      </div>

      {/* Success condition + target date */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {obj.success_condition && (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
            <h2 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target size={12} /> Success condition
            </h2>
            <p className="text-[13px] text-[var(--text2)] leading-relaxed">{obj.success_condition}</p>
          </div>
        )}
        {obj.target_date && (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
            <h2 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar size={12} /> Target date
            </h2>
            <p className="text-[20px] font-light text-[var(--text)]">
              {new Date(obj.target_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-[11px] text-[var(--text3)] mt-1">
              {Math.ceil((new Date(obj.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
            </p>
          </div>
        )}
      </div>

      {/* Recommended actions — placeholder until sweep engine */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-5 mb-4">
        <h2 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-3">Recommended actions</h2>
        <div className="p-4 rounded-lg bg-[var(--gray-lt)] text-[13px] text-[var(--text3)] text-center">
          Actions are generated by Meridian after your first sweep — Phase 3.
        </div>
      </div>

      {/* Notes */}
      {obj.notes && (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
          <h2 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2">Notes</h2>
          <p className="text-[13px] text-[var(--text2)] leading-relaxed whitespace-pre-wrap">{obj.notes}</p>
        </div>
      )}
    </div>
  )
}
