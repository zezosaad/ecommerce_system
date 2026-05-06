import { RequestMeta } from './meta';
import { ErrorCode } from '../errors/error-codes';

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export class ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: {
      fields?: FieldError[];
      [key: string]: unknown;
    };
  };
  meta: RequestMeta;

  constructor(
    code: ErrorCode | string,
    message: string,
    meta: RequestMeta,
    details?: { fields?: FieldError[]; [key: string]: unknown },
  ) {
    this.error = { code, message, details };
    this.meta = meta;
  }
}
