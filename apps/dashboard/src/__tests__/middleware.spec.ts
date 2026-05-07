import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-intl/middleware', () => ({
  default: () => (request: any) => {
    const locale = request.nextUrl.pathname.split('/')[1] || 'en';
    return new Response(null, {
      headers: { 'x-locale': locale },
    });
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
    },
  })),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: string | URL) => ({
      status: 307,
      url: typeof url === 'string' ? url : url.toString(),
      cookies: { set: vi.fn() },
    }),
  },
}));

function makeRequest(path: string) {
  const url = `http://localhost:3000${path}`;
  return {
    url,
    nextUrl: new URL(url),
    cookies: { getAll: () => [] },
    headers: new Map(),
  };
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows public auth paths without session', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/en/login') as any;
    const result = await middleware(request);
    expect(result).toBeDefined();
  });

  it('passes through middleware for valid requests', async () => {
    const mockSession = { access_token: 'test-token' };
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: mockSession },
    });

    const mockCreateServerClient = vi.fn(() => ({
      auth: { getSession: mockGetSession },
    }));
    const srrMock = await import('@supabase/ssr');
    (srrMock.createServerClient as any).mockImplementation(
      mockCreateServerClient,
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            status: 'active',
            isSuperAdmin: true,
            roles: [{ key: 'super_admin' }],
          },
        }),
    });
    global.fetch = mockFetch;

    const { middleware } = await import('../middleware');
    const request = makeRequest('/en/roles') as any;
    const result = await middleware(request);

    expect(result).toBeDefined();
  });

  it('redirects to suspended page for non-active user', async () => {
    const mockSession = { access_token: 'test-token' };
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: mockSession },
    });

    const mockCreateServerClient = vi.fn(() => ({
      auth: { getSession: mockGetSession },
    }));
    const srrMock = await import('@supabase/ssr');
    (srrMock.createServerClient as any).mockImplementation(
      mockCreateServerClient,
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            status: 'suspended',
            isSuperAdmin: false,
            roles: [{ key: 'customer' }],
          },
        }),
    });
    global.fetch = mockFetch;

    const { middleware } = await import('../middleware');
    const request = makeRequest('/en/roles') as any;
    const result = await middleware(request);

    expect(result).toBeDefined();
    expect(result.url).toContain('/suspended');
  });
});
