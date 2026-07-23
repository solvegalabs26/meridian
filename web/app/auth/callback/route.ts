import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const { searchParams } = requestUrl
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin))
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'signup' | 'magiclink',
    })
    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin))
    }
  } else {
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin))
  }

  const next = type === 'recovery' ? '/reset-password' : (searchParams.get('next') ?? '/dashboard')
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
