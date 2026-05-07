import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators/roles.decorator';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ErrorCode } from '../common/errors/error-codes';
import { Request } from 'express';
import { EffectivePermissionsService } from './effective-permissions.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RolesGuard implements CanActivate {
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

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_MISSING,
        message: 'Authentication required for this resource.',
      });
    }

    const { isSuperAdmin } = await this.permissionsService.getForUser(userId);
    if (isSuperAdmin) return true;

    const userRoles = request.authContext?.roles ?? [];
    const userRoleCodes = userRoles.map((r) => r.code);
    const hasRole = requiredRoles.some((required) => userRoleCodes.includes(required));

    if (!hasRole) {
      const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';
      await this.auditService.write({
        actorUserId: request.authContext?.userId,
        actorRoleCodes: userRoleCodes,
        actionCode: 'authz.role_denied',
        targetType: 'Endpoint',
        targetId: `${request.method} ${request.path}`,
        correlationId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { required: requiredRoles },
        severity: 'warning',
      });

      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_ROLE_REQUIRED,
        message: 'Insufficient role access.',
        details: { required: requiredRoles },
      });
    }

    return true;
  }
}
