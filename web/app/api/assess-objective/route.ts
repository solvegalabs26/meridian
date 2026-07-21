import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient } from '@/lib/anthropic/client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    title: string
    category: string
    outcome: string
    target_date: string | null
  }
  if (!body.outcome?.trim()) return NextResponse.json({ error: 'Outcome is required' }, { status: 400 })

  const prompt = `You are helping refine a single user objective before Meridian starts tracking it.

Objective:
- Title: ${body.title}
- Category: ${body.category}
- Outcome: ${body.outcome}
- Target date: ${body.target_date ?? 'not specified'}

STRICT ISOLATION RULE: You are assessing THIS objective only. Only ask questions whose subject is explicitly named or directly implied by the title and outcome text above. Never ask about topics, credentials, certifications, activities, or plans that are not traceable to words already present in those two fields. If a topic is not in the title or outcome, it is out of scope — do not raise it.

Assess whether this objective is well-specified enough to be useful for confidence scoring and action recommendations, or whether it's missing key context that would meaningfully improve future analysis. Do NOT ask questions just to ask questions — most objectives that already state a clear deadline, occasion, or context need zero questions.

Consider (not exhaustive), only if relevant to the title/outcome above:
- Timeline: is there a stated deadline or target date? If none is evident anywhere in the objective, this is worth asking.
- Related event: is this objective tied to a specific event, occasion, or external deadline that isn't yet captured? (e.g. "learn guitar for a friend's birthday party" — the birthday IS the real deadline, and if it's missing that's worth asking.)
- Collaborators: does achieving this depend on coordinating with or being helped by someone else, and is that unclear?

If the objective is already well-specified, return zero questions. Otherwise return up to 3 short, targeted, specific questions — never generic filler.

Respond ONLY in valid JSON with no preamble:
{
  "questions": ["string", ...]
}`

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { questions: string[] }

    const source = `${body.title} ${body.outcome}`.toLowerCase()
    const relevant = (parsed.questions ?? []).filter(q => {
      const words = q.toLowerCase().match(/[a-z]{5,}/g) ?? []
      return words.some(w => source.includes(w))
    })

    return NextResponse.json({ questions: relevant.slice(0, 3) })
  } catch (err) {
    console.error('Objective assessment failed:', err)
    // Clarifying questions are a nice-to-have — fail open with none rather
    // than blocking objective creation.
    return NextResponse.json({ questions: [] })
  }
}
