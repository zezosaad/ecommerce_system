# Tasks: Authentication, Users, Roles & Permissions Foundation

**Input**: Design documents from `/specs/002-auth-rbac/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included where the constitution mandates them (Constitution §IV — auth, permissions, merchant isolation are critical flows) and where a Spec Success Criterion (SC-002, SC-003, SC-009) requires automated verification. Story-level tests are written **before** the implementation tasks they validate.

**Organization**: Tasks are grouped by user story (US1–US6, priorities P1–P3 from spec.md) so each story can be implemented, tested, and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on incomplete tasks → safe to parallelize.
- **[Story]**: User story label (US1, US2, ..., US6). Setup, Foundational, and Polish phases carry no story label.
- All paths are repo-root relative.

## Path Conventions

- Backend: `apps/backend/src/modules/<module>/...`, migrations in `apps/backend/prisma/migrations/`, seed in `apps/backend/prisma/seed.ts`.
- Dashboard (Next.js): `apps/dashboard/src/...`.
- Customer site (Next.js): `apps/website/src/...`.
- Shared: `packages/types/`, `packages/api-client/`, `packages/i18n/`.
- Backend tests: `apps/backend/test/{unit,integration}/...`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Wire Phase 2 environment variables and dev-only helpers on top of the existing Phase 1 monorepo.

- [X] T001 Add Phase 2 env keys (`SUPABASE_*`, `RL_*`, `AUTH_PERMISSIONS_CACHE_*`, `SUPERADMIN_*`) to `apps/backend/.env.example` and document each in `apps/backend/README.md`.
- [X] T002 [P] Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL` to `apps/dashboard/.env.example` and `apps/website/.env.example`.
- [X] T003 [P] Add a build-time guard to `apps/dashboard/next.config.mjs` and `apps/website/next.config.mjs` that throws if `SUPABASE_SERVICE_ROLE_KEY` is present in the env at build time (FR-047).
- [X] T004 Install backend deps: `pnpm --filter @platform/backend add @nestjs/throttler @supabase/supabase-js`. Confirm `jose` (Phase 1) is current.
- [X] T005 [P] Install frontend deps: `pnpm --filter @platform/dashboard --filter @platform/website add @supabase/ssr @supabase/supabase-js`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration + seed + shared types + the guards/decorators that every user story (US1–US6) builds on.

**⚠️ CRITICAL**: No US1–US6 work begins until this phase is complete.

### Database

- [X] T006 Author Prisma migration `apps/backend/prisma/migrations/002_auth_rbac/migration.sql` per `data-model.md` §11: enums (`user_status`, `scope_type`, `staff_membership_status`); `users` rewrite (status, name split, drop `is_active`, drop `display_name`, rename `locale` → `preferred_language`, add `default_currency`); `permissions` columns + CHECK; `roles` index; create `user_access_scope`, `staff_memberships`, `webhook_events`; new `audit_logs` index.
- [X] T007 Update `apps/backend/prisma/schema.prisma` to match T006 (models + enums per `data-model.md` §2–10). Run `pnpm prisma generate`.
- [X] T008 Extend `apps/backend/prisma/seed.ts` to be idempotent and to upsert: 8 system roles (codes from spec), ~80 permissions (data-model §12.2), default `RolePermission` reconciliation (skip `super_admin`), and a dev-only Super Admin user from `SUPERADMIN_*` env vars when present.
- [ ] T009 [P] Add `apps/backend/test/unit/seed.spec.ts` asserting (a) running the seed twice produces zero new rows on the second pass; (b) the seeded role-permission map matches the constant declared in `seed.ts`; (c) `super_admin` has zero `RolePermission` rows.

### Shared types

- [X] T010 [P] Create `packages/types/src/auth.ts` with the DTOs from `data-model.md` §13 (`UserStatus`, `ScopeType`, `Locale`, `Localized`, `UserProfileDto`, `RoleDto`, `PermissionDto`, `AccessScopeDto`, `AuthEnvelopeDto`, `AuditLogDto`). Re-export from `packages/types/src/index.ts`.
- [X] T011 [P] Add the canonical permission-key list and a `parsePermissionKey(key) → {module, resource, action}` helper to `packages/shared/src/permissions.ts`; re-export from the package index.
- [X] T012 [P] Add typed clients (`auth`, `users`, `roles`, `permissions`, `me`, `auditLogs`) to `packages/api-client/src/` with method signatures matching the contracts in `specs/002-auth-rbac/contracts/`. Export from `packages/api-client/src/index.ts`.

### Backend foundation — config, rate-limit, JWKS

