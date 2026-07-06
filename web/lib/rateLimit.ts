// Lightweight in-memory rate limiter keyed by arbitrary string (e.g. IP).
// Uses a sliding window: each entry tracks a list of timestamps; attempts
// older than the window are pruned on every check.
//
// Good enough for pre-launch anti-spam. Replace with Redis/KV for production
// scale where requests may land on different function instances.

const store = new Map<string, number[]>()

// Prune once in a while to avoid memory growth from many unique IPs.
let pruneAt = Date.now() + 5 * 60 * 1000

function maybePrune(windowMs: number) {
  const now = Date.now()
  if (now < pruneAt) return
  pruneAt = now + 5 * 60 * 1000
  const cutoff = now - windowMs
  store.forEach((times, key) => {
    const fresh = times.filter(t => t > cutoff)
    if (fresh.length === 0) store.delete(key)
    else store.set(key, fresh)
  })
}

/**
 * Returns true if the key is within the allowed rate, false if it's over limit.
 * When allowed, records the attempt.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  maybePrune(windowMs)
  const now = Date.now()
  const cutoff = now - windowMs
  const times = (store.get(key) ?? []).filter(t => t > cutoff)
  if (times.length >= limit) return false
  times.push(now)
  store.set(key, times)
  return true
}
