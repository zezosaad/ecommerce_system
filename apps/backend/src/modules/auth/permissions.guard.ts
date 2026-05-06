import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';
import { AuthContext } from './auth-context.service';
import { ErrorCode } from '../common/errors/error-codes';
import { Request } from 'express';

declare module 'express' {
  interface Request {
    authContext?: AuthContext;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authContext = request.authContext;

    if (!authContext) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'Authentication context not available.',
      });
    }

    const hasPermission = requiredPermissions.every((required) =>
      this.matchesPermission(required, authContext.permissions),
    );

    if (!hasPermission) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'Insufficient permissions.',
      });
    }

    return true;
  }

  private matchesPermission(required: string, userPermissions: string[]): boolean {
    if (userPermissions.includes(required)) return true;

    const [scope, resource] = required.split('.');
    const wildcard = `${scope}.${resource}.*`;
    return userPermissions.includes(wildcard);
  }
}
