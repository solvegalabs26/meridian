import webpush from 'web-push'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

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
