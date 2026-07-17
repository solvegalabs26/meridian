import type { SupabaseClient } from '@supabase/supabase-js'

export type ReportingClient = SupabaseClient

export interface CohortOverviewData {
  totalEnrolled: number
  activeThisWeek: number
  sweepCompletionRate: number   // 0–100
  avgObjectivesPerUser: number
}

export interface ObjectiveTrackingData {
  byCategory: { category: string; count: number; avgConfidence: number }[]
  pctWithTargetDate: number
}

export interface ConfidenceTrendsData {
  cycles: { label: string; avgConfidence: number }[]   // up to 4 sweep cycles
}

export interface SweepActivityData {
  sweepsThisPeriod: number
  pctUsersWithSweep: number
  missedSweepCount: number   // users with 0 sweeps this period
}

export interface CrossDepFlagsData {
  totalCrossDepFlags: number
  objectivesWithFlags: number
}

export interface EngagementSummaryData {
  askQueriesTotal: number
  actionsLoggedTotal: number
  lastActiveDistribution: { bucket: string; count: number }[]
}

export interface PredictionsActiveData {
  totalPredictions: number
  avgHorizonDays: number
  pctPendingOutcome: number
}

export interface TopSignalsData {
  keywords: { keyword: string; count: number }[]
}

export interface CohortReportSections {
  cohortOverview?: CohortOverviewData
  objectiveTracking?: ObjectiveTrackingData
  confidenceTrends?: ConfidenceTrendsData
  sweepActivity?: SweepActivityData
  crossDepFlags?: CrossDepFlagsData
  engagementSummary?: EngagementSummaryData
  predictionsActive?: PredictionsActiveData
  topSignals?: TopSignalsData
}

export const ACTIVE_ACCOUNT_TYPES = [
  'alpha_personal', 'alpha_business', 'beta', 'explorer', 'accelerator', 'command',
]
