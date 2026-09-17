'use client'

type Props = { objective: Record<string, unknown>; brief: Record<string, unknown> | null }

export default function StrikePrepPanel(_: Props) {
  return (
    <div className="p-4 text-slate-300">
      <div className="text-sm text-slate-400 mb-2">Preparation checklist</div>
      <div className="text-slate-500 text-sm">Prep panel — coming in PR 3.</div>
    </div>
  )
}
