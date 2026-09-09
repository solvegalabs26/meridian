// lib/sweep/subAgent/subAgentDispatcher.ts
// FF-064 — Sub-agent orchestrator: detects domain, builds taxonomy queries,
// executes sub-agent, returns signal brief. Called before buildCoherencePackage.
// Failure is always non-fatal — sweep continues without the signal brief.
// Timeout (8s) is owned here so the call site needs no race logic.

import { detectDomain } from './domainDetector'
import { buildElkHuntQueries, extractElkHuntParams } from './taxonomies/elkHunt'
import { executeSubAgent, type SignalBrief } from './subAgentExecutor'

export type { SignalBrief }

async function dispatchSubAgentInternal(objective: {
  id: string
  title: string
  category: string
  notes?: string
}): Promise<SignalBrief | null> {
  console.log(`[FF-064] detectDomain input — title: "${objective.title}" | category: "${objective.category}" | notes: "${objective.notes?.slice(0, 50)}"`)

  const domain = detectDomain(objective)

  console.log(`[FF-064] detected domain: ${domain}`)

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

export async function dispatchSubAgent(objective: {
  id: string
  title: string
  category: string
  notes?: string
}): Promise<SignalBrief | null> {
  const timeoutPromise = new Promise<null>(resolve =>
    setTimeout(() => {
      console.warn(`[FF-064] Sub-agent timeout for objective ${objective.id} — returning null after 8s`)
      resolve(null)
    }, 25000)
  )

  return Promise.race([dispatchSubAgentInternal(objective), timeoutPromise])
}
