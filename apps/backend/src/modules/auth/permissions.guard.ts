import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ErrorCode } from '../common/errors/error-codes';
import { Request } from 'express';
import { EffectivePermissionsService } from './effective-permissions.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: EffectivePermissionsService,
    private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.user?.sub;
    if (!userId) {
      // Required permissions are present but no authenticated user (e.g., a
      // route mistakenly combines @OptionalAuth with @Permissions, or the JWT
      // guard short-circuited). Fail closed.
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_MISSING,
        message: 'Authentication required for this resource.',
      });
    }

    const { permissions, isSuperAdmin } =
      await this.permissionsService.getForUser(userId);

    if (isSuperAdmin) return true;

    const hasPermission = requiredPermissions.every((required) =>
      this.matchesPermission(required, permissions),
    );

    if (!hasPermission) {
      const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';
      await this.auditService.write({
        actorUserId: request.authContext?.userId,
        actorRoleCodes: request.authContext?.roles.map((r) => r.code) ?? [],
        actionCode: 'authz.permission_denied',
        targetType: 'Endpoint',
        targetId: `${request.method} ${request.path}`,
        correlationId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { required: requiredPermissions },
        severity: 'warning',
      });

      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'Insufficient permissions.',
        details: { required: requiredPermissions },
      });
    }

    return true;
  }

  private matchesPermission(
    required: string,
    userPermissions: Set<string>,
  ): boolean {
    if (userPermissions.has(required)) return true;

    const parts = required.split('.');
    if (parts.length >= 2) {
      const wildcard = `${parts[0]}.${parts[1]}.*`;
      if (userPermissions.has(wildcard)) return true;
    }
    if (parts.length >= 1) {
      const moduleWildcard = `${parts[0]}.*.*`;
      if (userPermissions.has(moduleWildcard)) return true;
    }

    return false;
  }
}
