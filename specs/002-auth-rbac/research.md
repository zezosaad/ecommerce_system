# Phase 0 Research — Authentication, Users, Roles & Permissions

**Feature**: `002-auth-rbac` | **Date**: 2026-05-07

This document resolves the open technical questions implied by the plan's Technical Context. Every NEEDS CLARIFICATION from earlier in the spec lifecycle has been answered (see `spec.md` → Clarifications section). What remains here is the engineering "best practices" research needed before writing the data model, contracts, and tasks.

---

## R1 — Supabase JWT verification (JWKS, issuer, audience)

**Decision**: Verify Supabase JWTs using the Supabase project's published JWKS endpoint, with the `jose` library. Validate `iss` (project URL), `aud` (`authenticated` for end users), `exp`, `iat`, and a configurable `clockTolerance` (default 5 s). Cache JWKS in-process with a 1-hour TTL plus on-demand refresh on `kid` miss.

**Rationale**:
- Phase 1 already started this (`apps/backend/src/modules/supabase/jwks-cache.service.ts`, `jwks-utils.ts`, `auth/jwt.verifier.ts`).
- JWKS verification is the recommended path for Supabase: it supports key rotation without code changes, unlike a shared HMAC secret.
- 1-hour TTL is the Supabase default JWK rotation cadence floor; on `kid` miss we refresh immediately so rotation is transparent.

**Alternatives considered**:
- Shared HMAC secret (`SUPABASE_JWT_SECRET`): simpler, but breaks if Supabase rotates keys, and forces sharing a high-value secret across services. Rejected.
- Calling Supabase `/auth/v1/user` for every request: authoritative but adds an external round-trip per call. Rejected on latency grounds (SC-001 budget).

---

## R2 — Permission resolution & caching

**Decision**: Compute effective permissions per user as the union of `RolePermission` rows across all `UserRole` assignments, plus a Super Admin shortcut (full set). Cache the result in an in-process LRU keyed by `userId` with a 60-second TTL and an event-driven invalidation hook. Invalidation events: any write to `UserRole`, `RolePermission`, or `User.status`. Cache lives in `EffectivePermissionsService` (singleton).

**Rationale**:
- FR-021 caps stale enforcement at 60 s and requires invalidation on writes — an LRU + explicit `invalidate(userId)` on the write path satisfies both.
- In-process cache is sufficient for a single-node monolith. When we scale horizontally, swap LRU for Redis pub/sub cache without changing the call sites.
- Super Admin is computed, never stored as ~80 explicit `RolePermission` rows — keeps the role indestructible regardless of seed re-runs.

**Alternatives considered**:
- Database-side materialized view: faster reads, but stale-window control becomes a refresh-job problem and writes get heavier.
- Recompute on every request without cache: simplest, but risks exceeding the 25 ms p95 permission-check budget under modest load.
- Embed permissions in the JWT: tempting (zero DB lookups) but fights FR-021's "near-real-time on permission change" requirement and violates Constitution §IV's principle that authorization is computed server-side.

---

## R3 — Profile sync vs. lazy creation on first protected call

**Decision**: Both supported. Frontend explicitly calls `POST /api/v1/auth/sync-profile` immediately after Supabase signs the user in. As a safety net, `GET /api/v1/auth/me` will create-on-read if the caller's Supabase identity has no application profile yet (idempotent). All other protected endpoints reject with a domain-specific error (`AUTH/PROFILE_REQUIRED`) telling the client to call `sync-profile` (or `me`).

**Rationale**:
- The explicit sync endpoint gives the frontend a single, predictable place to handle profile-creation errors and to populate first-login defaults (locale from `Accept-Language`, currency from platform setting).
- The `me` create-on-read fallback handles the race where a token arrives at the server before the frontend ran sync (e.g., direct API testing, mobile clients later).
- Rejecting other endpoints prevents accidental partial state from a half-onboarded user reaching business modules.

**Alternatives considered**:
- Lazy-create on every endpoint: convenient but spreads identity-creation logic across every controller and complicates auditing.
- Supabase trigger that inserts a Postgres row on `auth.users` insert: tight coupling between Supabase's schema and ours, and breaks if we ever swap identity providers.

