import { describe, it, expect } from 'vitest'
import { getEffectiveTier, tierAtLeast } from './tiers'

describe('getEffectiveTier', () => {
  it('personal + trial → trial', () => {
    expect(getEffectiveTier({ tier: 'trial', account_type: 'personal' })).toBe('trial')
  })

  it('personal + explorer → explorer', () => {
    expect(getEffectiveTier({ tier: 'explorer', account_type: 'personal' })).toBe('explorer')
  })

  it('alpha_business + trial → explorer (load-bearing: alpha floor kicks in)', () => {
    expect(getEffectiveTier({ tier: 'trial', account_type: 'alpha_business' })).toBe('explorer')
  })

  it('alpha_personal + trial → explorer', () => {
    expect(getEffectiveTier({ tier: 'trial', account_type: 'alpha_personal' })).toBe('explorer')
  })

  it('alpha_business + command → command (no demotion)', () => {
    expect(getEffectiveTier({ tier: 'command', account_type: 'alpha_business' })).toBe('command')
  })

  it('alpha_business + accelerator → accelerator (no demotion)', () => {
    expect(getEffectiveTier({ tier: 'accelerator', account_type: 'alpha_business' })).toBe('accelerator')
  })

  it('business + trial → trial (non-alpha business is NOT floored)', () => {
    expect(getEffectiveTier({ tier: 'trial', account_type: 'business' })).toBe('trial')
  })

  it('null tier → trial', () => {
    expect(getEffectiveTier({ tier: null, account_type: 'personal' })).toBe('trial')
  })

  it('unknown tier string → trial', () => {
    expect(getEffectiveTier({ tier: 'premium_legacy', account_type: 'personal' })).toBe('trial')
  })

  it('null account_type → raw tier used', () => {
    expect(getEffectiveTier({ tier: 'explorer', account_type: null })).toBe('explorer')
  })

  it('null tier + null account_type → trial', () => {
    expect(getEffectiveTier({ tier: null, account_type: null })).toBe('trial')
  })
})

describe('tierAtLeast', () => {
  it('alpha_business + trial meets explorer threshold', () => {
    expect(tierAtLeast({ tier: 'trial', account_type: 'alpha_business' }, 'explorer')).toBe(true)
  })

  it('personal + trial does NOT meet explorer threshold', () => {
    expect(tierAtLeast({ tier: 'trial', account_type: 'personal' }, 'explorer')).toBe(false)
  })

  it('personal + explorer meets explorer threshold', () => {
    expect(tierAtLeast({ tier: 'explorer', account_type: 'personal' }, 'explorer')).toBe(true)
  })

  it('alpha_business + trial does NOT meet accelerator threshold (floor is explorer)', () => {
    expect(tierAtLeast({ tier: 'trial', account_type: 'alpha_business' }, 'accelerator')).toBe(false)
  })

  it('personal + accelerator meets accelerator threshold', () => {
    expect(tierAtLeast({ tier: 'accelerator', account_type: 'personal' }, 'accelerator')).toBe(true)
  })

  it('personal + command meets accelerator threshold', () => {
    expect(tierAtLeast({ tier: 'command', account_type: 'personal' }, 'accelerator')).toBe(true)
  })
})
