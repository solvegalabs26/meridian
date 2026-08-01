'use client'

import { useState } from 'react'
import { ObjectiveCard } from './ObjectiveCard'
import type { ObjectiveWithResult, ObjectiveState } from '@/lib/enterprise/objectives-queries'

type Props = {
  objectives: ObjectiveWithResult[]
  onStateChange: (objectiveId: string, newState: ObjectiveState) => void
  onSweepRequest: () => void
  sweepInProgress: boolean
  lastSweepAt: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export function ObjectivesPanel({
  objectives,
  onStateChange,
  onSweepRequest,
  sweepInProgress,
  lastSweepAt,
}: Props) {
  const [pausedExpanded, setPausedExpanded] = useState(false)
  const [changingObjectiveId, setChangingObjectiveId] = useState<string | null>(null)

  const focusObjs    = objectives.filter(o => o.objective_state === 'focus')
  const liteObjs     = objectives.filter(o => o.objective_state === 'monitoring_lite')
  const pausedObjs   = objectives.filter(o => o.objective_state === 'paused')

  const handleStateChange = async (objectiveId: string, newState: ObjectiveState) => {
    setChangingObjectiveId(objectiveId)
    await onStateChange(objectiveId, newState)
    setChangingObjectiveId(null)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm text-white">Portfolio Objectives</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {lastSweepAt ? `Last sweep ${timeAgo(lastSweepAt)}` : 'No sweep run yet'}
          </div>
        </div>
        <button
          onClick={onSweepRequest}
          disabled={sweepInProgress}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white transition"
        >
          {sweepInProgress ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>▶ Run Sweep</>
          )}
        </button>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto flex-1">

        {/* ── IN FOCUS ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-xs font-bold text-green-400 tracking-widest uppercase">In Focus ({focusObjs.length})</span>
          </div>
          {focusObjs.length > 0 ? (
            <div className="space-y-3">
              {focusObjs.map(obj => (
                <ObjectiveCard
                  key={obj.id}
                  objective={obj}
                  onStateChange={handleStateChange}
                  changingState={changingObjectiveId === obj.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-600 px-2">No focus objectives. Escalate from Monitoring Lite to begin active intelligence.</div>
          )}
        </section>

        {/* ── MONITORING LITE ── */}
        {liteObjs.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">Monitoring Lite ({liteObjs.length})</span>
            </div>
            <div className="space-y-3">
              {liteObjs.map(obj => (
                <ObjectiveCard
                  key={obj.id}
                  objective={obj}
                  onStateChange={handleStateChange}
                  changingState={changingObjectiveId === obj.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── PAUSED ── */}
        {pausedObjs.length > 0 && (
          <section>
            <button
              onClick={() => setPausedExpanded(v => !v)}
              className="flex items-center gap-2 mb-3 hover:opacity-80 transition"
            >
              <span className="text-xs text-gray-600">{pausedExpanded ? '▼' : '▶'}</span>
              <span className="text-xs font-bold text-gray-600 tracking-widest uppercase">
                Paused ({pausedObjs.length})
              </span>
            </button>
            {pausedExpanded && (
              <div className="space-y-2">
                {pausedObjs.map(obj => (
                  <ObjectiveCard
                    key={obj.id}
                    objective={obj}
                    onStateChange={handleStateChange}
                    changingState={changingObjectiveId === obj.id}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {objectives.length === 0 && !sweepInProgress && (
          <div className="text-center py-8 text-gray-600 text-sm">
            <div className="text-2xl mb-2">🎯</div>
            No objectives configured. Contact your administrator to set up portfolio objectives.
          </div>
        )}
      </div>
    </div>
  )
}
