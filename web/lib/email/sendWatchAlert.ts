const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'jason@solvega.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://meridianarc.ai'

export async function sendWatchAlert({
  to,
  objectiveTitle,
  signalSummary,
  actionText,
  directUrl,
}: {
  to: string
  objectiveTitle: string
  signalSummary: string
  actionText: string
  directUrl: string | null
}) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping watch alert email')
    return
  }

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #C9A227; padding: 20px 24px;">
        <span style="font-size: 13px; font-weight: 700; color: #0A1628; text-transform: uppercase; letter-spacing: 0.08em;">
          ⚠ Meridian Alert
        </span>
      </div>
      <div style="padding: 28px 24px; background: #0A1628;">
        <h2 style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 16px; font-family: 'EB Garamond', Georgia, serif;">
          ${objectiveTitle}
        </h2>
        <p style="font-size: 14px; color: #A8BCCF; margin: 0 0 20px; line-height: 1.6;">
          ${signalSummary}
        </p>
        <div style="border-left: 3px solid #C9A227; padding: 12px 16px; margin-bottom: 24px; background: rgba(201,162,39,0.08);">
          <p style="font-size: 11px; color: #C9A227; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 4px;">Action required</p>
          <p style="font-size: 13px; color: #ffffff; margin: 0;">${actionText}</p>
        </div>
        ${directUrl ? `
        <a href="${directUrl}" style="display: inline-block; background: #C9A227; color: #0A1628; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-bottom: 24px;">
          View source →
        </a>
        ` : ''}
        <p style="font-size: 11px; color: #506070; margin: 24px 0 0; line-height: 1.6; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">
          This alert fired because a watched source for this objective changed state.<br>
          Manage your watch sources at <a href="${APP_URL}" style="color: #8098B4;">${APP_URL.replace(/^https?:\/\//, '')}</a>
        </p>
      </div>
    </div>
  `

  const text = [
    'MERIDIAN ALERT',
    objectiveTitle,
    '',
    signalSummary,
    '',
    'ACTION REQUIRED:',
    actionText,
    '',
    ...(directUrl ? [directUrl, ''] : []),
    '—',
    'This alert fired because a watched source for this objective changed state.',
    `Manage your watch sources at ${APP_URL}`,
  ].join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Meridian Arc <${FROM_EMAIL}>`,
        to,
        subject: `⚠ Meridian Alert — ${objectiveTitle}`,
        html,
        text,
      }),
    })
    if (!res.ok) {
      console.error('sendWatchAlert: Resend API error', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('sendWatchAlert: fetch failed', err)
  }
}
