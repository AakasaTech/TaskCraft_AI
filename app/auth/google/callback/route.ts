import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  // Read one-time cookies
  const storedState  = request.cookies.get('g_oauth_state')?.value
  const codeVerifier = request.cookies.get('g_oauth_verifier')?.value
  const next         = request.cookies.get('g_oauth_next')?.value ?? '/dashboard'

  const clearCookies = (res: NextResponse) => {
    for (const name of ['g_oauth_state', 'g_oauth_verifier', 'g_oauth_nonce', 'g_oauth_next']) {
      res.cookies.set(name, '', { maxAge: 0, path: '/' })
    }
    return res
  }

  const loginError = (msg: string) => {
    const url = new URL('/login', base)
    url.searchParams.set('error', msg)
    return clearCookies(NextResponse.redirect(url))
  }

  if (error) return loginError('Google sign-in was cancelled.')

  if (!code || !state || !storedState || !codeVerifier) {
    return loginError('Missing authentication parameters. Please try again.')
  }

  if (state !== storedState) {
    return loginError('Invalid authentication state. Please try again.')
  }

  // Exchange authorisation code → tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${base}/auth/google/callback`,
      grant_type:    'authorization_code',
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text()
    console.error('[google/callback] token exchange failed:', detail)
    return loginError('Failed to complete Google sign-in. Please try again.')
  }

  const { id_token } = await tokenRes.json() as { id_token?: string }

  if (!id_token) return loginError('No identity token returned by Google.')

  // Verify token and extract user info via Google's tokeninfo endpoint
  const infoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`
  )

  if (!infoRes.ok) {
    console.error('[google/callback] tokeninfo request failed:', infoRes.status)
    return loginError('Could not verify Google identity. Please try again.')
  }

  const info = await infoRes.json() as {
    email?:            string
    email_verified?:   string
    name?:             string
    picture?:          string
    aud?:              string
    error_description?: string
  }

  if (info.error_description) {
    console.error('[google/callback] tokeninfo error:', info.error_description)
    return loginError('Could not verify Google identity. Please try again.')
  }

  if (!info.email || info.email_verified !== 'true') {
    return loginError('Google account email is not verified.')
  }

  if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
    console.error('[google/callback] aud mismatch:', info.aud)
    return loginError('Invalid Google token. Please try again.')
  }

  // Create or sign in the user — no Supabase Google provider config required
  const admin = createAdminClient()
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type:  'magiclink',
    email: info.email,
    options: {
      data: {
        full_name:  info.name  ?? null,
        avatar_url: info.picture ?? null,
      },
    },
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('[google/callback] generateLink error:', linkError?.message)
    return loginError('Could not complete sign-in. Please try again.')
  }

  // Exchange the magic-link token for a real Supabase session
  const supabase = await createClient()
  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type:       'magiclink',
  })

  if (otpError) {
    console.error('[google/callback] verifyOtp error:', otpError.message)
    return loginError('Could not complete sign-in. Please try again.')
  }

  const res = NextResponse.redirect(new URL(next, base))
  return clearCookies(res)
}
