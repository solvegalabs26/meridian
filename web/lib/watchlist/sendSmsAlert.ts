import twilio from 'twilio'

export async function sendSmsAlert({
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
  directUrl: string
}): Promise<void> {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  )

  const body = [
    `⚠ MERIDIAN ALERT — ${objectiveTitle}`,
    signalSummary,
    `ACTION: ${actionText}`,
    directUrl,
  ].join('\n\n')

  try {
    await client.messages.create({
      body,
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
    })
  } catch (err) {
    console.error('[sendSmsAlert] Twilio error:', err)
  }
}
