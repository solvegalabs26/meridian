'use server'

import type { IngestSummary } from '@/lib/enterprise/types'

export async function runIngest(formData: FormData): Promise<IngestSummary> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const response = await fetch(`${baseUrl}/api/enterprise/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}` },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = (err as { error?: string }).error
    if (response.status === 404) throw new Error('Institution not found. Verify the institution exists in Supabase.')
    if (response.status === 401) throw new Error('Authorization error. Contact Jason.')
    throw new Error(msg || `Ingest failed: ${response.status}`)
  }

  return response.json() as Promise<IngestSummary>
}
