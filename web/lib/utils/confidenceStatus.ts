export type ConfidenceStatus = 'on_track' | 'watch' | 'risk'

export function getConfidenceStatus(confidence: number): ConfidenceStatus {
  if (confidence >= 75) return 'on_track'
  if (confidence >= 55) return 'watch'
  return 'risk'
}

export const STATUS_COLORS: Record<ConfidenceStatus, string> = {
  on_track: 'var(--ov-green)',
  watch: 'var(--ov-amber)',
  risk: 'var(--ov-red)',
}

export const STATUS_LABELS: Record<ConfidenceStatus, string> = {
  on_track: '✓ On track',
  watch: '⚠ Watch',
  risk: '✗ Risk',
}
