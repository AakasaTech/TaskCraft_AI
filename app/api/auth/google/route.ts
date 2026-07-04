import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const next = searchParams.get('next') ?? '/dashboard'

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  // PKCE
  const codeVerifier  = b64url(crypto.randomBytes(32))
  const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest())

  // State — CSRF protection
  const state = b64url(crypto.randomBytes(16))

  // Nonce — stored raw, sent hashed; Supabase rehashes as hex(sha256(raw)) to verify
  const rawNonce    = b64url(crypto.randomBytes(16))
  const hashedNonce = crypto.createHash('sha256').update(rawNonce).digest('hex')

  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleUrl.searchParams.set('client_id',             clientId)
  googleUrl.searchParams.set('redirect_uri',          `${base}/auth/google/callback`)
  googleUrl.searchParams.set('response_type',         'code')
  googleUrl.searchParams.set('scope',                 'openid email profile')
  googleUrl.searchParams.set('code_challenge',        codeChallenge)
  googleUrl.searchParams.set('code_challenge_method', 'S256')
  googleUrl.searchParams.set('state',                 state)
  googleUrl.searchParams.set('nonce',                 hashedNonce)
  googleUrl.searchParams.set('access_type',           'offline')
  googleUrl.searchParams.set('prompt',                'consent')

  const response = NextResponse.redirect(googleUrl.toString())

  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   600, // 10 minutes
    path:     '/',
  }
  response.cookies.set('g_oauth_verifier', codeVerifier, cookieOpts)
  response.cookies.set('g_oauth_state',    state,        cookieOpts)
  response.cookies.set('g_oauth_nonce',    rawNonce,     cookieOpts)
  response.cookies.set('g_oauth_next',     next,         cookieOpts)

  return response
}
