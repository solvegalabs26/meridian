export type SignalClass = 'news' | 'market' | 'dependency' | 'user_action' | 'watch_source'

export type OutcomeResult = 'success' | 'partial' | 'failed'

// Maps objective_outcomes.outcome_type (HIT/PARTIAL/MISS) → OutcomeResult
export function mapOutcomeType(outcomeType: string): OutcomeResult {
  if (outcomeType === 'HIT') return 'success'
  if (outcomeType === 'PARTIAL') return 'partial'
  return 'failed'
}

// Accuracy score formula rewards calibrated confidence, not optimism.
// success: a 90% prediction that hit scores 90; a 40% prediction that hit scores 40
// failed:  a 30% prediction that failed (correctly skeptical) scores 70
// partial: half credit toward the predicted direction
export function computeAccuracyScore(
  predictedConfidence: number,
  actualOutcome: OutcomeResult
): number {
  switch (actualOutcome) {
    case 'success':
      return predictedConfidence
    case 'failed':
      return 100 - predictedConfidence
    case 'partial':
      return 50 + (predictedConfidence - 50) * 0.5
  }
}

// Weight modifier range: 0.5× at 0% accuracy → 1.5× at 100% accuracy
// Neutral point: 1.0× at 50% accuracy
// Gate: only injected into sweep when outcomes_scored >= 3
export function computeWeightModifier(accuracyAvg: number): number {
  return 0.5 + (accuracyAvg / 100)
}
