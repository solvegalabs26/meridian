import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateIcs } from '@/lib/calendar/generateIcs'
import { tierAtLeast } from '@/lib/tiers'

export const dynamic = 'force-dynamic'

// GET ?title=&start=&duration=&description=&location=
// Tier-gated: Accelerator+
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, account_type')
    .eq('id', user.id)
    .single()

  if (!tierAtLeast({ tier: profile?.tier ?? null, account_type: profile?.account_type ?? null }, 'accelerator')) {
    return NextResponse.json({ error: 'Accelerator plan or above required for calendar export' }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const title = (params.get('title') ?? 'Meridian Action').slice(0, 200)
  const description = params.get('description') ? params.get('description')!.slice(0, 500) : undefined
  const location = params.get('location') ? params.get('location')!.slice(0, 200) : undefined
  const durationMinutes = Math.min(Math.max(parseInt(params.get('duration') ?? '30', 10) || 30, 1), 480)

  // Default start: tomorrow 9:00 UTC if none provided
  let start: Date
  const startParam = params.get('start')
  if (startParam) {
    const parsed = new Date(startParam)
    start = isNaN(parsed.getTime()) ? defaultStart() : parsed
  } else {
    start = defaultStart()
  }

  const icsContent = generateIcs({ title, description, start, durationMinutes, location })

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="meridian-action.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}

function defaultStart(): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(9, 0, 0, 0)
  return d
}
