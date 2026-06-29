export const PERSONAL_CATEGORIES = [
  'Career/Aviation',
  'Finance',
  'Health',
  'Business',
  'Travel',
  'Lifestyle',
  'Other',
] as const

export const BUSINESS_CATEGORIES = [
  'Revenue/Sales',
  'Operations/Hiring',
  'Market/Competitive',
  'Growth/Expansion',
  'Financial/Capital',
  'Client/Pipeline',
  'Risk/Regulatory',
  'Other',
] as const

export type PersonalCategory = typeof PERSONAL_CATEGORIES[number]
export type BusinessCategory = typeof BUSINESS_CATEGORIES[number]
export type ObjectiveCategory = PersonalCategory | BusinessCategory

export const ALL_CATEGORIES = [
  ...PERSONAL_CATEGORIES,
  ...BUSINESS_CATEGORIES.filter(c => c !== 'Other'),
  'Other',
] as const

export type AccountType = 'personal' | 'alpha_personal' | 'business' | 'alpha_business'

export function isBusinessAccount(accountType: string | null | undefined): boolean {
  return accountType === 'business' || accountType === 'alpha_business'
}

export function getCategoriesForAccount(accountType: string | null | undefined): readonly string[] {
  return isBusinessAccount(accountType) ? BUSINESS_CATEGORIES : PERSONAL_CATEGORIES
}

// Color map covering all categories
export const CATEGORY_COLORS: Record<string, string> = {
  // Personal
  'Career/Aviation': '#2E7CB8',
  'Finance':         '#0F6E56',
  'Health':          '#C9A227',
  'Business':        '#534AB7',
  'Travel':          '#BA7517',
  'Home':            '#5090C0',
  'Lifestyle':       '#8098B4',
  // Business
  'Revenue/Sales':      '#0F6E56',
  'Operations/Hiring':  '#2E7CB8',
  'Market/Competitive': '#534AB7',
  'Growth/Expansion':   '#C9A227',
  'Financial/Capital':  '#0F6E56',
  'Client/Pipeline':    '#2E7CB8',
  'Risk/Regulatory':    '#A32D2D',
  'Other':              '#8098B4',
}
