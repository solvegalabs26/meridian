import { createBrowserClient } from '@supabase/ssr'

// TODO: Configure Resend SMTP in Supabase Auth settings before
// re-enabling email confirmation for production launch.
// smtp.resend.com · port 465 · API key as password

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
      },
    }
  )
}
