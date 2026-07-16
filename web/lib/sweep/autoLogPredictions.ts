// lib/sweep/autoLogPredictions.ts
// FF-021: Auto-Prediction Logging
// Runs at the end of every sweep. For each objective whose confidence moved ±5+ points,
// generates a Haiku prediction statement and writes a row to predictions (source=auto_sweep).

import Anthropic from '@anthropic-ai/sdk'
import { SupabaseClient } from '@supabase/supabase-js'
import { PRED_AUTO_LOG_DELTA_THRESHOLD } from './constants'

export interface ObjectiveWithConfidenceDelta {
  id: string
  obj_id: string            // e.g. "OBJ-01"
  title: string
  category: string
  confidence: number        // post-sweep value
  confidence_prev: number | null
  target_date: string | null // ISO date "YYYY-MM-DD"
  status: string
  confidence_reasoning?: string // from sweep parsed response (positional)
}

export async function autoLogPredictions(
  supabase: SupabaseClient,
  sweepId: string,
  userId: string,
  objectives: ObjectiveWithConfidenceDelta[],
  sweepSummary: string
): Promise<void> {
  // Only active objectives with a sufficient confidence delta qualify.
  // Phantom sweep guard: objectives with null confidence_prev are skipped (no delta to measure).
  const qualifying = objectives.filter(
    (obj) =>
      obj.status === 'active' &&
      obj.confidence_prev !== null &&
      Math.abs(obj.confidence - (obj.confidence_prev as number)) >= PRED_AUTO_LOG_DELTA_THRESHOLD
  )

  if (qualifying.length === 0) {
    console.log(`[autoLog:predictions] no qualifying objectives for sweep ${sweepId}`)
    return
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const today = new Date()
  const todayDateStr = today.toISOString().slice(0, 10) // YYYY-MM-DD

  let written = 0

  for (const obj of qualifying) {
    const confidencePrev = obj.confidence_prev as number
    const delta = obj.confidence - confidencePrev
    const deltaAbs = Math.abs(delta)
    const direction = delta > 0 ? 'UP' : 'DOWN'

    // ── Deduplication: skip if an open auto-prediction exists within last 14 days ──
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: existing, error: dedupError } = await supabase
      .from('predictions')
      .select('id')
      .eq('objective_id', obj.id)
      .eq('source', 'auto_sweep')
      .is('outcome', null)
      .gt('created_at', cutoff)
      .limit(1)

    if (dedupError) {
      console.error(`[autoLog:predictions] dedup query failed for ${obj.obj_id}`, dedupError)
      continue
    }

    if (existing && existing.length > 0) {
      console.log(`[autoLog:predictions] ${obj.obj_id} — open auto-prediction in 14-day window, skipping`)
      continue
    }

    // ── Horizon date ──
    let horizonDate: string
    if (obj.target_date) {
      horizonDate = obj.target_date
    } else {
      const h = new Date(today)
      h.setDate(h.getDate() + 90)
      horizonDate = h.toISOString().slice(0, 10)
    }

    // ── pred_id: PRED-AUTO-{OBJ_ID_NODASH}-{YYYYMMDD}, collision suffix -2, -3, etc. ──
    const objIdNoDash = obj.obj_id.replace(/-/g, '')
    const datePart = todayDateStr.replace(/-/g, '')
    const basePredId = `PRED-AUTO-${objIdNoDash}-${datePart}`

    const { data: collisions } = await supabase
      .from('predictions')
      .select('pred_id')
      .like('pred_id', `${basePredId}%`)

    const finalPredId =
      collisions && collisions.length > 0
        ? `${basePredId}-${collisions.length + 1}`
        : basePredId

    // ── Haiku: generate prediction statement ──
    let statement = ''
    try {
      const haiku = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `You are the prediction engine for Meridian Arc, an Outcome Intelligence platform.
Your job is to convert a confidence movement detected in an objective sweep into
a clear, forward-looking prediction statement that can be scored TRUE or FALSE at
a future horizon date. Write one statement, 1-2 sentences, in third person.
Be specific and scoreable. Do not hedge. Do not describe what happened — assert
what will happen.`,
        messages: [
          {
            role: 'user',
            content: `Objective: ${obj.title}
Category: ${obj.category}
Confidence moved: ${confidencePrev}% → ${obj.confidence}% (${direction} ${deltaAbs} points)
Horizon date: ${horizonDate}
Sweep summary: ${sweepSummary}
Top signal: ${obj.confidence_reasoning ?? ''}

Write a single scoreable prediction statement for this objective based on this confidence movement.`,
          },
        ],
      })

      if (haiku.content[0].type === 'text') {
        statement = haiku.content[0].text.trim()
      }
    } catch (err) {
      console.error(`[autoLog:predictions] Haiku failed for ${obj.obj_id}`, err)
      continue
    }

    if (!statement) {
      console.warn(`[autoLog:predictions] empty statement from Haiku for ${obj.obj_id}, skipping`)
      continue
    }

    // ── Insert prediction row ──
    const { error: insertError } = await supabase.from('predictions').insert({
      user_id: userId,
      objective_id: obj.id,
      pred_id: finalPredId,
      statement,
      confidence_pct: obj.confidence,
      horizon_date: horizonDate,
      source: 'auto_sweep',
      sweep_id: sweepId,
    })

    if (insertError) {
      console.error(`[autoLog:predictions] insert failed for ${obj.obj_id}`, insertError)
    } else {
      written++
      console.log(`[autoLog:predictions] wrote ${finalPredId} for ${obj.obj_id} (${direction} ${deltaAbs}pts → horizon ${horizonDate})`)
    }
  }

  console.log(`[autoLog:predictions] wrote ${written} predictions for sweep ${sweepId}`)
}