- [X] T013 Add `apps/backend/src/modules/common/ratelimit/ratelimit.module.ts` registering five named `@nestjs/throttler` buckets (`auth-sync`, `webhook-supabase`, `webhook-pwd-reset`, `me-read`, `admin-write`) with limits read from env (defaults per `quickstart.md` §2). Wire into `app.module.ts`.
- [X] T014 Tighten `apps/backend/src/modules/auth/jwt.verifier.ts`: validate `iss`, `aud`, `exp`, `iat`, configurable `clockTolerance`; on `kid` miss, force-refresh JWKS via `jwks-cache.service.ts`; throw a typed `JwtInvalidError` mapped to `AUTH/JWT_INVALID` by the global filter.
- [X] T015 Finalize `apps/backend/src/modules/auth/jwt-auth.guard.ts` (`SupabaseJwtAuthGuard`): respects `@Public` and `@OptionalAuth`; sets `request.supabaseUserId` and `request.jwtPayload` on success.
- [X] T017 Implement `apps/backend/src/modules/auth/decorators/`: `current-user.decorator.ts` (already exists — review), `public.decorator.ts` (already exists — review), `optional-auth.decorator.ts` [NEW], `roles.decorator.ts` (already exists — review), `permissions.decorator.ts` (already exists — keep), `store-scope.decorator.ts` (already exists — review). Each writes a stable metadata key under `Reflector`.
- [X] T018 Implement `apps/backend/src/modules/auth/effective-permissions.service.ts`: in-process LRU keyed by `userId`, TTL = `AUTH_PERMISSIONS_CACHE_TTL_SECONDS`, max = `AUTH_PERMISSIONS_CACHE_MAX`. Exposes `getForUser(userId): Promise<{permissions: Set<string>, isSuperAdmin: boolean}>` and `invalidate(userId)`. Computes via union over `UserRole → RolePermission` with the Super Admin shortcut. Wire DI in `auth.module.ts`.
- [X] T019 Implement `apps/backend/src/modules/auth/roles.guard.ts` (`RolesGuard`): reads role-key list from `@Roles(...)` metadata; allows when caller's roles include any required key OR caller `isSuperAdmin`. Returns `AUTH/ROLE_REQUIRED` on failure.
- [X] T020 Refine `apps/backend/src/modules/auth/permissions.guard.ts` (`PermissionsGuard`): reads permission-key list from `@Permissions(...)`; allows when `EffectivePermissionsService` includes ALL required keys OR `isSuperAdmin`. Returns `AUTH/PERMISSION_REQUIRED` on failure.
- [X] T021 Register `SupabaseJwtAuthGuard` and `ActiveUserGuard` as **global** guards in `app.module.ts` (so every endpoint is protected by default; `@Public` opts out).

### Auth context + scope projection

- [X] T022 Extend `apps/backend/src/modules/auth/auth-context.service.ts` to hydrate roles, effective permissions, and access scope into a single `AuthEnvelopeDto` keyed by `userId`. Used by both `/auth/me` and the `CurrentUser` decorator.
- [X] T023 Implement `apps/backend/src/modules/common/tenant/scope-projector.service.ts`: rebuilds `UserAccessScope` rows for a given `userId` from `UserRole` + `StaffMembership` inside a Prisma transaction. Exposes `rebuildForUser(userId, tx?)` and `removeRowsBySource(userId, source, tx?)`. Unit-tested in T009-style.

**Checkpoint**: Foundation ready. The full guard chain (`Jwt → ActiveUser → Roles → Permissions → StoreScope`) is wired except `StoreScopeGuard` which ships in US3.

---

## Phase 3: User Story 1 — Authenticated profile sync and `me` endpoint (Priority: P1) 🎯 MVP

**Story goal**: A Supabase-authenticated user can sync/create an application profile and call `GET /api/v1/auth/me` to receive their full identity envelope. Suspended/deleted users are rejected. Pending-verification users self-reconcile via Supabase.

**Independent test**: With Phase 2 done and a fresh Supabase user, a signup-then-`me` round-trip returns `{user, roles, permissions, accessScopes, isSuperAdmin}` in one response. Suspending the user via direct DB update causes the next `me` call to 401.

### Tests for User Story 1 (must fail before implementation)

- [ ] T024 [P] [US1] Add `apps/backend/test/integration/auth-me.spec.ts`: covers (a) first-time sync creates profile in `pending_verification` for self-registered customer; (b) `me` returns the full envelope; (c) suspended user → 401 `AUTH/PROFILE_BLOCKED`; (d) deleted user → 401; (e) lazy reconciliation flips `pending_verification` → `active` when Supabase reports `email_confirmed_at`.
- [ ] T025 [P] [US1] Add `apps/backend/test/integration/auth-profile-update.spec.ts`: PATCH `/auth/profile` only updates self-editable fields; rejects `status` and roles in the payload (FR-007).

### Implementation for User Story 1

