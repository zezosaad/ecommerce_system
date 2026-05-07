import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from '../../src/modules/auth/permissions.guard';
import { PERMISSIONS_KEY } from '../../src/modules/auth/decorators/permissions.decorator';
import { ErrorCode } from '../../src/modules/common/errors/error-codes';
import type { AuthContext } from '../../src/modules/auth/auth-context.service';
import { EffectivePermissionsService } from '../../src/modules/auth/effective-permissions.service';
import { AuditService } from '../../src/modules/audit/audit.service';

function makeReflector(permissionsMetadata: string[] | undefined): Reflector {
  return {
    getAllAndOverride: <T,>(key: string) => {
      if (key === PERMISSIONS_KEY) return permissionsMetadata as T;
      return undefined as T;
    },
    get: <T,>(key: string) => {
      if (key === PERMISSIONS_KEY) return permissionsMetadata as T;
      return undefined as T;
    },
  } as unknown as Reflector;
}

function makeExecutionContext(authContext?: AuthContext, userId = 'test-user-id'): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId ? { sub: userId } : null,
        authContext,
        headers: { 'x-correlation-id': 'test-correlation' },
        ip: '127.0.0.1',
        method: 'GET',
        path: '/test',
      }),
    }),
  } as unknown as ExecutionContext;
}

const ctx = (perms: string[], isSuperAdmin = false) =>
  ({
    userId: 'test-user-id',
    permissions: new Set(perms),
    isSuperAdmin,
    roles: [],
  } as unknown as AuthContext);

function makeAuditService(): AuditService {
  return { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

describe('PermissionsGuard', () => {
  let mockPermissionsService: Partial<EffectivePermissionsService>;

  beforeEach(() => {
    mockPermissionsService = {
      getForUser: vi.fn().mockResolvedValue({
        permissions: new Set<string>(),
        isSuperAdmin: false,
      }),
    };
  });

  it('allows when no @Permissions metadata is present', async () => {
    const guard = new PermissionsGuard(
      makeReflector(undefined),
      mockPermissionsService as EffectivePermissionsService,
      makeAuditService(),
    );
    await expect(
      guard.canActivate(makeExecutionContext(ctx([]))),
    ).resolves.toBe(true);
  });

  it('allows on exact-match permission', async () => {
    mockPermissionsService.getForUser = vi.fn().mockResolvedValue({
      permissions: new Set(['platform.settings.read']),
      isSuperAdmin: false,
    });

    const guard = new PermissionsGuard(
      makeReflector(['platform.settings.read']),
      mockPermissionsService as EffectivePermissionsService,
      makeAuditService(),
    );
    await expect(
      guard.canActivate(makeExecutionContext(ctx(['platform.settings.read']))),
    ).resolves.toBe(true);
  });

  it('allows on wildcard permission match (research R1)', async () => {
    mockPermissionsService.getForUser = vi.fn().mockResolvedValue({
      permissions: new Set(['merchant.products.*']),
      isSuperAdmin: false,
    });

    const guard = new PermissionsGuard(
      makeReflector(['merchant.products.create']),
      mockPermissionsService as EffectivePermissionsService,
      makeAuditService(),
    );
    await expect(
      guard.canActivate(makeExecutionContext(ctx(['merchant.products.*']))),
    ).resolves.toBe(true);
  });

  it('denies with AUTHZ.PERMISSION_DENIED when permission absent', async () => {
    mockPermissionsService.getForUser = vi.fn().mockResolvedValue({
      permissions: new Set(['platform.settings.read']),
      isSuperAdmin: false,
    });

    const guard = new PermissionsGuard(
      makeReflector(['platform.audit.read']),
      mockPermissionsService as EffectivePermissionsService,
      makeAuditService(),
    );

    await expect(
      guard.canActivate(makeExecutionContext(ctx(['platform.settings.read']))),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies when wildcard does not match the required scope', async () => {
    mockPermissionsService.getForUser = vi.fn().mockResolvedValue({
      permissions: new Set(['merchant.orders.*']),
      isSuperAdmin: false,
    });

    const guard = new PermissionsGuard(
      makeReflector(['merchant.products.read']),
      mockPermissionsService as EffectivePermissionsService,
      makeAuditService(),
    );

    await expect(
      guard.canActivate(makeExecutionContext(ctx(['merchant.orders.*']))),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies when authContext is absent (defense-in-depth)', async () => {
    const guard = new PermissionsGuard(
      makeReflector(['platform.settings.read']),
      mockPermissionsService as EffectivePermissionsService,
      makeAuditService(),
    );

    await expect(
      guard.canActivate(makeExecutionContext(undefined)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies when one of multiple required permissions is missing', async () => {
    mockPermissionsService.getForUser = vi.fn().mockResolvedValue({
      permissions: new Set(['platform.settings.read']),
      isSuperAdmin: false,
    });

    const guard = new PermissionsGuard(
      makeReflector(['platform.settings.read', 'platform.audit.read']),
      mockPermissionsService as EffectivePermissionsService,
      makeAuditService(),
    );

    await expect(
      guard.canActivate(
        makeExecutionContext(ctx(['platform.settings.read'])),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('PERMISSIONS_KEY is the documented metadata key', () => {
    expect(typeof PERMISSIONS_KEY).toBe('string');
  });
});
