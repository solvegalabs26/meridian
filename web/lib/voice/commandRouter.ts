import Anthropic from '@anthropic-ai/sdk'

export type VoiceRoute =
  | 'brief'
  | 'action_runner'
  | 'score'
  | 'concierge'
  | 'driving_mode'
  | 'scores'
  | 'new_goal'
  | 'help'
  | 'stop'
  | 'unknown'

const KEYWORD_RULES: Array<{ patterns: string[]; route: VoiceRoute }> = [
  { patterns: ['stop', 'cancel', 'exit', 'close'], route: 'stop' },
  { patterns: ['help', 'what can i say', 'commands'], route: 'help' },
  { patterns: ['driving', 'car mode', "i'm driving", 'drive mode'], route: 'driving_mode' },
  { patterns: ['summary', 'read my week', 'brief', 'weekly', "what's ahead", 'whats ahead'], route: 'brief' },
  { patterns: ['score prediction', 'score my prediction', 'hit', 'miss', 'prediction'], route: 'score' },
  { patterns: ['scores', 'how are my goals', 'read my scores', 'confidence', 'goal scores'], route: 'scores' },
  { patterns: ['new goal', 'create goal', 'add goal', 'create objective', 'new objective'], route: 'new_goal' },
  { patterns: ['ask meridian', 'what do i need', 'how do i', 'why is'], route: 'concierge' },
  { patterns: ['log', 'i did', 'i completed', 'action', 'update my goal', 'taskers', 'update goal'], route: 'action_runner' },
]

const CONCIERGE_PREFIXES = ['ask meridian', 'ask about', 'what do i need', 'how do i', 'why is']

export async function classifyVoiceCommand(
  transcript: string
): Promise<{ route: VoiceRoute; extractedQuery?: string }> {
  const lower = transcript.toLowerCase().trim()

  for (const { patterns, route } of KEYWORD_RULES) {
    if (patterns.some(p => lower.includes(p))) {
      let extractedQuery: string | undefined
      if (route === 'concierge') {
        for (const prefix of CONCIERGE_PREFIXES) {
          const idx = lower.indexOf(prefix)
          if (idx !== -1) {
            const after = transcript.slice(idx + prefix.length).trim()
            extractedQuery = after.length > 0 ? after : transcript
            break
          }
        }
        if (!extractedQuery) extractedQuery = transcript
      }
      return { route, extractedQuery }
    }
  }

  // Haiku fallback for ambiguous input
  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Classify this voice command into one of these routes: brief, action_runner, score, concierge, driving_mode, scores, new_goal, help, stop, unknown. Command: "${transcript}" Return ONLY JSON: { "route": "..." }`,
      }],
    })
    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { route: VoiceRoute }
    return { route: parsed.route ?? 'unknown' }
  } catch {
    return { route: 'unknown' }
  }
}
