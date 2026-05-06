import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorEnvelope } from '../envelopes/error.envelope';
import { buildMetaFromRequest } from '../envelopes/meta';
import { ErrorCode } from '../errors/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<import('express').Request>();
    const meta = buildMetaFromRequest(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_UNEXPECTED;
    let message = 'An unexpected error occurred.';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'object' && exResponse !== null) {
        const resp = exResponse as Record<string, unknown>;
        code = (resp.code as string) ?? code;
        message = (resp.message as string) ?? exception.message;
        if (resp.details && typeof resp.details === 'object') {
          details = resp.details as Record<string, unknown>;
        }
        if (Array.isArray(resp.message)) {
          message = 'Validation failed.';
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error('Unhandled exception: unknown type');
    }

    const envelope = new ErrorEnvelope(code, message, meta, details);
    response.status(status).json(envelope);
  }
}
