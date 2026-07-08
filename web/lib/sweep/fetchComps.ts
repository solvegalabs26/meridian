/**
 * fetchComps — pulls live market comps for resale-type objectives using
 * Claude's built-in web_search tool (web-search-2025-03-05 beta).
 *
 * Returns structured data the sweep engine uses to:
 *   - Ground confidence scores (instead of neutral-50 drift)
 *   - Write signal_class='market' rows to the signals table
 *   - Give Claude real comps context in the objective state
 */

import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient } from '@/lib/anthropic/client'

export interface CompsResult {
  /** Raw asking price samples found (USD) */
  askingPrices: number[]
  /** Derived band from samples */
  askingBand: { low: number; mid: number; high: number } | null
  /** Estimated active inventory count (rough) */
  inventoryCount: number | null
  /** Typical days-on-market for this type/condition */
  daysOnMarket: number | null
  /** Seasonality note */
  seasonality: string | null
  /** Human-readable summary for the signals feed */
  summary: string
  /** Source citations from the web search */
  sources: string[]
  /** Whether we got enough data to ground a confidence score */
  isGrounded: boolean
  /** Where the user's floor/ask sits relative to market — feeds confidence */
  price_position: 'below' | 'at' | 'above' | null
  /** Directional P(sale by target_date) — 0–1, not a precise stat */
  p_sale_by_horizon_estimate: number | null
}

export interface CompsInput {
  objectiveType: string
  context: Record<string, unknown>
  title: string
  currentDate: string
  /** User's minimum acceptable price (reservation_price) */
  reservationPrice?: number | null
  /** ISO date string for the target/horizon date */
  targetDate?: string | null
}

function buildCompsQuery(input: CompsInput): string {
  const { objectiveType, context, title } = input
  const year  = context.year  as string | undefined
  const make  = context.make  as string | undefined
  const model = context.model as string | undefined
  const condition = context.condition as string | undefined
  const region = context.region as string | undefined

  if (objectiveType === 'asset.resale.recreational_vehicle') {
    const parts = [year, make, model, 'RV for sale'].filter(Boolean)
    const item  = parts.length > 2 ? parts.join(' ') : title
    const geo   = region ? ` ${region}` : ''
    return `${item}${geo} price listings 2025 2026 site:rvtrader.com OR site:rvusa.com OR site:campingworld.com asking price`
  }

  if (objectiveType === 'asset.resale.real_estate') {
    const geo = region ?? ''
    return `${geo} home sale prices 2026 median days on market inventory ${condition ?? ''}`
  }

  if (objectiveType === 'asset.resale.vehicle') {
    const parts = [year, make, model, 'for sale'].filter(Boolean)
    return `${parts.join(' ')} price listings KBB CarGurus AutoTrader`
  }

  if (objectiveType === 'asset.resale.boat') {
    const parts = [year, make, model, 'boat for sale'].filter(Boolean)
    return `${parts.join(' ')} price listings boat trader`
  }

  return `${title} market price 2026`
}

function extractPrices(text: string): number[] {
  // Match patterns like $25,000 / $25k / 25000 / 25,000
  const patterns = [
    /\$\s*([\d,]+(?:\.\d+)?)\s*k/gi,
    /\$\s*([\d,]+(?:\.\d+)?)/g,
    /([\d,]{4,})(?:\s*dollars|\s*USD)/gi,
  ]
  const prices: number[] = []
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const raw = m[1].replace(/,/g, '')
      const val = re.source.includes('k') ? parseFloat(raw) * 1000 : parseFloat(raw)
      if (val >= 1000 && val <= 5_000_000) prices.push(val)
    }
  }
  return Array.from(new Set(prices)).sort((a, b) => a - b)
}

function deriveBand(prices: number[]): { low: number; mid: number; high: number } | null {
  if (prices.length < 2) return null
  const p10 = prices[Math.floor(prices.length * 0.10)]
  const p50 = prices[Math.floor(prices.length * 0.50)]
  const p90 = prices[Math.floor(prices.length * 0.90)]
  return { low: p10, mid: p50, high: p90 }
}

function extractDom(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:to\s*\d+\s*)?days?\s*on\s*market/i)
      ?? text.match(/average\s*(?:of\s*)?([\d]+)\s*days/i)
  return m ? parseInt(m[1]) : null
}

function extractInventory(text: string): number | null {
  const m = text.match(/([\d,]+)\s*(?:active\s*)?listings?/i)
      ?? text.match(/([\d,]+)\s*(?:RVs?|vehicles?|homes?|boats?)\s*(?:for\s*sale|listed)/i)
  if (!m) return null
  const n = parseInt(m[1].replace(/,/g, ''))
  return n > 0 ? n : null
}

function derivePricePosition(
  reservationPrice: number,
  band: { low: number; mid: number; high: number }
): 'below' | 'at' | 'above' {
  if (reservationPrice < band.low) return 'below'
  if (reservationPrice > band.high) return 'above'
  return 'at'
}

