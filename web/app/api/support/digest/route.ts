import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const adminClient = createServiceClient()

    const { data: messages, error } = await adminClient
      .from('support_messages')
      .select('id, email, message, source, created_at')
      .eq('is_read', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!messages || messages.length === 0) {
      return NextResponse.json({ sent: false, count: 0 })
    }

    const rows = messages.map(m => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #1a2a3a;font-size:12px;color:#8AB4D4;">
          ${new Date(m.created_at).toLocaleString('en-US', { timeZone: 'America/Denver' })}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #1a2a3a;font-size:12px;">
          <a href="mailto:${m.email}" style="color:#C9A227;">${m.email}</a>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #1a2a3a;font-size:12px;color:#ccc;">
          ${m.message.length > 120 ? m.message.slice(0, 120) + '…' : m.message}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #1a2a3a;font-size:11px;color:#5090C0;">
          ${m.source}
        </td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<body style="background:#060F1A;color:#F7F6F3;font-family:Inter,sans-serif;padding:32px;">
  <div style="max-width:680px;margin:0 auto;">
    <div style="margin-bottom:24px;">
      <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#5090C0;margin-bottom:6px;">
        Meridian Arc · Support Digest
      </div>
      <div style="font-family:Georgia,serif;font-size:24px;color:#fff;">
        ${messages.length} new message${messages.length === 1 ? '' : 's'}
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px;">
        Last 24 hours · Unread only · ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #1a2a3a;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#0D1B2A;">
          <th style="padding:8px 12px;font-size:10px;color:rgba(255,255,255,.4);text-align:left;font-weight:500;">TIME (MT)</th>
          <th style="padding:8px 12px;font-size:10px;color:rgba(255,255,255,.4);text-align:left;font-weight:500;">FROM</th>
          <th style="padding:8px 12px;font-size:10px;color:rgba(255,255,255,.4);text-align:left;font-weight:500;">MESSAGE</th>
          <th style="padding:8px 12px;font-size:10px;color:rgba(255,255,255,.4);text-align:left;font-weight:500;">SOURCE</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/support"
         style="display:inline-block;padding:10px 24px;background:#C9A227;color:#0B1829;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">
        View in Admin Inbox →
      </a>
    </div>
    <div style="margin-top:24px;font-size:11px;color:rgba(255,255,255,.3);text-align:center;">
      Meridian Arc · Solvega Labs LLC · Daily at 07:00 UTC
    </div>
  </div>
</body>
</html>
    `

    await resend.emails.send({
      from: 'Meridian Arc <jason@solvega.ai>',
      to: 'jason@solvega.ai',
      subject: `[Meridian Support] ${messages.length} new message${messages.length === 1 ? '' : 's'}`,
      html,
    })

    return NextResponse.json({ sent: true, count: messages.length })

  } catch (err) {
    console.error('[FF-023] Digest error:', err)
    return NextResponse.json({ error: 'Digest failed' }, { status: 500 })
  }
}
