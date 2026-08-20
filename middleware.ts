import { NextResponse } from 'next/server';
import { auth } from '@/auth.config';

const PUBLIC_PATHS  = ['/', '/pricing', '/faq', '/privacy', '/terms'];
const AUTH_PATHS    = ['/login', '/register', '/forgot-password', '/reset-password'];
const ADMIN_PATHS   = ['/admin'];

// All paths served by the (app) route group
const APP_PREFIXES = [
  '/dashboard',
  '/projects',
  '/tasks',
  '/time',
  '/reports',
  '/calendar',
  '/clients',
  '/invoices',
  '/ai',
  '/team',
  '/integrations',
  '/settings',
];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const user = request.auth?.user;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/paypal') ||
    pathname.startsWith('/api/v1') ||
    pathname.startsWith('/api/supportcraft/webhook') ||
    pathname.startsWith('/api/webhooks');

  if (isPublic) {
    return NextResponse.next();
  }

  const isAuth  = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isApp   = APP_PREFIXES.some((p) => pathname.startsWith(p));

  if ((isApp || isAdmin) && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuth && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
