'use client'

import Link from 'next/link'
import { Objective } from '@/lib/utils/types'
import ConfidenceMeter from './ConfidenceMeter'
import { Calendar, ChevronRight } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  'Career/Aviation': '#2E7CB8',
  'Finance':         '#0F6E56',
  'Health':          '#C9A227',
  'Business':        '#534AB7',
  'Travel':          '#BA7517',
  'Home':            '#5090C0',
  'Lifestyle':       '#8098B4',
}

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-[var(--green-lt)] text-[var(--green)]',
  paused:   'bg-[var(--amber-lt)] text-[var(--amber-brand)]',
  achieved: 'bg-[var(--purple-lt)] text-[var(--purple-brand)]',
  closed:   'bg-[var(--gray-lt)] text-[var(--text3)]',
}

export default function ObjectiveCard({ obj }: { obj: Objective }) {
  const catColor = CATEGORY_COLORS[obj.category] ?? '#8098B4'

  return (
    <Link
      href={`/objectives/${obj.id}`}
      className="block bg-white rounded-xl border border-[var(--border)] p-5 hover:shadow-md hover:border-[var(--blue-mid)] transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: catColor, backgroundColor: `${catColor}18` }}
            >
              {obj.category}
            </span>
            <span className="text-[10px] font-mono text-[var(--text3)]">{obj.obj_id}</span>
          </div>
          <h3 className="text-[14px] font-medium text-[var(--text)] leading-snug group-hover:text-[var(--blue)] transition-colors line-clamp-2">
            {obj.title}
          </h3>
        </div>
        <ChevronRight size={16} className="text-[var(--text3)] flex-shrink-0 mt-1 group-hover:text-[var(--blue)] transition-colors" />
      </div>

      <div className="mb-3">
        <ConfidenceMeter score={obj.confidence} prev={obj.confidence_prev ?? undefined} size="md" />
      </div>

      <div className="flex items-center justify-between">
        {obj.target_date && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text3)]">
            <Calendar size={11} />
            {new Date(obj.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[obj.status] ?? STATUS_STYLES.active}`}>
          {obj.status}
        </span>
      </div>
    </Link>
  )
}
