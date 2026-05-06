import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from '../../src/modules/auth/permissions.guard';
import { PERMISSIONS_KEY } from '../../src/modules/auth/decorators/permissions.decorator';
import { ErrorCode } from '../../src/modules/common/errors/error-codes';
import type { AuthContext } from '../../src/modules/auth/auth-context.service';

function makeReflector(metadata: string[] | undefined): Reflector {
  return {
    getAllAndOverride: <T,>() => metadata as T,
    get: <T,>() => metadata as T,
  } as unknown as Reflector;
}

function makeExecutionContext(authContext?: AuthContext): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ authContext }),
    }),
  } as unknown as ExecutionContext;
}

const ctx = (perms: string[]): AuthContext =>
  ({ permissions: perms } as AuthContext);

describe('PermissionsGuard', () => {
  it('allows when no @Permissions metadata is present', () => {
    const guard = new PermissionsGuard(makeReflector(undefined));
    expect(guard.canActivate(makeExecutionContext(ctx([])))).toBe(true);
  });

  it('allows on exact-match permission', () => {
    const guard = new PermissionsGuard(makeReflector(['platform.settings.read']));
    expect(
      guard.canActivate(makeExecutionContext(ctx(['platform.settings.read']))),
    ).toBe(true);
  });

  it('allows on wildcard permission match (research R1)', () => {
    const guard = new PermissionsGuard(makeReflector(['merchant.products.create']));
    expect(
      guard.canActivate(makeExecutionContext(ctx(['merchant.products.*']))),
    ).toBe(true);
  });

  it('denies with AUTHZ.PERMISSION_DENIED when permission absent', () => {
    const guard = new PermissionsGuard(makeReflector(['platform.settings.read']));
    try {
      guard.canActivate(makeExecutionContext(ctx(['platform.audit.read'])));
      expect.fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse() as {
        code: ErrorCode;
        message: string;
      };
      expect(body.code).toBe(ErrorCode.AUTHZ_PERMISSION_DENIED);
    }
  });

  it('denies when wildcard does not match the required scope', () => {
    const guard = new PermissionsGuard(makeReflector(['merchant.products.read']));
    try {
      guard.canActivate(makeExecutionContext(ctx(['merchant.orders.*'])));
      expect.fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
    }
  });

  it('denies when authContext is absent (defense-in-depth)', () => {
    const guard = new PermissionsGuard(makeReflector(['platform.settings.read']));
    try {
      guard.canActivate(makeExecutionContext(undefined));
      expect.fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse() as { code: ErrorCode };
      expect(body.code).toBe(ErrorCode.AUTHZ_PERMISSION_DENIED);
    }
  });

  it('denies when one of multiple required permissions is missing', () => {
    const guard = new PermissionsGuard(
      makeReflector(['platform.settings.read', 'platform.audit.read']),
    );
    let threw = false;
    try {
      guard.canActivate(
        makeExecutionContext(ctx(['platform.settings.read'])),
      );
    } catch (err) {
      threw = err instanceof ForbiddenException;
    }
    expect(threw).toBe(true);
  });

  it('PERMISSIONS_KEY is the documented metadata key', () => {
    expect(typeof PERMISSIONS_KEY).toBe('string');
  });
});
