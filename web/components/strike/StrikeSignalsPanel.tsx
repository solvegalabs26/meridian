'use client'

type Props = { objectiveId: string }

export default function StrikeSignalsPanel({ objectiveId }: Props) {
  return (
    <div className="p-4 text-slate-300">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Agent Signals</div>
      <div className="text-slate-500 text-sm">Signals panel — coming in PR 3.</div>
    </div>
  )
}
