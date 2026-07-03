import { createClient } from '@/lib/supabase/server'

// TODO: replace with a real is_admin role/column check once the Admin
// Panel (Step 12 of the tech spec) is built. For now the only admin is
// Jason himself, gated by email — never trust a client-supplied flag.
export const ADMIN_EMAIL = 'solvegalabs@gmail.com'

// Checks the authenticated caller against the admin email. Returns the
// user if they're the admin, null otherwise (unauthenticated or wrong
// account) — callers should 404/redirect rather than reveal this route
// exists to a non-admin.
export async function requireAdminUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}