---

## R4 — Supabase Auth webhook for `pending_verification` → `active`

**Decision**: Expose `POST /api/v1/webhooks/supabase/auth` protected by HMAC signature verification using `SUPABASE_WEBHOOK_SECRET`. Process events `user.email_confirmed` (and a small allow-list for forward-compat). Payload is signature-verified before parsing; raw body is logged. Implementation is **idempotent** by Supabase's event id (we keep a `WebhookEvent` table — see data-model — and ignore duplicates). On `email_confirmed` for a `pending_verification` profile, flip status to `active`, write an audit entry. As a fallback (FR-005b), every authenticated request from a `pending_verification` user re-reads `email_confirmed_at` from Supabase and applies the same flip if needed.

**Rationale**:
- Constitution §IV requires webhooks to be signature-verified, logged, and processed idempotently. Storing event ids satisfies idempotency without per-event Redis dependencies.
- The lazy fallback covers both webhook outages and local-dev environments where the webhook may not be reachable.

**Alternatives considered**:
- Polling Supabase for verification: wastes capacity and adds latency. Rejected.
- Pure lazy reconciliation (no webhook): simpler but violates the spec's clarified answer (Q2 / Option A).

---

## R5 — Rate limiting (per-IP, per-user, configurable)

**Decision**: Use `@nestjs/throttler` v5 with multiple named throttler buckets registered globally and applied per-route via decorators. Buckets:

| Bucket name      | Scope              | Limit                                  | Applied to                                                                 |
|------------------|--------------------|----------------------------------------|----------------------------------------------------------------------------|
| `auth-sync`      | per-IP             | env `RL_AUTH_SYNC_PER_MIN` (default 10) | `POST /auth/sync-profile`                                                  |
| `webhook-supabase` | per-IP           | env `RL_WEBHOOK_SUPABASE_PER_MIN` (10) | `POST /webhooks/supabase/auth`                                             |
| `webhook-pwd-reset` | per-IP          | env `RL_WEBHOOK_PWD_RESET_PER_MIN` (5)  | password-reset webhook handler (when wired)                                |
| `me-read`        | per-user           | env `RL_ME_READ_PER_MIN` (30)           | `GET /auth/me`, `GET /me/permissions`, `GET /me/roles`, `GET /me/access-scope` |
| `admin-write`    | per-user           | env `RL_ADMIN_WRITE_PER_MIN` (20)       | role/permission/user-status writes (FR-028, FR-029)                        |

Per-user buckets key off `request.user.id` after auth resolves; per-IP buckets key off `X-Forwarded-For` last hop with a configurable trusted proxy hop count.

**Rationale**:
- `@nestjs/throttler` is the canonical Nest solution and supports named storages, multiple buckets per route, and DI-friendly stores. Phase 3+ can swap the in-memory store for Redis without touching call sites.
- Splitting into named buckets makes the FR-048 thresholds visible in code and verifiable via integration tests.

**Alternatives considered**:
- Bare middleware with `express-rate-limit`: works, but no first-class user-key support and worse interop with Nest DI.
- Nginx-side rate limiting only: opaque to backend tests and can't key on authenticated `userId`.

---

## R6 — Audit log read query shape & indexing

**Decision**:
- Phase 1 already created indexes: `(occurred_at DESC)`, `(actor_user_id, occurred_at DESC)`, `(merchant_id, occurred_at DESC)`, `(target_type, target_id)`, `(action_code)`. These cover the FR-031a filter set (`actorUserId`, `action`, `entityType`, `entityId`, date range).
- Use cursor pagination (`occurred_at` desc + `id` tiebreaker) for the list endpoint; offset pagination is rejected for an append-only table because page drift becomes pathological as new rows arrive.
- Add a small additional composite index `(action_code, occurred_at DESC)` to make per-action filtering scale once the table is large.

**Rationale**:
- Cursor pagination over `(occurred_at, id)` is stable under inserts, which is exactly what an audit log gets all day.
- The new composite index is cheap and the most common admin query is "show me everything that happened in module X recently."

