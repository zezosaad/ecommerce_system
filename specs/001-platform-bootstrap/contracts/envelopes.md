# Standard Response Envelopes

Every API response MUST conform to one of the envelopes below. The
backend's `Common` module owns the implementation; new modules MUST
NOT invent alternative envelope shapes.

---

## Success envelope (single resource)

```json
{
  "data": { /* resource object */ },
  "meta": {
    "request_id": "01J...",
    "served_at": "2026-05-06T12:34:56.789Z",
    "version": "0.1.0+abcd1234"
  }
}
```

- `data` — the resource. Always an object for single-resource
  endpoints.
- `meta.request_id` — ULID/UUID of the request; mirrors the
  `x-request-id` header.
- `meta.served_at` — ISO 8601 UTC timestamp.
- `meta.version` — service version (semver + short SHA).

---

## Success envelope (list)

```json
{
  "data": [ /* array of resource objects */ ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 137,
    "total_pages": 7
  },
  "meta": {
    "request_id": "01J...",
    "served_at": "2026-05-06T12:34:56.789Z",
    "version": "0.1.0+abcd1234"
  }
}
```

- `pagination` is REQUIRED on every list endpoint.
- `pagination.page` is 1-indexed.
- Default `page_size` is 20; per-endpoint maximums are documented in
  the OpenAPI for that endpoint.

---

## Error envelope

```json
{
  "error": {
    "code": "STABLE_MACHINE_READABLE_CODE",
    "message": "Localized or English human-readable description.",
    "details": { /* optional, structured */ }
  },
  "meta": {
    "request_id": "01J...",
    "served_at": "2026-05-06T12:34:56.789Z",
    "version": "0.1.0+abcd1234"
  }
}
```

- `error.code` — stable, uppercase, snake-case-ish, dot-separated
  for hierarchies (e.g., `AUTH.JWT_EXPIRED`,
  `VALIDATION.FIELD_REQUIRED`). Codes are registered in
  `error-codes.md`.
- `error.message` — English by default; frontends produce the
  localized string from a shared message catalog keyed by `code`.
  The backend MUST NOT include user-input data verbatim in the
  message (XSS / log-injection guard).
- `error.details` — optional structured object. For validation
  errors, includes `fields[]` array with per-field errors.
- Stack traces, SQL fragments, secret values, and framework
  internals MUST NEVER appear.

---

## HTTP status mapping

| Status | Meaning | Example codes |
|---|---|---|
| 200 | OK | n/a |
| 201 | Created | n/a |
| 204 | No Content | n/a |
| 400 | Validation / bad input | `VALIDATION.*` |
| 401 | Authentication required / token problem | `AUTH.JWT_MISSING`, `AUTH.JWT_INVALID`, `AUTH.JWT_EXPIRED` |
| 403 | Authorization / permission denied / tenant isolation | `AUTHZ.PERMISSION_DENIED`, `AUTHZ.ROLE_REQUIRED`, `AUTHZ.TENANT_ISOLATION` |
| 404 | Not found | `RESOURCE.NOT_FOUND` |
| 409 | Conflict (incl. idempotency mismatch) | `IDEMPOTENCY.CONFLICT`, `RESOURCE.CONFLICT` |
| 422 | Semantic validation | `VALIDATION.SEMANTIC.*` |
| 429 | Rate limited | `RATE_LIMIT.EXCEEDED` |
| 500 | Unhandled internal error (caught by exception filter) | `INTERNAL.UNEXPECTED` |
| 502 | Upstream provider error | `PROVIDER.*.UPSTREAM_ERROR` |
| 503 | Service / dependency unavailable | `SERVICE_UNAVAILABLE_DB`, `SERVICE_UNAVAILABLE_AUTH`, `SERVICE_UNAVAILABLE_STORAGE` |

---

## Validation error details

When `error.code` is `VALIDATION.FAILED` (HTTP 400), `error.details`
takes this shape:

```json
{
  "fields": [
    { "field": "email", "code": "VALIDATION.FIELD_REQUIRED", "message": "Email is required." },
    { "field": "name.ar", "code": "VALIDATION.FIELD_TOO_SHORT", "message": "Arabic name must not be empty." }
  ]
}
```

Field paths use dot notation matching the request body shape.

---

## Headers

| Header | Direction | Notes |
|---|---|---|
| `Authorization: Bearer <jwt>` | request | Supabase JWT for protected endpoints |
| `Accept-Language` | request | optional; advisory; locale fallback follows research R4 |
| `Idempotency-Key` | request | client-generated string; required on opt-in endpoints |
| `x-request-id` | both | server generates if absent |
| `x-rate-limit-limit` | response | per-window limit |
| `x-rate-limit-remaining` | response | per-window remaining |
| `x-rate-limit-reset` | response | epoch seconds |
