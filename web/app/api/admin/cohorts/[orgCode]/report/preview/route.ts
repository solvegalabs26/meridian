import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'

export const dynamic = 'force-dynamic'

// FF-022 Session 2: replace stub with generateCohortReport call
export async function GET(
  _req: NextRequest,
  { params }: { params: { orgCode: string } }
) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(
    { error: `Report generation not yet implemented for ${params.orgCode}. Build in Session 2.` },
    { status: 501 }
  )
}