**Alternatives considered**:
- Full-text search on `metadata` JSONB: deferred — not in spec scope and adds a GIN index we don't yet need.

---

## R7 — Status enum migration from Phase 1's `is_active` boolean

**Decision**: Replace `User.isActive` (`Boolean`) with `User.status` (Postgres enum `user_status` of `active`, `inactive`, `suspended`, `pending_verification`, `deleted`). Migration steps:

1. Add the enum type.
2. Add `status user_status NOT NULL DEFAULT 'active'`.
3. Backfill: `status = CASE WHEN deleted_at IS NOT NULL THEN 'deleted' WHEN is_active = false THEN 'inactive' ELSE 'active' END`.
4. Drop `is_active`.

Also split `display_name` into `first_name` / `last_name` (both `TEXT NULL`); backfill best-effort by `split_part(display_name, ' ', 1)` for first and the remainder for last; keep `display_name` for one release as a generated column or drop it after Phase 2 stabilizes (decision: drop in Phase 2 — Phase 1 has no consumers depending on it).

**Rationale**:
- Phase 1 schema is recent and not yet carrying real customer data, so a single forward-only migration is safe.
- A Postgres enum gives us referential integrity at the database level and prevents typos like `"Active"`.

**Alternatives considered**:
- Keep `is_active` and add `status` alongside: dual sources of truth invite drift. Rejected.
- Use a `lookup` table instead of an enum: enum is cheaper, faster, type-checked from Prisma.

---

## R8 — `UserAccessScope` and `StaffMembership` shape

**Decision**:
- **`UserAccessScope`**: a denormalized read-side projection — one row per `(userId, merchantId?, storeId?, scopeType)` tuple. `scopeType` is one of `platform`, `merchant`, `store`. Populated as a side-effect of `UserRole` writes (in the same transaction) and rebuilt by a maintenance script. Used by `StoreScopeGuard` to answer "is user U allowed to act on merchant M?" in a single indexed lookup, avoiding a join across `UserRole` for every guarded call.
- **`StaffMembership`**: a foundation table (Phase 3 owns its full lifecycle) with `id`, `userId`, `merchantId`, `storeId?`, `status` (`active`/`invited`/`suspended`), `invitedAt`, `joinedAt?`, `createdAt`, `updatedAt`. Phase 2 only creates the table + indexes + a placeholder service used by the seed and tests; the staff-invite UX is deferred.

**Rationale**:
- A separate scope projection is the cleanest way to keep guard reads O(1) without re-engineering `UserRole`.
- Foundationing `StaffMembership` now means Phase 3 (merchant onboarding) doesn't have to ship a migration during a release where it's already adding lots of merchant tables.

**Alternatives considered**:
- Compute scope from `UserRole` on every request: fine at small scale, but couples guard latency to `UserRole` row count and cardinality.
- Defer `StaffMembership` entirely to Phase 3: would require Phase 3 to add it during onboarding rollout, increasing risk; the spec explicitly asks for a "foundation" record now (FR-025).

---

## R9 — Frontend session handling (Next.js App Router + Supabase)

**Decision**: Use `@supabase/ssr` with Next.js App Router patterns:
- A browser Supabase client created via `createBrowserClient` for client components.
- A server Supabase client created via `createServerClient` per request (reads cookies, refreshes session) for server components, route handlers, and middleware.
- Auth cookies are HTTP-only, `Secure` in production, `SameSite=Lax`, with the path scoped to the app's root.
- Frontend never sees the service role key — only the anon key (publishable).
- Backend session validation is done by **always** sending the Supabase `access_token` as `Authorization: Bearer …` to NestJS; the backend never reads cookies.

**Rationale**:
- `@supabase/ssr` is Supabase's recommended path for App Router and handles the cookie/session refresh choreography cleanly.
- Splitting "frontend uses Supabase JS to manage the session" from "backend validates JWT statelessly" keeps the contract clean and lets Flutter (later) reuse the same backend without any cookie story.

**Alternatives considered**:
- Custom session store (Iron Session etc.): more code, more attack surface, no Supabase upside.
- Storing tokens in `localStorage`: vulnerable to XSS exfiltration. Rejected.

---

