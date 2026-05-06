import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AUDIT_KEY, AuditMetadata } from './decorators/audit.decorator';
import { AuditService } from './audit.service';
import { AuthContext } from '../auth/auth-context.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private auditService: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<AuditMetadata | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditMeta) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const authContext = (request as unknown as { authContext?: AuthContext }).authContext;

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService.write({
            actorUserId: authContext?.userId,
            actorRoleCodes: authContext?.roles.map((r) => r.code) ?? [],
            actionCode: auditMeta.action,
            correlationId: request.requestId ?? 'unknown',
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            severity: auditMeta.severity,
          });
        },
      }),
    );
  }
}
