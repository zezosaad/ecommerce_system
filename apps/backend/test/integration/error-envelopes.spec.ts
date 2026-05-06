import { describe, it, expect } from 'vitest';
import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from '../../src/modules/common/filters/all-exceptions.filter';
import { ErrorCode } from '../../src/modules/common/errors/error-codes';

interface CapturedResponse {
  statusCode?: number;
  body?: unknown;
}

function makeHost(): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = {};
  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const request = {
    headers: { 'x-request-id': 'req-test-1' },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

describe('AllExceptionsFilter — envelope shape (FR-BACK-008, contracts/envelopes.md)', () => {
  it('wraps an HttpException carrying { code, message } into the standard envelope', () => {
    const filter = new AllExceptionsFilter();
    const { host, captured } = makeHost();

    filter.catch(
      new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'A field is invalid.',
      }),
      host,
    );

    expect(captured.statusCode).toBe(HttpStatus.BAD_REQUEST);
    const body = captured.body as {
      error: { code: string; message: string; details?: unknown };
      meta: { request_id: string; served_at: string; version: string };
    };
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(body.error.message).toBe('A field is invalid.');
    expect(body.meta.request_id).toBe('req-test-1');
    expect(typeof body.meta.served_at).toBe('string');
    expect(typeof body.meta.version).toBe('string');
  });

  it('preserves error.details when provided', () => {
    const filter = new AllExceptionsFilter();
    const { host, captured } = makeHost();

    filter.catch(
      new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'fields',
        details: {
          fields: [
            {
              field: 'email',
              code: ErrorCode.VALIDATION_FIELD_REQUIRED,
              message: 'required',
            },
          ],
        },
      }),
      host,
    );

    const body = captured.body as { error: { details?: { fields: unknown[] } } };
    expect(body.error.details?.fields).toHaveLength(1);
  });

  it('maps a plain Error to INTERNAL.UNEXPECTED + 500 without leaking the stack', () => {
    const filter = new AllExceptionsFilter();
    const { host, captured } = makeHost();

    filter.catch(new Error('boom: SELECT * FROM secret_table'), host);

    expect(captured.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = captured.body as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe(ErrorCode.INTERNAL_UNEXPECTED);
    // Crucial: the SQL fragment from the original message MUST NOT leak.
    expect(body.error.message).not.toContain('SELECT');
    expect(body.error.message).not.toContain('secret_table');
  });

  it('maps unknown thrown values to INTERNAL.UNEXPECTED + 500', () => {
    const filter = new AllExceptionsFilter();
    const { host, captured } = makeHost();
    filter.catch('a string was thrown', host);
    expect(captured.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = captured.body as { error: { code: string } };
    expect(body.error.code).toBe(ErrorCode.INTERNAL_UNEXPECTED);
  });

  it('honors HTTP status of UnauthorizedException + AUTH.JWT_MISSING', () => {
    const filter = new AllExceptionsFilter();
    const { host, captured } = makeHost();
    filter.catch(
      new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_MISSING,
        message: 'no token',
      }),
      host,
    );
    expect(captured.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    expect((captured.body as { error: { code: string } }).error.code).toBe(
      ErrorCode.AUTH_JWT_MISSING,
    );
  });

  it('honors HTTP status of ForbiddenException + AUTHZ.PERMISSION_DENIED', () => {
    const filter = new AllExceptionsFilter();
    const { host, captured } = makeHost();
    filter.catch(
      new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'denied',
      }),
      host,
    );
    expect(captured.statusCode).toBe(HttpStatus.FORBIDDEN);
  });

  it('honors HTTP status of NotFoundException + RESOURCE.NOT_FOUND', () => {
    const filter = new AllExceptionsFilter();
    const { host, captured } = makeHost();
    filter.catch(
      new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'not found',
      }),
      host,
    );
    expect(captured.statusCode).toBe(HttpStatus.NOT_FOUND);
  });

  it('handles HttpException raised with a string body (legacy throws)', () => {
    const filter = new AllExceptionsFilter();
    const { host, captured } = makeHost();
    filter.catch(new HttpException('legacy', HttpStatus.BAD_REQUEST), host);
    expect(captured.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect((captured.body as { error: { code: string } }).error.code).toBe(
      ErrorCode.INTERNAL_UNEXPECTED,
    );
  });
});

describe('Error code registry coverage (contracts/error-codes.md)', () => {
  it('every category from the registry has at least one enum value', () => {
    const codes = Object.values(ErrorCode);
    const categories = new Set(codes.map((c) => c.split(/[._]/)[0]));
    // Every category named in contracts/error-codes.md MUST appear here.
    for (const required of [
      'AUTH',
      'AUTHZ',
      'VALIDATION',
      'RESOURCE',
      'IDEMPOTENCY',
      'RATE',           // RATE_LIMIT
      'SERVICE',        // SERVICE_UNAVAILABLE_*
      'INTERNAL',
    ]) {
      expect(
        Array.from(categories).some((c) => c.startsWith(required)),
      ).toBe(true);
    }
  });
});
