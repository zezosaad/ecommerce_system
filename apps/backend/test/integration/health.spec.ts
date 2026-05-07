import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthController } from '../../src/modules/health/health.controller';
import { HealthService } from '../../src/modules/health/health.service';
import { HttpStatus } from '@nestjs/common';

describe('HealthController (integration-light)', () => {
  let controller: HealthController;
  let service: { check: ReturnType<typeof vi.fn> };
  const response = {
    status: vi.fn(),
  };

  beforeEach(() => {
    response.status.mockReset();
    service = {
      check: vi.fn(async () => ({
        status: 'ok',
        version: '0.1.0+test',
        uptime_seconds: 12,
        dependencies: {
          db: 'healthy',
          auth: 'healthy',
          storage: 'unknown',
          search: 'unknown',
          cache: 'unknown',
        },
      })),
    };

    controller = new HealthController(service as unknown as HealthService);
  });

  it('returns a health envelope with required fields', async () => {
    const result = await controller.check(
      { requestId: 'test-req-id' } as never,
      response as never,
    );

    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('ok');
    expect(result.data.dependencies).toHaveProperty('db');
    expect(result.data.dependencies).toHaveProperty('auth');
    expect(result.meta.request_id).toBe('test-req-id');
  });

  it('dependency statuses are valid', async () => {
    const result = await controller.check(
      { requestId: 'test' } as never,
      response as never,
    );
    const validStatuses = ['healthy', 'degraded', 'unhealthy', 'unknown'];
    for (const dep of Object.values(result.data.dependencies)) {
      expect(validStatuses).toContain(dep);
    }
  });

  it('returns 503 when overall status is unhealthy', async () => {
    service.check.mockResolvedValueOnce({
      status: 'unhealthy',
      version: '0.1.0+test',
      uptime_seconds: 2,
      dependencies: {
        db: 'unhealthy',
        auth: 'healthy',
        storage: 'unknown',
        search: 'unknown',
        cache: 'unknown',
      },
    });

    const result = await controller.check(
      { requestId: 'test-req-id' } as never,
      response as never,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(result.data.status).toBe('unhealthy');
  });
});
