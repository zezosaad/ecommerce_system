export interface Translatable {
  ar: string;
  en: string;
}

export const RoleCode = {
  SUPER_ADMIN: 'super_admin',
  PLATFORM_ADMIN: 'platform_admin',
  MERCHANT_OWNER: 'merchant_owner',
  MERCHANT_STAFF: 'merchant_staff',
  CUSTOMER: 'customer',
  SUPPORT_AGENT: 'support_agent',
  FINANCE_ADMIN: 'finance_admin',
  SHIPPING_AGENT: 'shipping_agent',
} as const;

export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

export const ErrorCode = {
  AUTH_JWT_MISSING: 'AUTH.JWT_MISSING',
  AUTH_JWT_MALFORMED: 'AUTH.JWT_MALFORMED',
  AUTH_JWT_INVALID: 'AUTH.JWT_INVALID',
  AUTH_JWT_EXPIRED: 'AUTH.JWT_EXPIRED',
  AUTHZ_PERMISSION_DENIED: 'AUTHZ.PERMISSION_DENIED',
  AUTHZ_ROLE_REQUIRED: 'AUTHZ.ROLE_REQUIRED',
  AUTHZ_TENANT_ISOLATION: 'AUTHZ.TENANT_ISOLATION',
  AUTHZ_PROFILE_MISSING: 'AUTHZ.PROFILE_MISSING',
  AUTHZ_NO_ROLES_ASSIGNED: 'AUTHZ.NO_ROLES_ASSIGNED',
  VALIDATION_FAILED: 'VALIDATION.FAILED',
  VALIDATION_FIELD_REQUIRED: 'VALIDATION.FIELD_REQUIRED',
  VALIDATION_FIELD_TYPE: 'VALIDATION.FIELD_TYPE',
  VALIDATION_FIELD_TOO_SHORT: 'VALIDATION.FIELD_TOO_SHORT',
  VALIDATION_FIELD_TOO_LONG: 'VALIDATION.FIELD_TOO_LONG',
  VALIDATION_FIELD_PATTERN: 'VALIDATION.FIELD_PATTERN',
  VALIDATION_FIELD_ENUM: 'VALIDATION.FIELD_ENUM',
  VALIDATION_TRANSLATABLE_REQUIRED: 'VALIDATION.TRANSLATABLE_REQUIRED',
  VALIDATION_SEMANTIC_INCONSISTENT: 'VALIDATION.SEMANTIC.INCONSISTENT',
  RESOURCE_NOT_FOUND: 'RESOURCE.NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE.CONFLICT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY.CONFLICT',
  IDEMPOTENCY_MISSING: 'IDEMPOTENCY.MISSING',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT.EXCEEDED',
  SERVICE_UNAVAILABLE_DB: 'SERVICE_UNAVAILABLE_DB',
  SERVICE_UNAVAILABLE_AUTH: 'SERVICE_UNAVAILABLE_AUTH',
  SERVICE_UNAVAILABLE_STORAGE: 'SERVICE_UNAVAILABLE_STORAGE',
  INTERNAL_UNEXPECTED: 'INTERNAL.UNEXPECTED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface MetaEnvelope {
  request_id: string;
  served_at: string;
  version: string;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: MetaEnvelope;
}

export interface ListEnvelope<T> {
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  meta: MetaEnvelope;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  error: ErrorDetail;
  meta: MetaEnvelope;
}

export interface PaginationQuery {
  page?: number;
  page_size?: number;
  sort?: string;
}
