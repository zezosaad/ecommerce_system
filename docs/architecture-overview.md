# Architecture Overview

VendorHub uses a monorepo with a NestJS backend and two Next.js apps.

## Core Layout
- `apps/backend`: modular monolith API
- `apps/dashboard`: role-gated operator dashboard
- `apps/website`: customer-facing website
- `packages/*`: shared config, types, i18n, and API client

## Foundation Modules
- `common`: envelopes, filters, interceptors, DTOs, observability no-ops
- `auth`: JWT guard, permissions guard, decorators, auth context
- `prisma`: DB access + transaction helper + soft-read helpers
- `audit`: audit decorator + interceptor + service
- `ledger`: balanced-entry service
- `health`, `users`, `roles`, `settings`, `currencies`, `tax`

## Multi-Tenancy Model
- Tenant context: `{ merchantId?, storeId?, isSuperAdmin }`
- Tenant-aware repositories enforce scope for tenant tables
- Super admin may bypass with explicit context

## API Conventions
- REST base path: `/api/v1`
- Swagger at `/api/docs`
- Standard success/list/error envelopes
- Correlation IDs via `x-request-id`

## Quality Checks
- Soft-delete convention via repository helper
- Permission checks via `@Permissions(...)`
- Audit logging via `@Audit(...)`
- Idempotency support for mutating routes

## Frontend Secret Verification
- Run locally:

```bash
bash scripts/verify-no-frontend-secrets.sh
```