## R10 — Internationalization & RTL (auth screens)

**Decision**: Continue the `[locale]` route segment + `next-intl` pattern already in Phase 1. Auth screens (login/register/reset/unauthorized/suspended/loading) live under `apps/dashboard/src/app/[locale]/(auth)/…` and `apps/website/src/app/[locale]/(auth)/…`. Translation keys land in `packages/i18n/{en.json,ar.json}` under an `auth.*` namespace. RTL is driven by `dir={locale === 'ar' ? 'rtl' : 'ltr'}` on `<html>` in the root layout (already wired in Phase 1) plus Tailwind's `rtl:` variants for any directional asymmetry.

**Rationale**:
- Reuses Phase 1 plumbing; Phase 2 only adds copy and a few directional Tailwind variants.

**Alternatives considered**:
- Switch to `next-i18next`: backwards step, no advantage.

---

## R11 — Customer ↔ dashboard role-based access decision

**Decision** (per spec Clarification Q1, Option A):
- Dashboard middleware checks: authenticated AND has at least one role with `code != 'customer'`. If only role is `customer`, redirect to the website's account area.
- The customer site never gates on roles; it gates only on auth-required vs. public.
- Backend enforcement is independent: `RolesGuard` and `PermissionsGuard` are the source of truth; the middleware is UX only.

**Rationale**: Matches the clarified spec exactly. Implementation is a single helper (`hasNonCustomerRole(envelope)`) shared via `packages/api-client` so the rule lives in one place.

---

## R12 — Seed strategy (idempotent, additive)

**Decision**:
- All system roles are upserted by `code` (the stable key — Phase 1 already names the column `code` rather than `key`; we'll align spec wording in data-model.md).
- All permissions are upserted by `code` (the canonical `module.resource.action` string).
- All `RolePermission` defaults for system roles are reconciled by computing `desired - actual` and inserting the diff (never deleting custom additions an admin made).
- `super_admin` role-permission rows are **not** seeded (FR-012: Super Admin computed at runtime).
- Re-running the seed is the supported way to introduce new permissions or new system roles in later phases.

**Rationale**:
- Idempotency is non-negotiable per spec and Constitution.
- Reconcile-without-delete is the only safe pattern in a multi-phase project where new modules will keep adding permissions.

---

## R13 — Testing approach for cross-merchant isolation (SC-003)

**Decision**: Add an integration test suite `tests/integration/store-scope.spec.ts` that:
1. Seeds two merchants (M1, M2) and two stores (S1 under M1, S2 under M2).
2. Provisions one Merchant Staff user under M1/S1 with full merchant permissions.
3. Walks every `@StoreScope`-annotated endpoint discovered via NestJS metadata reflection, calling each one with M2/S2 ids using the M1/S1 user's JWT.
4. Asserts every call returns 403 with the standard envelope and that an audit-log row is written.

**Rationale**:
- Reflection-driven test means the suite stays correct as new endpoints are added in later phases — no hand-maintained list to forget.
- Constitution §II calls cross-tenant data leakage a release blocker; this is the test that enforces it.

**Alternatives considered**:
- Per-endpoint hand-written tests: comprehensive but rots fast.

---

## R14 — Logout semantics

**Decision**: Backend `POST /api/v1/auth/logout` is a thin endpoint that:
1. Authenticates the caller.
2. Writes an audit entry (`auth.logout`).
3. Returns `204 No Content`.

It does **not** invalidate the JWT (Supabase JWTs are stateless until expiry). The frontend is responsible for calling Supabase JS `signOut()` to clear the session locally and revoke the refresh token at Supabase.

**Rationale**:
- Spec assumption documents this clearly. Building a server-side revocation list is out of scope for Phase 2 and would also require swapping JWT verification for a stateful check, which contradicts our stateless authorization design.

**Alternatives considered**:
- Maintain a Postgres-backed JWT denylist consulted by every request: high cost, revisit only if/when we have an incident pattern that demands it.

---

## Open items (deferred, not blocking)

None. Every NEEDS CLARIFICATION from the spec was resolved during `/speckit.clarify`. Anything ambiguous found during research has a decision above.
