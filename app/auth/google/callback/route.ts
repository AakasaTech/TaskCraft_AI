import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  // Read & clear one-time cookies
  const storedState  = request.cookies.get('g_oauth_state')?.value
  const codeVerifier = request.cookies.get('g_oauth_verifier')?.value
  const rawNonce     = request.cookies.get('g_oauth_nonce')?.value
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

  if (!code || !state || !storedState || !codeVerifier || !rawNonce) {
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

  // Sign in to Supabase via Google ID token
  const supabase = await createClient()
  const { error: sbError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token:    id_token,
    nonce:    rawNonce,
  })

  if (sbError) {
    console.error('[google/callback] supabase signInWithIdToken:', sbError.message)
    return loginError('Could not complete sign-in. Please try again.')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return loginError('Authentication failed. Please try again.')

  const res = NextResponse.redirect(new URL(next, base))
  return clearCookies(res)
}