function deriveHorizonEstimate(
  pricePosition: 'below' | 'at' | 'above',
  seasonality: string | null,
  daysOnMarket: number | null,
  targetDate: string | null,
  currentDate: string
): number {
  // Base probability from price positioning
  let p = pricePosition === 'below' ? 0.78 : pricePosition === 'at' ? 0.55 : 0.28

  // Seasonality adjustment — RV/vehicle specific soft signals
  if (seasonality) {
    const lower = seasonality.toLowerCase()
    if (lower.includes('peak') || lower.includes('spring') || lower.includes('strong demand')) p += 0.08
    if (lower.includes('slow') || lower.includes('winter') || lower.includes('soft season')) p -= 0.10
  }

  // Days-remaining vs DOM adjustment
  if (daysOnMarket !== null && targetDate) {
    const daysRemaining = Math.max(0,
      (new Date(targetDate).getTime() - new Date(currentDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysRemaining > daysOnMarket * 2) p += 0.06     // ample runway
    else if (daysRemaining < daysOnMarket * 0.75) p -= 0.12  // tight window
  }

  return Math.min(0.97, Math.max(0.05, Math.round(p * 100) / 100))
}

function extractSeasonality(text: string, objectiveType: string): string | null {
  const lower = text.toLowerCase()
  if (objectiveType.includes('recreational_vehicle')) {
    if (lower.includes('spring') && (lower.includes('peak') || lower.includes('best')))
      return 'Spring is peak RV selling season; summer demand is strong.'
    if (lower.includes('winter') && (lower.includes('slow') || lower.includes('lower')))
      return 'Winter is typically slower for RV sales; pricing pressure may increase.'
  }
  return null
}

export async function fetchComps(input: CompsInput): Promise<CompsResult | null> {
  const empty: CompsResult = {
    askingPrices: [], askingBand: null, inventoryCount: null,
    daysOnMarket: null, seasonality: null,
    summary: 'No comp data retrieved.', sources: [], isGrounded: false,
    price_position: null, p_sale_by_horizon_estimate: null,
  }

  const query = buildCompsQuery(input)

  const prompt = `You are a market research assistant. Search for current market data to answer this query:

"${query}"

After searching, extract and summarize:
1. Asking price range (low, typical/mid, high in USD)
2. Number of active listings (if available)
3. Typical days on market
4. Any seasonality notes
5. A 2-3 sentence market summary suitable for an investor/seller

Return ONLY valid JSON (no markdown):
{
  "summary": "string",
  "asking_prices_sample": [number, ...],
  "inventory_count": number or null,
  "days_on_market": number or null,
  "seasonality": "string or null"
}`

  try {
    const client = getAnthropicClient()

    const response = await (client.beta.messages.create as (params: unknown) => Promise<Anthropic.Message>)({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: prompt }],
      betas: ['web-search-2025-03-05'],
    })

    // Collect text from all content blocks
    const allText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    // Try to parse structured JSON from the response
    const jsonMatch = allText.match(/\{[\s\S]*\}/)
    let parsed: {
      summary?: string
      asking_prices_sample?: number[]
      inventory_count?: number | null
      days_on_market?: number | null
      seasonality?: string | null
    } | null = null

    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]) } catch { /* fall through */ }
    }

    // Fall back to regex extraction if JSON parse failed
    const prices = parsed?.asking_prices_sample?.length
      ? parsed.asking_prices_sample
      : extractPrices(allText)

    const band = deriveBand(prices)
    const dom  = parsed?.days_on_market ?? extractDom(allText)
    const inv  = parsed?.inventory_count ?? extractInventory(allText)
    const seasonality = parsed?.seasonality ?? extractSeasonality(allText, input.objectiveType)
    const summary = parsed?.summary ?? allText.slice(0, 400)

    // Collect cited URLs from web_search_tool_result blocks
    const sources: string[] = []
    for (const block of response.content) {
      if (block.type === 'web_search_tool_result') {
        const content = (block as { content?: unknown[] }).content ?? []
        for (const item of content) {
          const url = (item as { url?: string }).url
          if (url) sources.push(url)
        }
      }
    }

    const isGrounded = prices.length >= 2 || (band !== null)

    // Derive price position and horizon estimate when we have enough data
    let price_position: CompsResult['price_position'] = null
    let p_sale_by_horizon_estimate: number | null = null

    if (band && input.reservationPrice != null) {
      price_position = derivePricePosition(input.reservationPrice, band)
      p_sale_by_horizon_estimate = deriveHorizonEstimate(
        price_position, seasonality, dom, input.targetDate ?? null, input.currentDate
      )
    }

    return { askingPrices: prices, askingBand: band, inventoryCount: inv, daysOnMarket: dom, seasonality, summary, sources, isGrounded, price_position, p_sale_by_horizon_estimate }
  } catch (err) {
    console.error('[fetchComps] error:', err)
    return empty
  }
}
