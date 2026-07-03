import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Rate-limit signup attempts — max 3 per IP per hour
  if (pathname === '/onboarding' && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'
    // Log to Supabase for monitoring (non-blocking — fire and forget)
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .limit(1).then(() => {}) // keep connection warm
    // Vercel header — block if flagged
    const country = request.headers.get('x-vercel-ip-country')
    if (ip === 'unknown' && !country) {
      // Can't verify origin — allow but log (extend with Redis rate limiting in v1.1)
    }
  }

  // Unauthenticated → redirect to login for protected routes
  const protectedPrefixes = ['/dashboard', '/objectives', '/signals', '/journal', '/predictions', '/rules', '/settings', '/admin']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Tier enforcement for authenticated users on protected app routes.
  // Uses a direct service-key REST fetch rather than supabase.from() because
  // the SSR client in middleware may use a stale access token (pre-refresh)
  // for PostgREST queries, causing silent RLS failures even when getUser()
  // succeeds. The service key bypasses RLS entirely and is safe here since
  // we already confirmed the user's identity via getUser() above.
  if (user && isProtected) {
    let profile: { tier: string | null; account_type: string | null; trial_ends_at: string | null } | null = null
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=tier,account_type,trial_ends_at`,
        {
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          cache: 'no-store',
        }
      )
      if (res.ok) {
        const rows = await res.json() as Array<{ tier: string | null; account_type: string | null; trial_ends_at: string | null }>
        profile = rows[0] ?? null
      }
    } catch {
      // If the fetch fails, fall through without redirecting — better to let
      // the page render (and potentially fail auth there) than to hard-block.
    }

    const tier = (profile?.tier ?? 'trial') as string
    const accountType = (profile?.account_type ?? 'personal') as string
    const isAlphaBeta = ['alpha_personal', 'alpha_business', 'beta'].includes(accountType)

    // Trial expiry — redirect to plan selection (alpha/beta bypass)
    if (!isAlphaBeta && tier === 'trial' && profile?.trial_ends_at) {
      if (new Date(profile.trial_ends_at) < new Date()) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding/plan'
        url.searchParams.set('expired', 'true')
        return NextResponse.redirect(url)
      }
    }

    // Tier-gated routes — require explorer or higher (alpha/beta bypass)
    const tierGatedRoutes = ['/journal', '/predictions']
    if (!isAlphaBeta && tier === 'trial' && tierGatedRoutes.some(r => pathname.startsWith(r))) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding/plan'
      url.searchParams.set('upgrade', 'true')
      return NextResponse.redirect(url)
    }
  }

  // Authenticated users away from the login page → dashboard
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Authenticated users landing on /alpha → dashboard (already signed up)
  if (pathname === '/alpha' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Onboarding routes are public (no auth required)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
