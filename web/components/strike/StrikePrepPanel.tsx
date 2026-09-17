'use client'

type Props = { objective: Record<string, unknown>; brief: Record<string, unknown> | null }

export default function StrikePrepPanel({ objective }: Props) {
  const taxonomyKey = (objective.taxonomy_key as string) ?? ''
  return (
    <div className="p-4 text-slate-300">
      <div className="text-sm text-slate-400 mb-2">
        Prep — {taxonomyKey.replace(/\./g, ' · ')}
      </div>
      <div className="text-slate-500 text-sm">Full prep checklist — coming in PR 3.</div>
    </div>
  )
}
