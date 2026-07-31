'use server'

import type { IngestSummary } from '@/lib/enterprise/types'

export type IngestActionResult =
  | { ok: true; summary: IngestSummary }
  | { ok: false; error: string }

export async function runIngest(formData: FormData): Promise<IngestActionResult> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // VERCEL_URL is auto-set by Vercel to the current deployment URL (without protocol).
  // This ensures preview deployments call themselves, not production.
  // Fallback: NEXT_PUBLIC_APP_URL (Vercel dashboard env var) then localhost.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

  try {
    const response = await fetch(`${baseUrl}/api/enterprise/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}` },
      body: formData,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const msg = (err as { error?: string }).error
      if (response.status === 404) {
        return { ok: false, error: 'Institution not found. Verify the institution exists in Supabase.' }
      }
      if (response.status === 401) {
        return { ok: false, error: 'Authorization error. Contact Jason.' }
      }
      return { ok: false, error: msg || `Ingest failed: ${response.status}` }
    }

    const summary = (await response.json()) as IngestSummary
    // Ensure failed_rows is always an array even if the API returns null
    summary.failed_rows = summary.failed_rows ?? []
    return { ok: true, summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isNetwork = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('ENOTFOUND')
    return {
      ok: false,
      error: isNetwork
        ? `Could not reach ingest route at ${baseUrl}. Check VERCEL_URL or NEXT_PUBLIC_APP_URL.`
        : msg,
    }
  }
}
