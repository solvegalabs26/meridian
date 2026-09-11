import { getAnthropicClient } from '@/lib/anthropic/client';

export type MovementWindow = {
  time: string;
  probability: number;
  reason: string;
  confidence_tier: 'T1' | 'T2' | 'T3' | 'T4';
};

const MOVEMENT_PROMPT = (
  domain: string,
  patternMatchYear: number | null,
  signalBrief: string,
  macroEvents: object[]
) => `You are Meridian's movement prediction engine for the ${domain} domain.

Generate time-of-day movement probability windows for today. Apply these rules:

THERMAL LOGIC:
- Pre-dawn (0430): thermals are stable — elk move to water/feed before first light
- First light (0600): peak thermal inversion — highest movement probability of day
- Morning (0800): thermals begin rising — elk transitioning to bedding terrain
- Midday (1100): thermals fully reversed — elk bedded, minimal movement
- Afternoon (1500): thermals begin to fall — elk staging for evening feed
- Evening (1700): thermals dropping to inversion — second peak movement window
- Last light (1900): return to water or bedding — moderate movement

DROUGHT ADJUSTMENT:
- Look for drought indicators in signal brief and macro events
- D2-D3 drought: compress movement to water-source corridors; increase water-adjacent window probabilities by 15-25%
- D0-D1: normal distribution applies

TEMPERATURE ADJUSTMENT:
- High temp signals (>85°F): push movement to first/last light only; depress midday windows to <15%
- Moderate temp: normal distribution

PATTERN MATCH ADJUSTMENT:
${patternMatchYear ? `- Current conditions match ${patternMatchYear}. Use that year's known movement patterns as baseline if applicable.` : '- No pattern match — use standard thermal model.'}

SIGNAL BRIEF (current conditions):
${signalBrief}

MACRO EVENTS (recent domain events):
${JSON.stringify(macroEvents.slice(0, 5), null, 2)}

CONFIDENCE TIERS:
- T1: Only when signal brief contains confirmed weather station data (temp, precip, wind)
- T2: When pattern match year provides confirmed movement data
- T3: When thermal model applied without current weather confirmation
- T4: When insufficient data — modeled estimate only

Output a JSON array of exactly 7 movement windows. Use bracket extraction — no markdown fencing.
[
  {"time": "0430", "probability": 0.82, "reason": "one sentence", "confidence_tier": "T3"},
  {"time": "0600", "probability": 0.95, "reason": "one sentence", "confidence_tier": "T3"},
  {"time": "0800", "probability": 0.61, "reason": "one sentence", "confidence_tier": "T3"},
  {"time": "1100", "probability": 0.21, "reason": "one sentence", "confidence_tier": "T3"},
  {"time": "1500", "probability": 0.28, "reason": "one sentence", "confidence_tier": "T3"},
  {"time": "1700", "probability": 0.88, "reason": "one sentence", "confidence_tier": "T3"},
  {"time": "1900", "probability": 0.74, "reason": "one sentence", "confidence_tier": "T3"}
]`;

export async function generateMovementWindows(
  domain: string,
  patternMatchYear: number | null,
  signalBrief: string,
  macroEvents: object[]
): Promise<MovementWindow[]> {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: MOVEMENT_PROMPT(domain, patternMatchYear, signalBrief, macroEvents),
    }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) {
    console.error('[MovementPrediction] Failed to extract JSON array from response');
    return [];
  }

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as MovementWindow[];
    return parsed.map(w => ({
      time: String(w.time),
      probability: Math.min(1, Math.max(0, Number(w.probability))),
      reason: String(w.reason),
      confidence_tier: (['T1', 'T2', 'T3', 'T4'].includes(w.confidence_tier) ? w.confidence_tier : 'T4') as MovementWindow['confidence_tier'],
    }));
  } catch {
    console.error('[MovementPrediction] JSON parse failed');
    return [];
  }
}
