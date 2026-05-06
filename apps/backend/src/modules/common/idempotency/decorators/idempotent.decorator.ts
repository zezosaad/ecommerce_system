import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

export interface IdempotentOptions {
  ttlSeconds?: number;
}

export const Idempotent = (options?: IdempotentOptions) =>
  SetMetadata(IDEMPOTENT_KEY, options ?? {});
