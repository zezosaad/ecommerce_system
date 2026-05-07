# Auth & RBAC — Developer Guide

> Phase 2 of the VendorHub platform. This document describes the auth/access-control surface that every downstream feature team will use.

## Guard Chain (enforcement order)

Requests pass through this pipeline on **every protected endpoint**:

```
JwtAuthGuard → ActiveUserGuard → RolesGuard → PermissionsGuard → StoreScopeGuard
```

| Guard | What it checks | Failure code |
|-------|---------------|-------------|
| `JwtAuthGuard` | Valid Supabase JWT (signature, issuer, audience, expiry) | `AUTH/JWT_MISSING`, `AUTH/JWT_INVALID`, `AUTH/JWT_EXPIRED` |
| `ActiveUserGuard` | Profile exists and status is `active` | `AUTH/PROFILE_BLOCKED` |
| `RolesGuard` | Caller has at least one of the `@Roles(...)` keys | `AUTH/ROLE_REQUIRED` |
| `PermissionsGuard` | Caller has ALL of the `@Permissions(...)` keys | `AUTH/PERMISSION_REQUIRED` |
| `StoreScopeGuard` | Caller's access scope covers the targeted merchant/store | `AUTH/SCOPE_REQUIRED` |

All guards are registered globally. Every route is protected by default — opt out with `@Public()` or `@OptionalAuth()`.

## Decorators

| Decorator | Target | Purpose |
|-----------|--------|---------|
| `@Public()` | Controller method | Skips all auth guards |
| `@OptionalAuth()` | Controller method | Allows both authenticated and unauthenticated callers. `currentUser` is `null` when unauthenticated |
| `@Roles('super_admin', 'platform_admin')` | Controller method | Requires the caller to hold at least one of the specified role keys |
| `@Permissions('users.manage.view', 'users.manage.update')` | Controller method | Requires the caller to hold ALL specified permission keys |
| `@StoreScope({ param: 'merchantId', source: 'query' })` | Controller method | Verifies the caller has an access-scope row matching the requested merchant/store |
| `@CurrentUser()` | Controller method param | Injects the authenticated user's `AuthEnvelopeDto` |
| `@Throttle('bucket-name')` | Controller method | Attaches rate-limit bucket. Buckets configured in `ratelimit.module.ts` |

## How to add a new permission

1. Add the permission key to the seed catalog in `apps/backend/prisma/seed.ts` under the appropriate module. The key format is `module.resource.action` (e.g. `orders.manage.create`).
2. Add the corresponding entry in the `DEFAULT_ROLE_PERMISSIONS` map if an existing role should have it by default.
3. Create the DTOs and validation in your controller.
4. Annotate the endpoint with `@Permissions('module.resource.action')`.

## How to add a new module with permissions

1. Add permission keys in `seed.ts` under a new module section.
2. Create your NestJS module following the existing patterns (`apps/backend/src/modules/your-module/`).
3. Import your module in `app.module.ts`.
4. Annotate endpoints with the appropriate guard decorators.
5. If your module needs merchant/store isolation, add `@StoreScope({ param: 'merchantId', source: 'param' })`.

## How to declare a `@StoreScope` endpoint

```typescript
@Get()
@Permissions('orders.manage.view')
@StoreScope({ param: 'merchantId', source: 'query' })
async listOrders(@Query('merchantId') merchantId: string) {
  // Only callers with scope containing merchantId will reach here
}
```

The `StoreScopeGuard` resolves the parameter name (`merchantId`) from the specified source (`param`, `query`, or `body`) and checks against the caller's `UserAccessScope` rows. Super Admin bypasses the check.

## Enforcement Details

- **Frontend hiding is UX-only**: permission gates in the dashboard (`PermissionGate` component) hide/show UI elements for a better user experience but never serve as the security boundary. The backend always enforces.
- **Cache invalidation**: changes to roles, permissions, status, or role assignments invalidate the affected user's `EffectivePermissionsService` cache. Stale decisions last at most 60 seconds.
- **Super Admin**: bypasses all role/permission/scope checks. Computed at runtime — no `RolePermission` rows are needed.
- **Audit trail**: every sensitive action listed in FR-044 generates an immutable audit entry. See `audit-coverage.spec.ts` for the full action-code list.

## Key Files

| File | Purpose |
|------|---------|
| `src/modules/auth/` | Guards, decorators, JWT verifier, auth context service |
| `src/modules/auth/effective-permissions.service.ts` | In-process LRU cache for permission resolution |
| `src/modules/auth/store-scope.guard.ts` | Multi-tenant isolation guard |
| `src/modules/roles/` | Role/permission CRUD services and controllers |
| `src/modules/users/` | User management (list, update status, replace roles) |
| `src/modules/audit/` | Immutable audit log service and read endpoints |
| `src/modules/webhooks/` | Supabase Auth webhook handler |
| `src/modules/common/ratelimit/` | Rate-limit bucket configuration |
| `specs/002-auth-rbac/contracts/` | OpenAPI contract files for all Phase 2 endpoints |
| `specs/002-auth-rbac/quickstart.md` | End-to-end bring-up and smoke-test instructions |
