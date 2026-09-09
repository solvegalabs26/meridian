// lib/sweep/subAgent/taxonomies/elkHunt.ts
// FF-064 — Signal taxonomy for elk hunt objectives.
// 5 queries validated in FF-068, parameterized by geography extracted from the objective.

export interface ElkHuntParams {
  unit?: string    // e.g. "Unit 10"
  state?: string   // e.g. "Utah"
  county?: string  // e.g. "Duchesne"
  species?: string // e.g. "elk"
  season?: string  // e.g. "archery"
  year?: number
}

export function buildElkHuntQueries(params: ElkHuntParams): string[] {
  const { unit = '', state = 'Utah', county = '', year = new Date().getFullYear() } = params
  const geo = [county, state].filter(Boolean).join(' ')
  const unitStr = unit || ''

  return [
    // Signal 1 — Drought and water conditions
    `NOAA drought monitor ${geo} current ${year} severity classification`,

    // Signal 2 — DWR population data
    `Utah DWR elk population estimate ${unitStr} ${year} target herd size`,

    // Signal 3 — Water source and movement intelligence
    `${unitStr} ${state} elk water source conditions drought ${year} movement`,

    // Signal 4 — Adjacent unit comparison
    `Utah elk hunting adjacent units ${unitStr} conditions comparison ${year}`,

    // Signal 5 — Tag availability as proxy for conditions
    `Utah DWR elk permits remaining ${unitStr} ${year} antlerless`,
  ].filter(Boolean)
}

export function extractElkHuntParams(objective: {
  title: string
  notes?: string
  category: string
}): ElkHuntParams {
  const text = `${objective.title} ${objective.notes || ''}`.toLowerCase()

  const unitMatch = text.match(/unit\s*(\d+[a-z]?)/i)
  const unit = unitMatch ? `Unit ${unitMatch[1]}` : ''

  const countyMap: Record<string, string> = {
    'diamond mountain': 'Duchesne',
    'vernal': 'Uintah',
    'book cliffs': 'Uintah',
    'strawberry': 'Wasatch',
    'nine mile': 'Carbon',
  }
  let county = ''
  for (const [key, val] of Object.entries(countyMap)) {
    if (text.includes(key)) { county = val; break }
  }

  const season = text.includes('archery') ? 'archery' :
    text.includes('rifle') ? 'rifle' :
    text.includes('muzzleloader') ? 'muzzleloader' : ''

  return {
    unit,
    state: 'Utah',
    county,
    species: 'elk',
    season,
    year: new Date().getFullYear(),
  }
}