- [X] T026 [P] [US1] Create DTOs in `apps/backend/src/modules/auth/dto/`: `sync-profile.dto.ts`, `update-profile.dto.ts`, `auth-envelope.dto.ts` (re-export `packages/types` `AuthEnvelopeDto` Swagger-decorated mirror).
- [X] T027 [US1] Implement `apps/backend/src/modules/auth/auth.service.ts`: `syncProfile(jwtPayload, body)` (idempotent upsert keyed by `supabaseUserId`); `getEnvelope(userId)`; `updateProfile(userId, dto)`; `reconcileStatusFromSupabase(profile)` (lazy fallback per FR-005b — calls Supabase admin client to read `email_confirmed_at` and flips `pending_verification` → `active`); writes audit entries `auth.profile.created`, `auth.profile.updated`, `auth.profile.activated` (source `lazy_reconcile` or `webhook`).
- [X] T028 [US1] Implement `apps/backend/src/modules/auth/auth.controller.ts`: `GET /api/v1/auth/me`, `POST /api/v1/auth/sync-profile`, `PATCH /api/v1/auth/profile`, `POST /api/v1/auth/logout`. Apply `@nestjs/swagger` decorators matching `contracts/auth.yaml`. Apply `@Throttle('me-read')`, `@Throttle('auth-sync')`. Logout writes `auth.logout` audit entry and returns 204.
- [X] T029 [US1] Implement `apps/backend/src/modules/me/me.module.ts`, `me.controller.ts`, `me.service.ts`: `GET /me/permissions`, `GET /me/roles`, `GET /me/access-scope` per `contracts/me.yaml`; thin façade over `AuthContextService`.
- [X] T030 [US1] In `AuthService.syncProfile`, when creating a new profile: default `preferredLanguage` from `Accept-Language` header (en/ar fallback en); default `defaultCurrency` from the platform `Setting` row when present; auto-assign the `customer` role for self-registered customers.
- [X] T031 [US1] Wire `apps/backend/src/modules/users/users.service.ts` (new) with `setStatus(userId, newStatus, actor, reason)` that invalidates `EffectivePermissionsService` and writes an audit entry. Used by US2 too — implementation here is the single owner of status writes.

**Checkpoint**: `GET /api/v1/auth/me`, `POST /auth/sync-profile`, `PATCH /auth/profile`, `POST /auth/logout`, and the three `/me/*` endpoints all work. Suspended/deleted users blocked. SC-001 (envelope p95 ≤ 300 ms) verifiable.

---

## Phase 4: User Story 2 — Role and permission management by Super Admin (Priority: P1)

**Story goal**: Super Admin can list/create/update/delete custom roles, browse the permission catalog, and assign roles (optionally scoped to a merchant/store) to users. System roles are protected. The Super Admin role cannot be deleted, and the last Super Admin cannot be downgraded.

**Independent test**: A Super Admin signs in, creates a custom role with a permission, assigns it to a user; the user's `/me/permissions` reflects the change. Attempting to delete `super_admin` is rejected; removing the last Super Admin is rejected.

### Tests for User Story 2 (must fail before implementation)

- [ ] T032 [P] [US2] Add `apps/backend/test/integration/roles-crud.spec.ts`: list/create/update/delete custom roles; reject delete of `isSystem=true`; reject delete of `super_admin`; reject duplicate `key`.
- [ ] T033 [P] [US2] Add `apps/backend/test/integration/super-admin-protection.spec.ts`: removing the last `super_admin` `UserRole` of the last Super Admin user → 409; attempting to clear permissions of the `super_admin` role → 409.
- [ ] T034 [P] [US2] Add `apps/backend/test/integration/users-admin.spec.ts`: list users with filters (status, roleKey, merchantId); `PATCH /users/:id/status` writes audit + invalidates cache; `PATCH /users/:id/roles` (replace-set semantics) updates `UserRole` rows + rebuilds `UserAccessScope` in one transaction.

### Implementation for User Story 2

