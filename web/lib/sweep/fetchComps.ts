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
}

interface CompsInput {
  objectiveType: string
  context: Record<string, unknown>
  title: string
  currentDate: string
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

    return { askingPrices: prices, askingBand: band, inventoryCount: inv, daysOnMarket: dom, seasonality, summary, sources, isGrounded }
  } catch (err) {
    console.error('[fetchComps] error:', err)
    return empty
  }
}
