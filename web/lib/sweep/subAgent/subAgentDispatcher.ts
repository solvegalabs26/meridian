// lib/sweep/subAgent/subAgentDispatcher.ts
// FF-064 — Sub-agent orchestrator: detects domain, builds taxonomy queries,
// executes sub-agent, returns signal brief. Called before buildCoherencePackage.
// Failure is always non-fatal — sweep continues without the signal brief.

import { detectDomain } from './domainDetector'
import { buildElkHuntQueries, extractElkHuntParams } from './taxonomies/elkHunt'
import { executeSubAgent, type SignalBrief } from './subAgentExecutor'

export type { SignalBrief }

export async function dispatchSubAgent(objective: {
  id: string
  title: string
  category: string
  notes?: string
}): Promise<SignalBrief | null> {
  const domain = detectDomain(objective)

  console.log(`[FF-064] dispatchSubAgent called for: ${objective.title} | domain: ${domain}`)

  if (domain === 'unknown') {
    return null
  }

  const objectiveContext = `Title: ${objective.title}\nCategory: ${objective.category}\nNotes: ${objective.notes || 'None'}`

  try {
    if (domain === 'elk_hunt') {
      const params = extractElkHuntParams(objective)
      const queries = buildElkHuntQueries(params)
      return await executeSubAgent(domain, queries, objectiveContext)
    }

    // Future domains added here in subsequent FFs
    return null

  } catch (err) {
    console.error(`[FF-064] Sub-agent dispatch failed for objective ${objective.id}:`, err)
    return null
  }
}
