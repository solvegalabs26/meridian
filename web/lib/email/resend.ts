const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'jason@solvega.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://meridianarc.ai'

export async function sendConfidenceAlert({
  toEmail,
  objectiveTitle,
  prevScore,
  newScore,
  delta,
}: {
  toEmail: string
  objectiveTitle: string
  prevScore: number
  newScore: number
  delta: number
}) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email')
    return
  }

  const direction = delta > 0 ? 'increased' : 'decreased'
  const arrow = delta > 0 ? '↑' : '↓'

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 13px; color: #8098B4; text-transform: uppercase; letter-spacing: 0.1em;">Meridian Arc · Confidence Alert</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 500; color: #1A1A2E; margin: 0 0 8px;">
        ${arrow} ${Math.abs(delta)} point${Math.abs(delta) !== 1 ? 's' : ''} ${direction}
      </h2>
      <p style="font-size: 14px; color: #4A5568; margin: 0 0 24px;">
        <strong>${objectiveTitle}</strong> confidence ${direction} from ${prevScore}% to ${newScore}% after your latest sweep.
      </p>
      <a href="${APP_URL}/objectives" style="display: inline-block; background: #0B1829; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500;">
        View scorecard →
      </a>
      <p style="font-size: 11px; color: #8098B4; margin-top: 32px;">
        Solvega Labs · meridianarc.ai · <a href="#" style="color: #8098B4;">Unsubscribe</a>
      </p>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Meridian Arc <${FROM_EMAIL}>`,
        to: toEmail,
        subject: `${arrow} ${objectiveTitle} confidence ${direction} to ${newScore}%`,
        html,
      }),
    })
  } catch (err) {
    console.error('Resend email failed:', err)
  }
}
