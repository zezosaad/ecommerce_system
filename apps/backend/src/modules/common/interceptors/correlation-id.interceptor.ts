import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const existingId = request.headers['x-request-id'] as string | undefined;
    const requestId =
      existingId && typeof existingId === 'string' && existingId.trim().length > 0
        ? existingId.trim()
        : this.generateId();

    request.requestId = requestId;

    const response = context.switchToHttp().getResponse();
    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap(() => {
        response.setHeader('x-request-id', requestId);
      }),
    );
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }
}
