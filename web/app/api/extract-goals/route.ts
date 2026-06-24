import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient } from '@/lib/anthropic/client'

export const dynamic = 'force-dynamic'

export interface ExtractedGoal {
  title: string
  category: 'Career/Aviation' | 'Finance' | 'Health' | 'Business' | 'Travel' | 'Home' | 'Lifestyle'
  outcome: string
  target_date: string | null
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { text: string }
  if (!body.text?.trim()) return NextResponse.json({ error: 'Text is required' }, { status: 400 })

  const prompt = `You are helping a user set up their Meridian objective tracking profile.

The user has shared this description of themselves and their goals:
"${body.text}"

Extract up to 6 clear, distinct life objectives from this text. For each objective:
- Write a concise title (5-8 words)
- Choose the best category from: Career/Aviation, Finance, Health, Business, Travel, Home, Lifestyle
- Write an outcome statement starting with "I will have..." that is specific and measurable
- Estimate a target date if mentioned or implied (YYYY-MM-DD format), otherwise null

Respond ONLY in valid JSON with no preamble:
{
  "goals": [
    {
      "title": "string",
      "category": "Health",
      "outcome": "I will have...",
      "target_date": "2026-08-31" or null
    }
  ]
}`

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { goals: ExtractedGoal[] }

    return NextResponse.json({ goals: parsed.goals ?? [] })
  } catch (err) {
    console.error('Goal extraction failed:', err)
    return NextResponse.json({ error: 'Failed to extract goals' }, { status: 500 })
  }
}
