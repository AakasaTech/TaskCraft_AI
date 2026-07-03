import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  if (error) {
    const url = new URL('/login', base);
    url.searchParams.set('error', errorDescription ?? 'Authentication failed.');
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login', base));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const url = new URL('/login', base);
    url.searchParams.set('error', 'Could not verify your link. Please try again.');
    return NextResponse.redirect(url);
  }

  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', base));
  }

  return NextResponse.redirect(new URL(next, base));
}
