import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import pino from 'pino';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'idempotency-key',
  'cookie',
  'set-cookie',
  'x-api-key',
]);

const logger = pino({
  transport:
    process.env.APP_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl, headers } = request;
    const startTime = Date.now();

    const sanitizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
        sanitizedHeaders[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitizedHeaders[key] = value;
      }
    }

    logger.info({
      msg: 'incoming request',
      method,
      url: originalUrl,
      headers: sanitizedHeaders,
      request_id: (request as unknown as { requestId: string }).requestId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const duration = Date.now() - startTime;
          logger.info({
            msg: 'request completed',
            method,
            url: originalUrl,
            status: response.statusCode,
            duration_ms: duration,
            request_id: (request as unknown as { requestId: string }).requestId,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          logger.error({
            msg: 'request failed',
            method,
            url: originalUrl,
            error: {
              message: error.message,
              code: error.code,
            },
            duration_ms: duration,
            request_id: (request as unknown as { requestId: string }).requestId,
          });
        },
      }),
    );
  }
}
