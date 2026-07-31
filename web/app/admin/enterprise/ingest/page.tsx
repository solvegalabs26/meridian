import { createServiceClient } from '@/lib/supabase/server'
import IngestClient from './IngestClient'

export const dynamic = 'force-dynamic'

export type Institution = {
  id: string
  slug: string
  name: string
  status: string
  dpa_signed_at: string | null
}

export default async function EnterpriseIngestPage() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('enterprise_institutions')
    .select('id, slug, name, status, dpa_signed_at')
    .order('name')

  const institutions: Institution[] = data ?? []

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text3)] mb-1">
          Meridian Fusion · Admin
        </p>
        <h1
          className="text-[24px] font-medium text-[var(--text)] leading-tight mb-1"
          style={{ fontFamily: "'EB Garamond', 'Georgia', serif" }}
        >
          Portfolio Data Ingestion
        </h1>
        <p className="text-[13px] text-[var(--text3)]">
          Upload a client CSV to write or refresh enterprise cases and origination snapshots.
        </p>
      </div>
      <IngestClient institutions={institutions} />
    </div>
  )
}
