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

  const trialPrefix = 'Sent from your Twilio trial account - '
  const body = process.env.TWILIO_TRIAL_MODE === 'true'
    ? `${trialPrefix}MERIDIAN ALERT — ${objectiveTitle}: ${signalSummary} ACTION: ${actionText}`
    : [
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
