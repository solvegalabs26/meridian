import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import JournalEntryClient from './JournalEntryClient'

export default async function JournalEntryPage({ params }: { params: { week: string } }) {
  const week = parseInt(params.week)
  if (isNaN(week) || week < 1 || week > 30) notFound()

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entry } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('entry_number', week)
    .single()

  const { data: objectives } = await supabase
    .from('objectives')
    .select('id, obj_id, title, confidence, confidence_prev')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('sort_order')

  const weekOf = new Date('2026-06-23')
  weekOf.setDate(weekOf.getDate() + (week - 1) * 7)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/journal" className="text-[var(--text3)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-[22px] font-medium text-[var(--text)]">
            Week {week} — {weekOf.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h1>
          <p className="text-[13px] text-[var(--text3)]">Founder Journal · 30-week experiment</p>
        </div>
      </div>

      <JournalEntryClient
        week={week}
        weekOf={weekOf.toISOString().split('T')[0]}
        initialEntry={entry}
        objectives={objectives ?? []}
      />
    </div>
  )
}
