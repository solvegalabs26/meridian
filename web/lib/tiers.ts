export type Tier = 'trial' | 'explorer' | 'accelerator' | 'command'

const TIER_ORDER: Record<Tier, number> = {
  trial: 0,
  explorer: 1,
  accelerator: 2,
  command: 3,
}

export type TierProfile = {
  tier: string | null
  account_type: string | null
}

const ALPHA_ACCOUNT_TYPES = new Set(['alpha_business', 'alpha_personal'])
const ALPHA_FLOOR: Tier = 'explorer' // alpha validation users get Explorer features minimum

function normalizeTier(t: string | null): Tier {
  return (t && t in TIER_ORDER ? t : 'trial') as Tier
}

/** The tier a user should be treated as for FEATURE ACCESS (not billing). */
export function getEffectiveTier(p: TierProfile): Tier {
  const base = normalizeTier(p.tier)
  const isAlpha = !!p.account_type && ALPHA_ACCOUNT_TYPES.has(p.account_type)
  // TODO(beta): add `|| p.is_beta` here to floor beta accounts to explorer too
  if (isAlpha && TIER_ORDER[base] < TIER_ORDER[ALPHA_FLOOR]) return ALPHA_FLOOR
  return base // alpha accounts already on a higher paid tier are never demoted
}

export function tierAtLeast(p: TierProfile, min: Tier): boolean {
  return TIER_ORDER[getEffectiveTier(p)] >= TIER_ORDER[min]
}

export function tierRank(t: Tier): number {
  return TIER_ORDER[t]
}
