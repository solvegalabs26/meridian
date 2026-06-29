export const DEFINITIONS: Record<string, { term: string; definition: string }> = {
  objective: {
    term: 'Objective',
    definition: 'A specific, measurable goal you are actively working toward — with a clear outcome, a success condition, and a target date.',
  },
  signal: {
    term: 'Signal',
    definition: 'A piece of information from the world relevant to one of your objectives. Signals can raise your confidence (positive indicator) or lower it (risk or blocker).',
  },
  sweep: {
    term: 'Sweep',
    definition: "Meridian Arc's weekly automated scan. It searches news sources, market data, and industry publications for signals relevant to your objectives, filters out the noise, and synthesizes everything into your weekly intelligence report.",
  },
  confidence: {
    term: 'Confidence %',
    definition: 'A number from 0 to 100 representing the estimated probability of achieving your objective by its target date, based on current signals. It updates every sweep as new information comes in.',
  },
  cross_objective: {
    term: 'Cross-Objective',
    definition: 'A connection Meridian Arc detected between two of your objectives — where progress (or risk) on one directly affects the other. These are often invisible without a system watching all your goals simultaneously.',
  },
  opportunities: {
    term: 'Opportunities',
    definition: 'Positive signals — developments in the world that increase your chances of achieving an objective. These are moments to act on or accelerate.',
  },
  risks: {
    term: 'Risks',
    definition: 'Signals that could block, delay, or reduce your likelihood of achieving an objective. Knowing about them early gives you time to respond.',
  },
  score_factors: {
    term: 'Score Factors',
    definition: "The individual components that drive your confidence score — signal quality (how strong is the evidence?), timeline (how much time remains?), blockers (what's in the way?), and momentum (is progress accelerating or stalling?).",
  },
}