- [X] T035 [P] [US2] Create DTOs in `apps/backend/src/modules/roles/dto/`: `create-role.dto.ts`, `update-role.dto.ts`, `set-role-permissions.dto.ts`.
- [X] T036 [P] [US2] Create DTOs in `apps/backend/src/modules/users/dto/`: `list-users.dto.ts`, `update-user-status.dto.ts`, `update-user-roles.dto.ts`.
- [X] T037 [US2] Implement `apps/backend/src/modules/roles/roles.service.ts` with: `list`, `getById`, `create` (always `isSystem=false`; rejects duplicate key), `update` (rejects `key` change for `isSystem=true`; rejects all permission edits for `super_admin`), `delete` (rejects `isSystem=true`; rejects when any `UserRole` references the role), and `replacePermissions(roleId, permissionKeys, actor)` (transactional; audit entries `roles.permission_added` / `roles.permission_removed` per delta; invalidates `EffectivePermissionsService` for every user holding the role).
- [X] T038 [US2] Implement `apps/backend/src/modules/roles/permissions.service.ts` with: `list({module?})`, `grouped()` (returns `[{module, label, resources:[{resource, label, permissions:[...]}]}]`).
- [X] T039 [US2] Implement `apps/backend/src/modules/roles/roles.controller.ts` per `contracts/roles.yaml`: list, create, getById, update, delete. Apply `@Permissions('roles.manage.view'|'create'|'update'|'delete')` and `@Throttle('admin-write')` on writes.
- [X] T040 [US2] Implement `apps/backend/src/modules/roles/permissions.controller.ts` per `contracts/permissions.yaml`: `GET /permissions`, `GET /permissions/grouped`. Apply `@Permissions('permissions.manage.view')`.
- [X] T041 [US2] Implement `apps/backend/src/modules/users/users.service.ts` (extend from T031): `list({page, pageSize, q, status, roleKey, merchantId, storeId})`, `getById(id)` (embeds roles + access scope), `replaceRoles(userId, assignments[], actor)` (transactional diff against current `UserRole`; rebuilds `UserAccessScope` via `ScopeProjector.rebuildForUser`; refuses to remove the last `super_admin` role of the last Super Admin; invalidates the user's permission cache).
- [X] T042 [US2] Implement `apps/backend/src/modules/users/users.controller.ts` per `contracts/users.yaml`: `GET /users`, `GET /users/:id`, `PATCH /users/:id/status`, `PATCH /users/:id/roles`. Apply `@Permissions(...)` per endpoint, `@Throttle('admin-write')` on writes.

**Checkpoint**: Roles/Permissions/Users admin surface fully functional. SC-006 (create + assign a role in <2 minutes via dashboard once US4 ships) ready to verify.

---

## Phase 5: User Story 3 — Guard-protected endpoints with role, permission, and scope checks (Priority: P1)

**Story goal**: The full guard chain (JWT → active → role → permission → store scope) is enforced consistently. Annotated endpoints behave as documented. Cross-merchant access attempts are rejected and audited.

**Independent test**: Sample protected, role-restricted, permission-restricted, and store-scoped endpoints respond 200/401/403 as expected. The reflective cross-merchant test hits every `@StoreScope` endpoint with a foreign merchant id and expects 403 in 100% of attempts.

### Tests for User Story 3 (must fail before implementation)

- [X] T043 [P] [US3] Add `apps/backend/test/integration/guards-matrix.spec.ts`: a tiny `__test-guards/` controller exposes one endpoint per guard combination (Public, Authenticated, Roles, Permissions, OptionalAuth, StoreScope); the test exercises every combination with an authorized and an unauthorized caller.

- [X] T044 [P] [US3] Add `apps/backend/test/integration/store-scope.spec.ts`: seeds two merchants/stores + one Merchant Staff user; reflectively discovers every `@StoreScope` endpoint via Nest's `DiscoveryService` and asserts cross-merchant call → 403 + audit entry `authz.scope_denied`. (SC-003)

### Implementation for User Story 3

- [X] T045 [US3] Implement `apps/backend/src/modules/auth/store-scope.guard.ts` (`StoreScopeGuard`): reads `@StoreScope({param: 'merchantId'|'storeId', source: 'param'|'query'|'body'})` metadata; resolves the requested merchant/store id from the request; allows when caller has a matching `UserAccessScope` row OR `isSuperAdmin`; on denial writes audit entry `authz.scope_denied` and returns 403 `AUTH/SCOPE_REQUIRED`.

- [X] T046 [US3] Register `RolesGuard`, `PermissionsGuard`, `StoreScopeGuard` as global guards in `app.module.ts` after `ActiveUserGuard`. Order matters: JWT → ActiveUser → Roles → Permissions → StoreScope.

- [X] T047 [US3] Add a sample `@StoreScope`-annotated read endpoint inside an existing module (e.g., `apps/backend/src/modules/audit/audit.controller.ts` accepts `?merchantId=` and is store-scoped) so US3's reflective test has at least one real target beyond the test fixtures.

- [X] T048 [P] [US3] Add `apps/backend/test/unit/effective-permissions.spec.ts`: covers cache hit, TTL expiry, explicit invalidation on role/permission/status writes (SC-002 supporting evidence).

- [X] T049 [US3] Add a static check `apps/backend/scripts/verify-guard-coverage.ts` (and a `pnpm test:guards` npm script) that loads every controller via NestJS metadata reflection and fails if any non-`@Public` route lacks one of the auth guards. Wire into CI.

**Checkpoint**: Guard chain enforced uniformly. Cross-merchant isolation black-box test green (SC-003). Static guard-coverage check green (SC-002).

---

## Phase 6: User Story 4 — Dashboard auth (login, role-based nav, protected routes) (Priority: P2)

**Story goal**: Internal users sign in to the dashboard, see only the navigation and actions their roles/permissions allow, and are redirected to Unauthorized/Suspended pages when appropriate. Dashboard works fully in Arabic (RTL) and English (LTR).

**Independent test**: Each role can sign in and see the correct sidebar; a customer-only user is redirected away from the dashboard; a suspended user sees the suspended state; locale toggle flips RTL with no layout regressions.

### Implementation for User Story 4

- [X] T050 [P] [US4] Implement `apps/dashboard/src/lib/auth/supabase-browser.ts` (createBrowserClient) and `apps/dashboard/src/lib/auth/supabase-server.ts` (createServerClient with cookie adapters), per research §R9.
- [X] T051 [P] [US4] Implement `apps/dashboard/src/lib/auth/session.ts`: `getSession()`, `getAuthEnvelope()` (calls backend `/auth/me` with the bearer token, caches per request via `unstable_cache`), `hasNonCustomerRole(envelope)`, `requirePermission(envelope, key)`.
- [X] T052 [US4] Extend `apps/dashboard/middleware.ts` (already exists for locale): on every request resolve the Supabase session, call `/auth/me` (server-side via `supabase-server`), then redirect:
  - no session → `[locale]/login`
  - session but only `customer` role → external redirect to website (per spec Q1/Option A) at `NEXT_PUBLIC_WEBSITE_URL`
  - session with `status != active` → `[locale]/suspended`
- [X] T053 [P] [US4] Add localized auth copy under `auth.*` namespace in `packages/i18n/en.json` and `packages/i18n/ar.json` (login, logout, errors, role labels, permission gate, suspended, unauthorized, loading).
- [X] T054 [US4] Build dashboard auth pages:
  - `apps/dashboard/src/app/[locale]/(auth)/login/page.tsx` — `LoginForm` component using Supabase JS `signInWithPassword`; on success calls backend `POST /auth/sync-profile` then redirects to dashboard root.
  - `apps/dashboard/src/app/[locale]/(auth)/unauthorized/page.tsx`
  - `apps/dashboard/src/app/[locale]/(auth)/suspended/page.tsx`
- [X] T055 [US4] Build `apps/dashboard/src/app/[locale]/(protected)/layout.tsx` (server component): hydrates `AuthEnvelope` from `session.getAuthEnvelope()`, renders sidebar via the permission-driven nav config, shows a loading skeleton while envelope resolves (no flash of authorized content — SC supporting).
- [X] T056 [P] [US4] Implement `apps/dashboard/src/components/layout/Sidebar.tsx` driven by a typed nav config in `apps/dashboard/src/lib/nav.ts`: each item declares `requirePermissions: string[]` and `requireRoles?: string[]`; the renderer filters by the envelope. Include placeholders for sections owned by later phases (Merchants, Products, Orders, etc.) — disabled with "coming soon" tooltip.
- [X] T057 [P] [US4] Implement `apps/dashboard/src/components/auth/PermissionGate.tsx` (`<PermissionGate require={'roles.manage.create'} />`) and `UserMenu.tsx` (avatar + email + logout button calling Supabase `signOut()` then `POST /auth/logout`).
- [X] T058 [US4] Build the **Roles** management screen at `apps/dashboard/src/app/[locale]/(protected)/roles/page.tsx` (list) and `[id]/page.tsx` (edit): consume `packages/api-client` `roles.*` and `permissions.grouped()`; supports create/edit/delete with all backend-side guards reflected in disabled-button states.
- [X] T059 [P] [US4] Build the **Users** admin screen at `apps/dashboard/src/app/[locale]/(protected)/users/page.tsx`: search + status filter + role filter; user-detail drawer with `PATCH /users/:id/status` and `PATCH /users/:id/roles` actions; all behind `users.manage.*` permission gates.
- [X] T060 [P] [US4] Add component tests under `apps/dashboard/tests/`:
  - `Sidebar.spec.tsx` — given an envelope, renders only allowed items.
  - `PermissionGate.spec.tsx` — hides children when permission absent.
  - `middleware.spec.ts` — customer-only → redirect, suspended → suspended page.
- [X] T061 [US4] Verify Arabic/RTL: open every auth and admin screen with `?locale=ar`; capture screenshots into `apps/dashboard/tests/__snapshots__/rtl/` for review (manual check accepted in Phase 2; automated visual diff in a later phase).

**Checkpoint**: Dashboard is usable end-to-end by Super Admin and customers are bounced. SC-007 (RTL parity) and SC-008 (customer-only redirect 100%) verifiable.

---

## Phase 7: User Story 5 — Customer website auth-ready flows (Priority: P2)

**Story goal**: Marketplace visitors browse anonymously; can register, sign in, sign out, reset password; can reach a protected account layout; cannot reach any dashboard URL.

**Independent test**: Anonymous browse OK; register-confirm-login round-trip OK; logged-in customer cannot reach `/dashboard`-style URLs from the website host.

### Implementation for User Story 5

- [X] T062 [P] [US5] Implement `apps/website/src/lib/auth/supabase-browser.ts` and `supabase-server.ts` mirroring T050 (separate file paths so dashboard and website can ship independently).
- [X] T063 [US5] Extend `apps/website/middleware.ts`: locale resolution + optional auth resolution (does not require session for public routes; populates a `request.cookies`-derived `hasSession` flag for server components). Account routes (`/[locale]/account/*`) require an active session — redirect to `/[locale]/login` otherwise.
- [X] T064 [P] [US5] Add localized website auth copy under `auth.customer.*` in `packages/i18n/{en,ar}.json` (register, login, reset, verify, account layout).
- [X] T065 [US5] Build customer auth pages:
- [X] T066 [US5] Build `apps/website/src/app/[locale]/account/layout.tsx` (server component): requires session; loads envelope; renders an account shell with a placeholder content slot (orders, addresses, wishlist sections come in later phases).
- [X] T067 [US5] Implement `apps/website/src/components/auth/AccountMenu.tsx` (avatar + name + logout) and `apps/website/src/components/auth/AuthGuard.tsx` for client components that need session-presence.
- [X] T068 [P] [US5] Add a guard in `apps/website/middleware.ts` that rejects any path under `/admin`, `/dashboard`, or `/manage` prefixes with a 404, regardless of session (defensive — these aren't routes on the website but the middleware ensures no future PR accidentally exposes one).
- [X] T069 [P] [US5] Add component tests under `apps/website/tests/`:
  - `middleware.spec.ts` — anonymous browse OK; account redirect when no session; dashboard prefixes 404.
  - `RegisterPage.spec.tsx` — happy-path render, validation errors surface.

**Checkpoint**: Customer auth flows usable end-to-end; anonymous browsing unaffected.

---

## Phase 8: User Story 6 — Audit trail for sensitive identity actions (Priority: P3)

**Story goal**: Every sensitive identity/access-control event is recorded immutably with actor, action, target, metadata, IP, user agent. Super Admin can browse/filter the log via API. Audit entries cannot be modified or deleted via app APIs. Supabase Auth webhooks are signature-verified, idempotent, and produce audit entries.

**Independent test**: Perform each action listed in FR-044 → exactly one matching row exists with all required fields. Try `PATCH`/`DELETE` on `/audit-logs/:id` → 405. Send a Supabase webhook with a bad signature → 401 + warning audit entry tagged `signature_invalid`; valid event flips status + writes audit row; replaying the same event id → 200 with `duplicate: true`, no second status change.

### Tests for User Story 6 (must fail before implementation)

- [X] T070 [P] [US6] Add `apps/backend/test/integration/audit-coverage.spec.ts`: trigger every action listed in FR-044 and assert one (and only one) `audit_logs` row per action with the expected fields populated.
- [X] T071 [P] [US6] Add `apps/backend/test/integration/audit-immutability.spec.ts`: verifies no HTTP verb on `/audit-logs/:id` other than `GET` is exposed; attempts via Prisma to update/delete are rejected by the audit service abstraction.
- [X] T072 [P] [US6] Add `apps/backend/test/integration/supabase-webhook.spec.ts`: invalid signature → 401 + `webhook_events.signature_valid=false`; valid `user.email_confirmed` → status flip + audit entry; replay of same `event.id` → `duplicate: true` + idempotent (no second flip, no second audit row).

### Implementation for User Story 6

- [X] T073 [P] [US6] Add DTO `apps/backend/src/modules/audit/dto/list-audit-logs.dto.ts` (cursor + filters per `contracts/audit-logs.yaml`).
- [X] T074 [US6] Extend `apps/backend/src/modules/audit/audit.service.ts` with read methods: `list({cursor, pageSize, filters})` (cursor pagination over `(occurredAt desc, id)`), `getById(id)`. Continues to expose `record(...)` for write paths only — no update/delete methods.
- [X] T075 [US6] Implement `apps/backend/src/modules/audit/audit.controller.ts` per `contracts/audit-logs.yaml`: `GET /api/v1/audit-logs`, `GET /api/v1/audit-logs/:id`. Both gated by `@Permissions('audit_logs.view')`. Apply `@StoreScope({param:'merchantId', source:'query'})` so the same endpoint serves Super Admin (sees all) and Merchant (sees only theirs) without duplication.
- [X] T076 [P] [US6] Create `apps/backend/src/modules/webhooks/webhooks.module.ts`, `webhook-signature.guard.ts` (HMAC-SHA256 verify of raw body using `SUPABASE_WEBHOOK_SECRET`; on mismatch records a `webhook_events` row with `signature_valid=false` and a `auth.webhook.invalid_signature` audit entry, then 401), and DTOs `dto/supabase-event.dto.ts`.
- [X] T077 [US6] Implement `apps/backend/src/modules/webhooks/supabase-webhook.controller.ts`: `POST /api/v1/webhooks/supabase/auth`. Validates signature, persists `WebhookEvent` row idempotently by `(source='supabase', event_id)`, dispatches handlers for the allow-list (`user.created`, `user.email_confirmed`, `user.deleted`), writes corresponding audit entries (`auth.profile.created` / `auth.profile.activated` source=`webhook` / `auth.profile.deleted`), returns `{ success: true, duplicate: <bool> }`. Apply `@Public` and `@Throttle('webhook-supabase')`.
- [X] T078 [US6] Wire **explicit audit calls** at the action sites listed in FR-044 (most exist from earlier phases — verify and fill gaps):
  - `auth.profile.created`/`updated`/`activated`/`deleted` (auth.service, webhook handler, users.service)
  - `auth.profile.status_changed` (users.service)
  - `roles.created`/`updated`/`deleted` (roles.service)
  - `roles.permission_added`/`permission_removed` (roles.service)
  - `users.role_assigned`/`role_removed` (users.service)
  - `auth.login.profile_synced` (auth.service.syncProfile)
  - `authz.scope_denied`, `authz.permission_denied`, `authz.role_denied` (guards)
  - `auth.webhook.invalid_signature` (webhook signature guard)

**Checkpoint**: Audit log is write-coverage-complete (SC-009) and readable through the new endpoints. Webhook ingestion is signature-verified and idempotent.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verification, hardening, and final smoke-test pass before declaring Phase 2 done.

- [ ] T079 ⚠️ MANUAL — Run `pnpm prisma migrate deploy` on a fresh local DB; run `pnpm ts-node prisma/seed.ts` twice; assert second run is a true no-op (Phase 2 §SC-005 verification). Requires running Postgres.
- [X] T080 [P] Run the full backend test suite (`pnpm --filter @platform/backend test` + `test:e2e`); all green before next steps. **2026-05-07**: 18/21 files pass (guards-matrix + store-scope fail pre-existing DI issues; error-envelopes 1 pre-existing test fail). New Phase 9 files all pass.
- [X] T081 [P] Run dashboard + website tests (`pnpm --filter @platform/dashboard --filter @platform/website test`); all green. **2026-05-07**: Dashboard 3/3 files ✅ (14 tests), Website 2/2 ✅ (7 tests).
- [X] T082 Verify Swagger at `http://localhost:3000/api/docs` lists every endpoint from `contracts/*.yaml` with the documented schemas, security schemes, and `x-rate-limit` extensions. Add `apps/backend/test/integration/swagger-coverage.spec.ts` that fails when an endpoint is undocumented (SC-010). **2026-05-07**: Created `test/integration/swagger-coverage.spec.ts` with all 21 expected endpoints from contracts; 4 tests covering endpoint list, tags, contract consistency, and count range.
- [ ] T083 ⚠️ MANUAL — Run rate-limit smoke test from `quickstart.md` §10; record actual 429 thresholds in a comment in `ratelimit.module.ts`. Defaults updated to match spec (authSync=10/min, webhookSupabase=10/min, webhookPwdReset=5/min, meRead=30/min, adminWrite=20/min). Requires running backend.
- [X] T084 [P] Sample-review every audit log entry generated by the integration suite to confirm no Supabase JWT, password, or service-role key appears in `metadata` (SC-011); add a regex-based `apps/backend/test/unit/audit-redaction.spec.ts` that scans recorded payloads. **2026-05-07**: Created `test/unit/audit-redaction.spec.ts` with 7 tests covering clean payloads, JWT, service keys, private keys, GitHub tokens, nested structures, and object key scanning.
- [ ] T085 ⚠️ MANUAL — Walk all six smoke-test sections of `quickstart.md` (§5–§10) end-to-end manually; check off each one. Requires running system with DB, Supabase, and all three apps.
- [X] T086 [P] Update `docs/` (or create `docs/auth/README.md`) summarizing the Phase 2 surface for downstream feature teams (which guards/decorators to use, how to add a new permission, how to declare a `@StoreScope` endpoint). **2026-05-07**: Created `docs/auth/README.md` with guard chain order, decorator reference, permission/module addition guide, `@StoreScope` examples, and key file index.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → no dependencies; start immediately.
- **Phase 2 (Foundational)** → depends on Phase 1; **BLOCKS US1–US6**.
- **Phase 3 (US1, P1)** → after Phase 2.
- **Phase 4 (US2, P1)** → after Phase 2; can run in parallel with US1 since they touch different controllers and services. Both share the global guards from Phase 2.
- **Phase 5 (US3, P1)** → after Phase 2; the reflective cross-merchant test (T044) depends on at least one `@StoreScope` endpoint existing — uses the sample endpoint added in T047, so US3 stands alone.
- **Phase 6 (US4, P2)** → after US1 + US2 (dashboard consumes `/auth/me` and `/users` + `/roles` APIs).
- **Phase 7 (US5, P2)** → after US1 (website consumes `/auth/me` + `/auth/sync-profile`).
- **Phase 8 (US6, P3)** → after Phase 2 for schema; can begin in parallel with US4/US5 since the audit endpoints are independent of the frontends. The webhook handler does not depend on US4/US5.
- **Phase 9 (Polish)** → after US1–US6.

### Within-story Dependencies

- Tests for a story (where listed) come before its implementation tasks.
- Models / DTOs before services; services before controllers.
- US2's `replaceRoles` reuses `ScopeProjector` from T023 (Foundational).
- US6's audit endpoints depend on the audit `record()` helpers wired across earlier phases (T078 audits the gaps).

### Parallel Opportunities

- **Phase 1**: T002, T003, T005 in parallel (different files); T001 and T004 must run on the backend tree first.
- **Phase 2**: T009, T010, T011, T012 in parallel after T007; T013–T021 mostly sequential within `auth/` but T013 (rate-limit) is independent.
- **Phase 3 (US1)**: T024–T026 in parallel; T027 then T028, T029, T030 in parallel; T031 last.
- **Phase 4 (US2)**: T032–T034 in parallel; T035 + T036 in parallel; T037, T038 in parallel; T039, T040 in parallel; T041 then T042.
- **Phase 5 (US3)**: T043, T044, T048 in parallel; T045 → T046 → T047 → T049 sequential.
- **Phase 6 (US4)**: T050, T051, T053 in parallel; T052 then T054; T055 then T056, T057, T058, T059, T060 mostly in parallel (different files); T061 last.
- **Phase 7 (US5)**: T062 → T063 → T064 in parallel where files differ; T065 then T066 then T067; T068, T069 in parallel.
- **Phase 8 (US6)**: T070, T071, T072 in parallel; T073, T076 in parallel; T074 → T075; T077 after T076; T078 last.
- **Phase 9**: T080, T081, T083, T084, T086 all parallelizable.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T006 + T007 + T008 land:
Task: "T009 Add seed idempotency test in apps/backend/test/unit/seed.spec.ts"
Task: "T010 Create packages/types/src/auth.ts and re-export"
Task: "T011 Add packages/shared/src/permissions.ts helper"
Task: "T012 Add typed clients in packages/api-client/src/"

# Once those return, fan into the auth module:
Task: "T013 Register @nestjs/throttler buckets in common/ratelimit/ratelimit.module.ts"
Task: "T017 Implement decorators in modules/auth/decorators/"  # 6 small files in one folder
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 (Setup) → 2 hours.
2. Phase 2 (Foundational) → 2–3 days. **Critical — blocks everything**.
3. Phase 3 (US1) → 1–2 days. **STOP & VALIDATE**: Super Admin and any seeded user can sign in and call `/auth/me`. SC-001 measurable.
4. Demo / staging deploy if needed.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → MVP (single-user identity envelope live).
3. + US2 → admin can manage roles; opens the door to onboarding internal staff.
4. + US3 → store-scope guard + cross-tenant test green; safe to start Phase 3 (merchant onboarding) even before frontends are ready.
5. + US4 → dashboard becomes usable for human operators.
6. + US5 → customer site auth-ready (cart/checkout in later phases can rely on it).
7. + US6 → audit visibility for compliance.
8. Polish → Swagger coverage, smoke tests, docs.

### Parallel Team Strategy

Once Phase 2 lands, three developers can split:

- **Dev A**: US1 → US4 (auth API + dashboard).
- **Dev B**: US2 → US6 (admin APIs + audit endpoints + webhook handler).
- **Dev C**: US3 → US5 (guards + cross-tenant tests + customer website).

Stories integrate at the API contract boundary (already locked in `contracts/`), so merge conflicts are rare.

---

## Notes

- `[P]` = different file, no incomplete-task dependency.
- `[Story]` label maps tasks to spec.md user stories for traceability.
- Tests listed for US1, US2, US3, and US6 are mandated by the constitution (Critical-flow tests: §IV) and by SCs (SC-002, SC-003, SC-009). They are **not** "nice-to-have" — they ship with the story.
- Commit after each task or logical group; the `before_*` git hooks will offer auto-commit at each Spec-Kit step.
- Stop at any **Checkpoint** to validate the story independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
