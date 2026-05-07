import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-intl/middleware', () => ({
  default: () => (request: any) => {
    const locale = request.nextUrl.pathname.split('/')[1] || 'en';
    return new Response(null, {
      headers: { 'x-locale': locale, 'x-has-session': '0' },
    });
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

function NextResponseConstructor(body: unknown, init?: ResponseInit) {
  return new Response(
    typeof body === 'string' ? body : null,
    init ?? { status: 200 },
  ) as any;
}
NextResponseConstructor.redirect = (url: string | URL) => ({
  status: 307,
  url: typeof url === 'string' ? url : url.toString(),
  cookies: { set: vi.fn() },
});

vi.mock('next/server', () => ({
  NextResponse: NextResponseConstructor,
}));

function makeRequest(path: string) {
  const url = `http://localhost:3002${path}`;
  return {
    url,
    nextUrl: new URL(url),
    cookies: { getAll: () => [] },
    headers: new Map(),
  };
}

describe('website middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows anonymous public routes', async () => {
    const srrMock = await import('@supabase/ssr');
    (srrMock.createServerClient as any).mockImplementation(() => ({
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
      },
    }));

    const { middleware } = await import('../middleware');
    const request = makeRequest('/en/stores/my-store') as any;
    const result = await middleware(request);
    expect(result).toBeDefined();
  });

  it('redirects to login for account routes without session', async () => {
    const srrMock = await import('@supabase/ssr');
    (srrMock.createServerClient as any).mockImplementation(() => ({
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
      },
    }));

    const { middleware } = await import('../middleware');
    const request = makeRequest('/en/account') as any;
    const result = await middleware(request) as any;
    expect(result.url).toContain('/login');
  });

  it('returns 404 for admin paths', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/en/admin') as any;
    const result = await middleware(request);
    expect((result as Response).status).toBe(404);
  });

  it('returns 404 for dashboard paths', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/en/dashboard') as any;
    const result = await middleware(request);
    expect((result as Response).status).toBe(404);
  });

  it('returns 404 for manage paths', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/en/manage') as any;
    const result = await middleware(request);
    expect((result as Response).status).toBe(404);
  });
});
