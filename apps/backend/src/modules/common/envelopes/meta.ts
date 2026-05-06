import { ExecutionContext } from '@nestjs/common';

export interface RequestMeta {
  request_id: string;
  served_at: string;
  version: string;
}

declare module 'express' {
  interface Request {
    requestId: string;
  }
}

export function buildMeta(context: ExecutionContext): RequestMeta {
  const request = context.switchToHttp().getRequest<import('express').Request>();
  return {
    request_id: request.requestId ?? 'unknown',
    served_at: new Date().toISOString(),
    version: process.env.APP_VERSION ?? '0.1.0',
  };
}

export function buildMetaFromRequest(request: import('express').Request): RequestMeta {
  return {
    request_id: request.requestId ?? 'unknown',
    served_at: new Date().toISOString(),
    version: process.env.APP_VERSION ?? '0.1.0',
  };
}
