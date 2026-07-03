import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookie setting handled by middleware
          }
        },
      },
    }
  )
}

// Service role client — bypasses RLS, server-side only.
//
// Deliberately NOT built on createServerClient/@supabase/ssr: that helper
// is cookie-session-aware by design, and when a real user session cookie
// is present (e.g. an admin route called from the admin's own logged-in
// browser), it transparently uses that session's access token for the
// Authorization header on requests instead of the service-role key handed
// to it — silently downgrading every "service client" query back to that
// user's own RLS scope. Caught this via bulk-sweep cohort resolution only
// returning the calling admin's own profile row instead of every profile.
// A plain @supabase/supabase-js client has no cookie/session handling at
// all, so it always authenticates as the service role, regardless of
// what's in the request's cookies.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
