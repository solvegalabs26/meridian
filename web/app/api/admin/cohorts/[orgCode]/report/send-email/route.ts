import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'
import { generateCohortReport } from '@/lib/reporting/generateCohortReport'

export const dynamic = 'force-dynamic'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'jason@solvega.ai'

export async function POST(
  _req: NextRequest,
  { params }: { params: { orgCode: string } }
) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const service = createServiceClient()
  const orgCode = params.orgCode.toUpperCase()

  // Load config for recipient list + org name
  const { data: config, error: configErr } = await service
    .from('cohort_report_configs')
    .select('org_name, recipient_emails, delivery_email')
    .eq('org_code', orgCode)
    .single()

  if (configErr || !config) {
    return NextResponse.json({ error: `No config for ${orgCode}` }, { status: 400 })
  }
  if (!config.delivery_email) {
    return NextResponse.json({ error: 'Email delivery not enabled for this org' }, { status: 400 })
  }

  const recipients = (config.recipient_emails as string[] | null) ?? []
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No recipient emails configured' }, { status: 400 })
  }

  try {
    const pdfBuffer = await generateCohortReport(service, orgCode)
    const orgName = config.org_name as string
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const filename = `MeridianArc_${orgName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <div style="background: #0B1829; padding: 24px 28px; border-radius: 12px; margin-bottom: 24px;">
          <p style="font-size: 10px; color: #C9A84C; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 6px;">Meridian Arc · Outcome Intelligence</p>
          <h1 style="font-size: 20px; color: #fff; margin: 0;">${orgName}</h1>
          <p style="font-size: 12px; color: rgba(255,255,255,0.6); margin: 4px 0 0;">Cohort Report · ${dateStr}</p>
        </div>
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          Your latest Meridian Arc cohort report is attached. It covers objective tracking, confidence trends, and engagement data for your organization's fellows over the past 30 days.
        </p>
        <p style="font-size: 12px; color: #9CA3AF; margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E7EB;">
          Data shared under ${orgName} × Meridian Arc partnership agreement. Individual data anonymized. · <a href="https://meridianarc.ai" style="color: #8098B4;">meridianarc.ai</a>
        </p>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Meridian Arc <${FROM_EMAIL}>`,
        to: recipients,
        subject: `${orgName} Cohort Report · ${dateStr}`,
        html,
        attachments: [{
          filename,
          content: pdfBuffer.toString('base64'),
        }],
      }),
    })

    if (!emailRes.ok) {
      const resErr = await emailRes.text()
      console.error('[send-email] Resend error:', resErr)
      return NextResponse.json({ error: 'Email delivery failed', detail: resErr }, { status: 502 })
    }

    // Update last_sent_at
    await service
      .from('cohort_report_configs')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('org_code', orgCode)

    return NextResponse.json({ success: true, recipients })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[send-email]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
