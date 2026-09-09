// lib/sweep/subAgent/subAgentExecutor.ts
// FF-064 — Core sub-agent engine: executes Brave Search queries and synthesizes
// results into a structured signal brief via a Haiku call. Haiku is correct here —
// classification/synthesis of raw search results, not the main Engine 3 synthesis.

import Anthropic from '@anthropic-ai/sdk'
import { executeBraveSearch } from '@/lib/signals/braveSearch'

export interface SignalBrief {
  domain: string
  queriesRun: number
  keyFindings: string[]        // 3-5 most actionable findings
  patternObservation: string   // Does current condition match historical pattern?
  confidenceTier: 'T1' | 'T2' | 'T3' | 'T4'
  rawSummary: string           // Full synthesis for Layer 7
  sourcesConsulted: string[]
  executedAt: string           // ISO timestamp
}

export async function executeSubAgent(
  domain: string,
  queries: string[],
  objectiveContext: string
): Promise<SignalBrief> {
  const client = new Anthropic()
  const searchResults: string[] = []
  const sourcesConsulted: string[] = []

  for (const query of queries) {
    try {
      const result = await executeBraveSearch(query)
      if (result) {
        searchResults.push(`QUERY: ${query}\nRESULT: ${result}`)
        sourcesConsulted.push(query)
      }
    } catch (err) {
      console.error(`[FF-064] Sub-agent query failed: ${query}`, err)
    }
  }

  if (searchResults.length === 0) {
    return {
      domain,
      queriesRun: 0,
      keyFindings: [],
      patternObservation: 'No external signals retrieved — sub-agent queries failed.',
      confidenceTier: 'T4',
      rawSummary: '',
      sourcesConsulted: [],
      executedAt: new Date().toISOString(),
    }
  }

  const prompt = `You are an intelligence analyst synthesizing external signal data for a specific objective.

OBJECTIVE CONTEXT:
${objectiveContext}

DOMAIN: ${domain}

EXTERNAL SIGNAL DATA RETRIEVED:
${searchResults.join('\n\n---\n\n')}

Produce a structured signal brief. Be specific and factual. Only report what the data actually shows.
Use this exact JSON format:

{
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "patternObservation": "Does current condition match any historical pattern with a known outcome?",
  "confidenceTier": "T1|T2|T3|T4",
  "rawSummary": "2-3 sentence synthesis of all findings for injection into main sweep"
}

Confidence tiers:
T1 = Government/agency structured data with date
T2 = Verified field observation with timestamp
T3 = Reported/anecdotal, unverified
T4 = Modeled/inferred from pattern analysis

Base confidence tier on the LOWEST quality source used.
Be honest. Do not overstate certainty. Flag anything unverified.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return {
      domain,
      queriesRun: searchResults.length,
      keyFindings: parsed.keyFindings || [],
      patternObservation: parsed.patternObservation || '',
      confidenceTier: parsed.confidenceTier || 'T4',
      rawSummary: parsed.rawSummary || '',
      sourcesConsulted,
      executedAt: new Date().toISOString(),
    }
  } catch {
    return {
      domain,
      queriesRun: searchResults.length,
      keyFindings: [],
      patternObservation: '',
      confidenceTier: 'T4',
      rawSummary: text.slice(0, 500),
      sourcesConsulted,
      executedAt: new Date().toISOString(),
    }
  }
}
