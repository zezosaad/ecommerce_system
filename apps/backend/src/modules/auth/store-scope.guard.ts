import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ErrorCode } from '../common/errors/error-codes';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EffectivePermissionsService } from './effective-permissions.service';

export const STORE_SCOPE_KEY = 'storeScope';

export interface StoreScopeOptions {
  param: 'merchantId' | 'storeId';
  source: 'param' | 'query' | 'body';
}

export const StoreScope = (options: StoreScopeOptions) =>
  SetMetadata(STORE_SCOPE_KEY, options);

@Injectable()
export class StoreScopeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private auditService: AuditService,
    private permissionsService: EffectivePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const options = this.reflector.getAllAndOverride<StoreScopeOptions>(
      STORE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) return true;

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

    const requestedId = this.resolveRequestedId(request, options);
    if (!requestedId) return true;

    const scope = await this.prisma.userAccessScope.findFirst({
      where: {
        userId: request.authContext?.userId,
        [options.param]: requestedId,
      },
    });

    if (!scope) {
      const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';
      await this.auditService.write({
        actionCode: 'authz.scope_denied',
        actorUserId: request.authContext?.userId,
        actorRoleCodes: request.authContext?.roles.map((r) => r.code) ?? [],
        targetType: options.param === 'merchantId' ? 'merchant' : 'store',
        targetId: requestedId,
        correlationId,
        ipAddress: (request.headers['x-forwarded-for'] ?? request.ip) as string | undefined,
        userAgent: request.headers['user-agent'] as string | undefined,
        metadata: { requestedId, param: options.param, source: options.source },
        severity: 'warning',
      });

      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_TENANT_ISOLATION,
        message: 'Access denied: scope mismatch.',
        details: { param: options.param },
      });
    }

    return true;
  }

  private resolveRequestedId(
    request: Request,
    options: StoreScopeOptions,
  ): string | null {
    switch (options.source) {
      case 'param':
        return (request.params as Record<string, string>)[options.param] ?? null;
      case 'query':
        return (request.query as Record<string, string | undefined>)[options.param] ?? null;
      case 'body':
        return (request.body as Record<string, string | undefined>)?.[options.param] ?? null;
      default:
        return null;
    }
  }
}
