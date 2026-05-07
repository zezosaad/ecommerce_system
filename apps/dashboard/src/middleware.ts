import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

const PUBLIC_AUTH_PATHS = ['/login', '/unauthorized', '/suspended'];

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const locale = request.nextUrl.pathname.split('/')[1] || 'en';
  response.headers.set('x-locale', locale);

  const pathname = request.nextUrl.pathname.replace(`/${locale}`, '') || '/';
  if (PUBLIC_AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return response;
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

  // Use getUser() (verifies the token against Supabase) rather than
  // getSession() which only parses the cookie locally and would accept a
  // forged/expired JWT until the backend rejects it.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('return', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // We still need an access_token to call the backend; getSession() is fine
  // here because we already verified the user above.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('return', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    const meRes = await fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!meRes.ok) {
      if (meRes.status === 401) {
        const loginUrl = new URL(`/${locale}/login`, request.url);
        return NextResponse.redirect(loginUrl);
      }

      if (meRes.status === 403) {
        // PROFILE_BLOCKED → suspended page. Other 403 codes (no roles,
        // pending verification) also land here as "not allowed in dashboard".
        const suspendedUrl = new URL(`/${locale}/suspended`, request.url);
        return NextResponse.redirect(suspendedUrl);
      }

      // Backend reachable but failed for some other reason — don't claim
      // "suspended" misleadingly; bounce to login and let the user retry.
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }

    const { data: envelope } = await meRes.json();

    if (envelope.status !== 'active') {
      const suspendedUrl = new URL(`/${locale}/suspended`, request.url);
      return NextResponse.redirect(suspendedUrl);
    }

    const hasNonCustomerRole =
      envelope.isSuperAdmin ||
      envelope.roles.some((r: { key: string }) => r.key !== 'customer');

    if (!hasNonCustomerRole) {
      // FR-040 / SC-008: customer-only users land on the dashboard's own
      // Unauthorized page (NOT a redirect to a different host).
      const unauthorizedUrl = new URL(
        `/${locale}/unauthorized`,
        request.url,
      );
      return NextResponse.redirect(unauthorizedUrl);
    }

    // The full envelope is intentionally NOT placed in a response header —
    // it would leak PII and roles to anything between the proxy and the
    // browser. The protected layout fetches the envelope server-side.
  } catch {
    // Network error reaching the backend — bounce to login (avoid the
    // misleading "suspended" page).
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
