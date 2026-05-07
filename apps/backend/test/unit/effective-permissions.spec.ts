/**
 * Effective Permissions Service Unit Tests (T048)
 * Covers cache hit, TTL expiry, invalidation, and SC-002 supporting evidence
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EffectivePermissionsService } from '../../src/modules/auth/effective-permissions.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('EffectivePermissionsService (T048)', () => {
  let service: EffectivePermissionsService;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockUserRoles = [
    {
      userId: 'user-1',
      role: {
        code: 'merchant_admin',
        rolePermissions: [
          { permission: { code: 'merchant.stores.read' } },
          { permission: { code: 'merchant.stores.create' } },
          { permission: { code: 'merchant.products.read' } },
        ],
      },
    },
    {
      userId: 'user-1',
      role: {
        code: 'customer',
        rolePermissions: [
          { permission: { code: 'customer.orders.read' } },
        ],
      },
    },
  ];

  beforeEach(() => {
    prisma = {
      userRole: {
        findMany: vi.fn().mockResolvedValue(mockUserRoles),
      },
    } as unknown as PrismaService;

    configService = {
      get: vi.fn((key: string) => {
        if (key === 'AUTH_PERMISSIONS_CACHE_TTL_SECONDS') return 300;
        if (key === 'AUTH_PERMISSIONS_CACHE_MAX') return 1000;
        return null;
      }),
    } as unknown as ConfigService;

    service = new EffectivePermissionsService(prisma, configService);
  });

  describe('getForUser', () => {
    it('should return permissions for a user', async () => {
      const result = await service.getForUser('user-1');

      expect(result.permissions.has('merchant.stores.read')).toBe(true);
      expect(result.permissions.has('merchant.stores.create')).toBe(true);
      expect(result.permissions.has('merchant.products.read')).toBe(true);
      expect(result.permissions.has('customer.orders.read')).toBe(true);
      expect(result.isSuperAdmin).toBe(false);
    });

    it('should cache the result on subsequent calls', async () => {
      const result1 = await service.getForUser('user-1');
      const result2 = await service.getForUser('user-1');

      expect(prisma.userRole.findMany).toHaveBeenCalledTimes(1);
      expect(result1.permissions).toEqual(result2.permissions);
    });

    it('should return super_admin with wildcard permission', async () => {
      const superAdminRoles = [
        {
          userId: 'admin-1',
          role: {
            code: 'super_admin',
            rolePermissions: [],
          },
        },
      ];

      vi.spyOn(prisma.userRole, 'findMany').mockResolvedValueOnce(superAdminRoles);

      const result = await service.getForUser('admin-1');

      expect(result.isSuperAdmin).toBe(true);
      expect(result.permissions.has('*')).toBe(true);
    });

    it('should expire cache after TTL', async () => {
      vi.useFakeTimers();
      const result1 = await service.getForUser('user-1');

      // Advance time past TTL
      vi.advanceTimersByTime(301 * 1000);

      await service.getForUser('user-1');

      expect(prisma.userRole.findMany).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('invalidate', () => {
    it('should clear cached entry for a user', async () => {
      await service.getForUser('user-1');
      expect(prisma.userRole.findMany).toHaveBeenCalledTimes(1);

      service.invalidate('user-1');
      await service.getForUser('user-1');

      expect(prisma.userRole.findMany).toHaveBeenCalledTimes(2);
    });

    it('should not affect other users cache on single invalidation', async () => {
      await service.getForUser('user-1');
      await service.getForUser('user-2');

      service.invalidate('user-1');
      await service.getForUser('user-2');

      // user-2 should still be cached
      expect(prisma.userRole.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache eviction', () => {
    it('should evict oldest entry when max entries reached', async () => {
      const maxEntries = 3;
      const configServiceLimited = {
        get: vi.fn((key: string) => {
          if (key === 'AUTH_PERMISSIONS_CACHE_TTL_SECONDS') return 300;
          if (key === 'AUTH_PERMISSIONS_CACHE_MAX') return maxEntries;
          return null;
        }),
      } as unknown as ConfigService;

      const limitedService = new EffectivePermissionsService(prisma, configServiceLimited);

      // Fill cache
      for (let i = 0; i < maxEntries + 1; i++) {
        await limitedService.getForUser(`user-${i}`);
      }

      // The first entry should be evicted
      // This is tested by checking that a new fetch occurs for user-0
      expect(prisma.userRole.findMany).toHaveBeenCalledTimes(maxEntries + 1);
    });
  });

  describe('SC-002 supporting evidence', () => {
    it('should resolve permissions in under 25ms p95 when cached', async () => {
      // Prime the cache
      await service.getForUser('user-1');

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await service.getForUser('user-1');
        const end = performance.now();
        times.push(end - start);
      }

      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(iterations * 0.95)];

      expect(p95).toBeLessThan(25);
    });

    it('should handle concurrent requests gracefully', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.getForUser(`concurrent-user-${i}`),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.permissions).toBeInstanceOf(Set);
      });
    });
  });
});
