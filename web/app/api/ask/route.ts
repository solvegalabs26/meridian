import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are Meridian Arc, an AI intelligence assistant. You have full context
on the user's objectives, confidence scores, and latest scan findings.
Answer questions about their goals in plain language. Be specific and direct.
Reference actual data from their objectives and scan results.
Never say 'I don't have information about that' if the data is in context.
Your reply renders in a plain chat bubble, not a document — write in short
plain paragraphs and sentences, no markdown headers, bold/italic asterisks,
or horizontal rules.`

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    message: string
    context?: { objectives?: unknown; latestSweep?: unknown }
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: JSON.stringify({
          question: body.message,
          objectives: body.context?.objectives ?? [],
          latest_sweep: body.context?.latestSweep ?? null,
        }),
      }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ response: responseText })
  } catch (err) {
    console.error('Ask error:', err)
    return NextResponse.json({ error: 'Could not reach Meridian Arc — please try again.' }, { status: 500 })
  }
}
