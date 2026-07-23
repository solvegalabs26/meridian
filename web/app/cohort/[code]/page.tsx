import { redirect } from 'next/navigation'

export default function CohortRedirectPage({ params }: { params: { code: string } }) {
  redirect(`/alpha?code=${encodeURIComponent(params.code)}`)
}
