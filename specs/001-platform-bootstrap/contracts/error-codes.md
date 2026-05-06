# Canonical Error Code Registry

**Version**: foundation v1
**Owners**: backend Common module

Every error code returned in `error.code` MUST appear in this registry.
New modules add codes by editing this file and registering them in the
backend's error-code enum (Common module). Inventing codes inline is a
defect.

Codes are uppercase, dot-separated, with the leading segment naming the
category. Sub-segments may use letters, digits, and underscores.

---

## AUTH (HTTP 401)

| Code | Description |
|---|---|
| `AUTH.JWT_MISSING` | No `Authorization` header on a protected endpoint. |
| `AUTH.JWT_MALFORMED` | Header present but token cannot be parsed. |
| `AUTH.JWT_INVALID` | Signature, issuer, or audience mismatch. |
| `AUTH.JWT_EXPIRED` | Token expired (separate from invalid so frontends can refresh). |

## AUTHZ (HTTP 403)

| Code | Description |
|---|---|
| `AUTHZ.PERMISSION_DENIED` | The caller's permission set does not include a required permission. |
| `AUTHZ.ROLE_REQUIRED` | The caller does not hold a role required by the route. |
| `AUTHZ.TENANT_ISOLATION` | The caller attempted to access another tenant's data. |
| `AUTHZ.PROFILE_MISSING` | Authenticated Supabase user has no application profile and auto-provisioning failed. |
| `AUTHZ.NO_ROLES_ASSIGNED` | Authenticated user has no role bindings (per spec edge case). |

## VALIDATION (HTTP 400 unless noted)

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION.FAILED` | 400 | One or more fields failed validation; see `details.fields[]`. |
| `VALIDATION.FIELD_REQUIRED` | (in details) | Field is missing. |
| `VALIDATION.FIELD_TYPE` | (in details) | Field has wrong type. |
| `VALIDATION.FIELD_TOO_SHORT` | (in details) | Field below minimum length. |
| `VALIDATION.FIELD_TOO_LONG` | (in details) | Field above maximum length. |
| `VALIDATION.FIELD_PATTERN` | (in details) | Field violates regex/format. |
| `VALIDATION.FIELD_ENUM` | (in details) | Field not in allowed enum. |
| `VALIDATION.TRANSLATABLE_REQUIRED` | (in details) | Translatable field has empty `ar` and `en`. |
| `VALIDATION.SEMANTIC.INCONSISTENT` | 422 | Cross-field semantic check failed. |

## RESOURCE

| Code | HTTP | Description |
|---|---|---|
| `RESOURCE.NOT_FOUND` | 404 | Entity does not exist or is not visible to the caller (used in lieu of 403 to avoid resource enumeration). |
| `RESOURCE.CONFLICT` | 409 | State conflict (e.g., duplicate slug). |

## IDEMPOTENCY

| Code | HTTP | Description |
|---|---|---|
| `IDEMPOTENCY.CONFLICT` | 409 | Same `Idempotency-Key` reused with a different body hash. |
| `IDEMPOTENCY.MISSING` | 400 | Idempotent endpoint called without an `Idempotency-Key` header. |

## RATE_LIMIT

| Code | HTTP | Description |
|---|---|---|
| `RATE_LIMIT.EXCEEDED` | 429 | Per-IP or per-user rate limit exceeded. |

## SERVICE

| Code | HTTP | Description |
|---|---|---|
| `SERVICE_UNAVAILABLE_DB` | 503 | Postgres unreachable (research R5). |
| `SERVICE_UNAVAILABLE_AUTH` | 503 | Supabase Auth / JWKS unreachable and cache exhausted. |
| `SERVICE_UNAVAILABLE_STORAGE` | 503 | Supabase Storage unreachable (forward-looking). |

## INTERNAL

| Code | HTTP | Description |
|---|---|---|
| `INTERNAL.UNEXPECTED` | 500 | Unhandled exception caught by global filter; request ID is the link to logs. |

## PROVIDER (forward-looking; reserved namespace)

Per-provider errors use `PROVIDER.<ProviderName>.<Code>`. Examples:
- `PROVIDER.STRIPE.UPSTREAM_ERROR`
- `PROVIDER.MOYASAR.WEBHOOK_INVALID_SIGNATURE`

These do not exist in Phase 0; the namespace is reserved.
