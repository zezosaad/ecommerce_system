import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

const ACCOUNT_PATHS = ['/account'];
const AUTH_PATHS = ['/login', '/register', '/reset-password', '/verify-email'];

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const locale = request.nextUrl.pathname.split('/')[1] || 'en';
  response.headers.set('x-locale', locale);

  const pathname = request.nextUrl.pathname.replace(`/${locale}`, '') || '/';

  if (pathname.startsWith('/admin') || pathname.startsWith('/dashboard') || pathname.startsWith('/manage')) {
    return new NextResponse(null, { status: 404, statusText: 'Not Found' });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();
  const hasSession = !!session;

  response.headers.set('x-has-session', hasSession ? '1' : '0');

  const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isAccountPath = ACCOUNT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isAuthPath && hasSession) {
    const accountUrl = new URL(`/${locale}/account`, request.url);
    return NextResponse.redirect(accountUrl);
  }

  if (isAccountPath && !hasSession) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('return', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
