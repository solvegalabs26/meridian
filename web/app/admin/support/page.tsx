import { createServiceClient } from '@/lib/supabase/server'
import SupportInboxClient from './SupportInboxClient'

export const dynamic = 'force-dynamic'

export default async function SupportPage() {
  const adminClient = createServiceClient()
  const { data: messages } = await adminClient
    .from('support_messages')
    .select('*')
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)

  return <SupportInboxClient messages={messages ?? []} />
}
