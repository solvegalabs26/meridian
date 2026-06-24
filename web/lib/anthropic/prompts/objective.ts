import { Objective } from '@/lib/utils/types'

interface RecentSignal {
  title: string
  body: string | null
  source: string | null
  relevance: string
  date: string
}

interface ObjectiveStateInput {
  objective: Objective
  confidenceHistory: number[]
  recentSignals: RecentSignal[]
  openActions?: string[]
}

export function buildObjectiveState(inputs: ObjectiveStateInput[]) {
  return {
    objectives: inputs.map(({ objective, confidenceHistory, recentSignals, openActions }) => ({
      obj_id: objective.obj_id,
      title: objective.title,
      category: objective.category,
      outcome: objective.outcome,
      success_condition: objective.success_condition,
      target_date: objective.target_date,
      current_confidence: objective.confidence,
      confidence_history: confidenceHistory,
      status: objective.status,
      keywords: objective.signal_keywords ?? [],
      recent_signals: recentSignals,
      open_actions: openActions ?? [],
      notes: objective.notes ?? '',
    })),
  }
}
