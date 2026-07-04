import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/pricing', '/faq', '/privacy', '/terms'];
const AUTH_PATHS = ['/login', '/register', '/forgot-password'];
const ADMIN_PATHS = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2]),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/auth/');
  const isAuth = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isApp = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/time') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/clients') ||
    pathname.startsWith('/integrations') ||
    pathname.startsWith('/settings');

  if (isApp && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuth && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isAdmin && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
