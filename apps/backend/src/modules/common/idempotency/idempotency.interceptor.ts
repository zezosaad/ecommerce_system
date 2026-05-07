import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of, switchMap, throwError } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { computeBodyHash } from './canonicalize';
import { IDEMPOTENT_KEY, IdempotentOptions } from './decorators/idempotent.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { AuthContext } from '../../auth/auth-context.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<IdempotentOptions | undefined>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    if (!idempotencyKey) {
      return throwError(
        () =>
          new BadRequestException({
            code: ErrorCode.IDEMPOTENCY_MISSING,
            message: 'Idempotency-Key header is required for this endpoint.',
          }),
      );
    }

    const authContext = (request as unknown as { authContext?: AuthContext }).authContext;
    const actorUserId = authContext?.userId;
    const route = `${request.method} ${request.route?.path ?? request.originalUrl}`;
    const ttlSeconds = options.ttlSeconds ?? 86400;

    return from(computeBodyHash(request.body)).pipe(
      switchMap((bodyHash) =>
        from(
          actorUserId
            ? this.prisma.idempotencyRecord.findUnique({
                where: {
                  actorUserId_route_idempotencyKey: {
                    actorUserId,
                    route,
                    idempotencyKey,
                  },
                },
              })
            : this.prisma.idempotencyRecord.findFirst({
                where: {
                  actorUserId: null,
                  route,
                  idempotencyKey,
                },
              }),
        ).pipe(
          switchMap((existing) => {
            if (existing) {
              const typedExisting = existing as {
                bodyHash: string;
                responseBody: unknown;
              };
              if (typedExisting.bodyHash !== bodyHash) {
                return throwError(
                  () =>
                    new ConflictException({
                      code: ErrorCode.IDEMPOTENCY_CONFLICT,
                      message:
                        'Idempotency-Key already used with a different request body.',
                    }),
                );
              }
              return of(typedExisting.responseBody);
            }

            return next.handle().pipe(
              switchMap((response) =>
                from(
                  this.prisma.idempotencyRecord.create({
                    data: {
                      actorUserId: actorUserId ?? null,
                      route,
                      idempotencyKey,
                      bodyHash,
                      responseStatus: context.switchToHttp().getResponse().statusCode ?? 200,
                      responseHeaders: {},
                      responseBody: response as object,
                      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
                    },
                  }),
                ).pipe(switchMap(() => of(response))),
              ),
            );
          }),
        ),
      ),
    );
  }
}
