import webpush from 'web-push'

export async function sendPushAlert({
  subscription,
  objectiveTitle,
  signalSummary,
  actionText,
}: {
  subscription: webpush.PushSubscription
  objectiveTitle: string
  signalSummary: string
  actionText: string
}): Promise<void> {
  // Initialise lazily so missing VAPID keys don't crash the module at import time.
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const payload = JSON.stringify({
    title: `⚠ Meridian Alert — ${objectiveTitle}`,
    body: `${signalSummary}\n\nACTION: ${actionText}`,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
  })

  try {
    await webpush.sendNotification(subscription, payload)
  } catch (err) {
    console.error('[sendPushAlert] web-push error:', err)
  }
}
