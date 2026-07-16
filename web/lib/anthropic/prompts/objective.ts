import { Objective } from '@/lib/utils/types'
import { CompsResult } from '@/lib/sweep/fetchComps'

interface RecentSignal {
  title: string
  body: string | null
  source: string | null
  relevance: string
  date: string
  signal_class?: 'market' | 'news' | 'dependency' | 'internal'
}

interface EpisodeHistoryEntry {
  episode_number: number
  narrative: string | null
  signal_count: number
}

interface ObjectiveStateInput {
  objective: Objective
  confidenceHistory: number[]
  recentSignals: RecentSignal[]
  openActions?: string[]
  comps?: CompsResult | null
  completedActionsContext?: string
  askContext?: string
  episodeHistory?: EpisodeHistoryEntry[]
  signalAbsenceCount?: number
}

export function buildObjectiveState(inputs: ObjectiveStateInput[]) {
  return {
    objectives: inputs.map(({ objective, confidenceHistory, recentSignals, openActions, comps, completedActionsContext, askContext, episodeHistory, signalAbsenceCount }) => {
      const obj = objective as Objective & {
        objective_type?: string | null
        deadline_type?: 'hard' | 'soft'
        reservation_price?: number | null
        context?: Record<string, unknown>
      }

      const base = {
        obj_id: obj.obj_id,
        title: obj.title,
        category: obj.category,
        outcome: obj.outcome,
        success_condition: obj.success_condition,
        target_date: obj.target_date,
        deadline_type: obj.deadline_type ?? 'hard',
        current_confidence: obj.confidence,
        confidence_history: confidenceHistory,
        status: obj.status,
        keywords: obj.signal_keywords ?? [],
        recent_signals: recentSignals,
        open_actions: openActions ?? [],
        notes: (obj.notes ?? '').slice(0, 300),
      }

      // Include typed fields when present
      if (obj.objective_type) {
        Object.assign(base, { objective_type: obj.objective_type })
      }
      if (obj.deadline_type === 'soft' && obj.reservation_price != null) {
        Object.assign(base, { reservation_price: obj.reservation_price })
      }
      if (obj.context && Object.keys(obj.context).length > 0) {
        Object.assign(base, { context: obj.context })
      }

      // Inject completed actions so Claude doesn't re-recommend already-done items
      if (completedActionsContext) {
        Object.assign(base, { completed_actions: completedActionsContext })
      }

      // Inject recent Ask Meridian questions the user has asked about this objective
      if (askContext) {
        Object.assign(base, { ask_context: askContext })
      }

      // Inject episode narrative history for absence_signal inference
      // (up to 3 most recent episodes, most recent first)
      if (episodeHistory && episodeHistory.length > 0) {
        Object.assign(base, {
          episode_history: episodeHistory.map(ep => ({
            episode: ep.episode_number,
            signal_count: ep.signal_count,
            narrative_excerpt: ep.narrative ? ep.narrative.slice(0, 250) : null,
          })),
        })
      }

      // Signal absence count: how many of the recent episodes had zero signals
      // Used by R-5 (absence of signal is evidence)
      if (signalAbsenceCount !== undefined && signalAbsenceCount > 0) {
        Object.assign(base, { consecutive_zero_signal_episodes: signalAbsenceCount })
      }

      // Attach comps data for resale-type objectives
      if (comps && comps.isGrounded) {
        Object.assign(base, {
          market_comps: {
            asking_band: comps.askingBand,
            asking_prices_sample: comps.askingPrices.slice(0, 10),
            inventory_count: comps.inventoryCount,
            days_on_market: comps.daysOnMarket,
            seasonality: comps.seasonality,
            summary: comps.summary,
            sources: comps.sources.slice(0, 5),
            price_position: comps.price_position,
            p_sale_by_horizon_estimate: comps.p_sale_by_horizon_estimate,
          },
        })
      }

      return base
    }),
  }
}
