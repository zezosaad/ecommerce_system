import { describe, it, expect, vi } from 'vitest';
import { HealthService } from '../../src/modules/health/health.service';
import { ErrorCode } from '../../src/modules/common/errors/error-codes';

interface FakePrisma {
  $queryRaw: ReturnType<typeof vi.fn>;
}

interface FakeJwks {
  isHealthy: ReturnType<typeof vi.fn>;
  isDegraded: ReturnType<typeof vi.fn>;
}

function makeHealth(
  dbOk: boolean,
  jwksHealthy: boolean,
  jwksDegraded: boolean,
): { svc: HealthService; prisma: FakePrisma; jwks: FakeJwks } {
  const prisma: FakePrisma = {
    $queryRaw: dbOk
      ? vi.fn().mockResolvedValue([{ '?column?': 1 }])
      : vi.fn().mockRejectedValue(new Error('connection refused')),
  };
  const jwks: FakeJwks = {
    isHealthy: vi.fn().mockReturnValue(jwksHealthy),
    isDegraded: vi.fn().mockReturnValue(jwksDegraded),
  };
  return { svc: new HealthService(prisma as never, jwks as never), prisma, jwks };
}

describe('HealthService — Supabase degradation policy (research R5)', () => {
  it('returns status=ok when DB and JWKS are healthy', async () => {
    const { svc } = makeHealth(true, true, false);
    const result = await svc.check();
    expect(result.status).toBe('ok');
    expect(result.dependencies.db).toBe('healthy');
    expect(result.dependencies.auth).toBe('healthy');
  });

  it('returns status=unhealthy + db=unhealthy when Postgres is unreachable', async () => {
    const { svc } = makeHealth(false, true, false);
    const result = await svc.check();
    expect(result.status).toBe('unhealthy');
    expect(result.dependencies.db).toBe('unhealthy');
  });

  it('returns status=degraded + auth=degraded when JWKS refresh failed but cache is still valid', async () => {
    const { svc } = makeHealth(true, false, true);
    const result = await svc.check();
    expect(result.status).toBe('degraded');
    expect(result.dependencies.auth).toBe('degraded');
  });

  it('returns status=unhealthy + auth=unhealthy when JWKS cache is exhausted and refresh failed', async () => {
    const { svc } = makeHealth(true, false, false);
    const result = await svc.check();
    expect(result.status).toBe('unhealthy');
    expect(result.dependencies.auth).toBe('unhealthy');
  });

  it('reports search and cache as "unknown" in Phase 0 (forward-looking)', async () => {
    const { svc } = makeHealth(true, true, false);
    const result = await svc.check();
    expect(result.dependencies.search).toBe('unknown');
    expect(result.dependencies.cache).toBe('unknown');
  });

  it('returns a version string and uptime in seconds', async () => {
    const { svc } = makeHealth(true, true, false);
    const result = await svc.check();
    expect(typeof result.version).toBe('string');
    expect(result.uptime_seconds).toBeGreaterThanOrEqual(0);
  });
});

describe('Error contract for Supabase outages (research R5)', () => {
  it('exposes SERVICE_UNAVAILABLE_DB for Postgres outage', () => {
    expect(ErrorCode.SERVICE_UNAVAILABLE_DB).toBe('SERVICE_UNAVAILABLE_DB');
  });
  it('exposes SERVICE_UNAVAILABLE_AUTH for Supabase Auth outage with cache exhausted', () => {
    expect(ErrorCode.SERVICE_UNAVAILABLE_AUTH).toBe('SERVICE_UNAVAILABLE_AUTH');
  });
  it('exposes SERVICE_UNAVAILABLE_STORAGE (forward-looking, Phase 0 not exercised)', () => {
    expect(ErrorCode.SERVICE_UNAVAILABLE_STORAGE).toBe('SERVICE_UNAVAILABLE_STORAGE');
  });
});
