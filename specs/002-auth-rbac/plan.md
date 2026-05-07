# Implementation Plan: Authentication, Users, Roles & Permissions Foundation

**Branch**: `002-auth-rbac` | **Date**: 2026-05-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-auth-rbac/spec.md`

## Summary

Phase 2 builds out the identity, RBAC, scope-isolation, and audit foundation on top of the Phase 1 skeleton (`apps/backend`, `apps/dashboard`, `apps/website`, `packages/types`, `packages/i18n`, `packages/api-client`). Phase 1 already shipped a Prisma schema with `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, and `AuditLog` models, NestJS module skeletons (`auth`, `users`, `roles`, `audit`, `supabase`, `common`), and Next.js app shells with `[locale]` routing. Phase 2 promotes those skeletons to a working, guarded, audited, internationalized auth surface, adds the missing schema (status enum, `first_name`/`last_name` split, `UserAccessScope`, `StaffMembership`, Supabase webhook events table), implements every guard and decorator the spec lists, ships the eight role + ~80-permission seed, exposes the documented REST API with OpenAPI, and adds login + role-aware navigation in both Next.js apps with full Arabic/English RTL support.

## Technical Context

**Language/Version**: TypeScript 5.x (strict). Node.js 20 LTS for backend.
**Primary Dependencies**:
- Backend: NestJS 10, Prisma 5, `@nestjs/swagger`, `@nestjs/throttler` (rate limiting), `class-validator`, `class-transformer`, `@supabase/supabase-js` (admin only), `jose` (JWKS-based JWT verification — already in Phase 1 `jwks-cache.service.ts` / `jwks-utils.ts`).
- Dashboard & Website: Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui (dashboard only), `@supabase/ssr` for browser/server session handling, `next-intl` (already wired via `packages/i18n`).
- Shared: `packages/types` for envelopes & DTOs, `packages/api-client` for frontend HTTP, `packages/i18n` for AR/EN strings.
**Storage**: Supabase PostgreSQL via Prisma. Audit logs in same DB. JWKS keys cached in-process (Phase 1 service).
**Testing**:
- Backend: Jest unit + integration; Supertest for HTTP. Integration tests run against a disposable Postgres (Docker) seeded by `prisma migrate deploy` + `seed.ts`.
- Frontend: Vitest unit + Playwright (or Vitest + React Testing Library) for component/page tests. Already configured in Phase 1 (`vitest.config.ts` present in both apps).
**Target Platform**: Linux containers behind Nginx on a VPS (Docker / Docker Compose, per Phase 1).
**Project Type**: Web application — modular monolith backend + two Next.js frontends + Flutter (deferred). Multi-package pnpm/turbo monorepo (already established).
**Performance Goals**:
- `GET /api/v1/auth/me` p95 ≤ 300 ms end-to-end (SC-001).
- Effective permission resolution: ≤ 25 ms p95 server-side via in-process LRU cache with 60-second TTL and explicit invalidation on role/permission/status writes (FR-021).
- Webhook handlers: ≤ 200 ms p95 to ack Supabase.
**Constraints**:
- Cross-merchant data leakage is forbidden (Constitution §II) — every store-scoped endpoint must pass tenant context to repositories.
- Service role keys live only in backend env (Constitution §IV) — confirm via build-time check in `apps/dashboard` and `apps/website`.
- Rate limits per FR-048: per-IP 10/min on `sync-profile` + Supabase webhooks, per-IP 5/min on password-reset webhook, per-user 30/min on `me` + self-introspection, per-user 20/min on role/permission/user-status writes. All values configurable via env.
- 1-year minimum audit log retention (FR-046a) — schema must support efficient purge/archival in the future without migration.
**Scale/Scope**:
- Initial users: 5–10 internal staff, low hundreds of merchants in year 1, tens of thousands of customers. Role catalog: 8 system roles + a handful of custom roles. Permission catalog: ~80 permissions across 17 modules.
- API surface for Phase 2: ~22 endpoints across `auth`, `users`, `roles`, `permissions`, `me`, `audit-logs`, `webhooks/supabase`.

## Constitution Check

Cross-referenced against Constitution v1.0.0, Principles I–VIII and Domain Rules. See `.specify/memory/constitution.md`.

| Principle | Compliance | Evidence |
|-----------|-----------|----------|
| I — Modular Monolith & Backend Ownership | ✅ | All identity/RBAC logic lives in NestJS modules (`auth`, `users`, `roles`, `permissions`, `audit`); Next.js apps call backend APIs only. Prisma is the only ORM. Supabase Auth is the identity provider but every authorization decision is computed in NestJS. Cross-module access goes through `AuthContextService` and Nest providers, never via direct repository imports. |
| II — Multi-Tenancy & Data Isolation | ✅ | `UserRole.merchantId` and `UserRole.storeId` already nullable in Phase 1; Phase 2 introduces `UserAccessScope` and `StaffMembership` for explicit scope. New `StoreScopeGuard` enforces tenant context per-request; integration tests cover Merchant A → Merchant B leakage (SC-003). |
| III — Spec-First Development | ✅ | spec.md ratified (with 5 clarifications recorded). plan.md, data-model.md, contracts/, quickstart.md generated by this command. tasks.md follows in `/speckit.tasks`. |
| IV — Security, Auth & Audit by Default | ✅ | `SupabaseJwtAuthGuard` is global default; every protected endpoint also passes `ActiveUserGuard`. Permissions checked server-side; service-role key bound to backend env only. Audit entries written for every action listed in FR-044. Webhook handlers verify the Supabase webhook signing secret before any DB write. Idempotency interceptor (Phase 1) wraps role/permission/user-status writes. |
| V — API Contract Discipline | ✅ | All endpoints under `/api/v1`. Swagger generated from `@nestjs/swagger` decorators on controllers and DTOs. Pagination, success envelope, error envelope from Phase 1 `packages/types/envelopes.ts`. Webhook handlers signature-verify, log raw payload (raw-body slice, no PII expansion), and use a unique-event-id idempotency key. |
| VI — Configuration Over Hardcoding | ✅ | Rate limits, JWT clock skew, profile-cache TTL, audit retention enforcement window, webhook signing secret, allowed CORS origins — all env-backed via `apps/backend/src/modules/config`. Default-currency / default-language fall back to platform `Setting` rows where present. |
| VII — Internationalization & RTL First-Class | ✅ | `Role.label` and `Role.description`, `Permission.description`, audit `metadata.message` are JSON `{ ar, en }` (Phase 1 schema already JSON for label/description). Both dashboard and website are bilingual via `[locale]` routing already in place. Login/unauthorized/suspended/loading screens ship with AR + EN copy and verified RTL layout. |
| VIII — Production-Ready Quality Bar | ✅ | TS strict everywhere (Phase 1). Layered: Controllers → Services → Prisma. DTOs validate every input. Frontends have explicit loading/empty/error/forbidden states. All code & DB identifiers in English. Critical-flow tests: JWT validation, role/permission resolution, suspended-user blocking, store-scope isolation, audit immutability. |

**Result**: PASS. No principle is violated. No entries needed in **Complexity Tracking**.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-rbac/
├── plan.md              # This file
├── spec.md              # Feature specification (with Clarifications section)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (Prisma deltas + entity contracts)
├── quickstart.md        # Phase 1 output (developer bring-up + smoke tests)
├── contracts/           # Phase 1 output (OpenAPI fragments per resource)
│   ├── auth.yaml
│   ├── users.yaml
│   ├── roles.yaml
│   ├── permissions.yaml
│   ├── me.yaml
│   ├── audit-logs.yaml
│   └── webhooks.yaml
├── checklists/
│   └── requirements.md  # Created by /speckit.specify
└── tasks.md             # Created by /speckit.tasks (NOT this command)
```

### Source Code (repository root)

The monorepo layout is already established by Phase 1. Phase 2 modifies/extends the highlighted paths and creates the new ones marked `[NEW]`.

```text
apps/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma                          # extend: status enum, name split, scope models
│   │   ├── migrations/                            # new migration: 002_auth_rbac
│   │   ├── seed.ts                                # extend: 8 roles, ~80 permissions, role-permission seed
│   │   └── sql/                                   # any RAW SQL helpers
│   └── src/
│       ├── app.module.ts
│       ├── main.ts
│       └── modules/
│           ├── auth/                              # implement guards + controllers
│           │   ├── auth.module.ts
│           │   ├── auth.controller.ts             [NEW]  # /auth/me, /auth/sync-profile, /auth/profile, /auth/logout
│           │   ├── auth.service.ts                [NEW]  # profile sync + envelope assembly + cache invalidation
│           │   ├── jwt.verifier.ts                # tighten: issuer/audience checks, clock skew
│           │   ├── jwt-auth.guard.ts              # SupabaseJwtAuthGuard — finalize
│           │   ├── active-user.guard.ts           [NEW]  # ActiveUserGuard
│           │   ├── roles.guard.ts                 [NEW]  # RolesGuard
│           │   ├── permissions.guard.ts           # tighten: read from EffectivePermissions service
│           │   ├── store-scope.guard.ts           [NEW]  # StoreScopeGuard
│           │   ├── effective-permissions.service.ts [NEW] # in-proc LRU + invalidation
│           │   ├── auth-context.service.ts        # extend: include access scope
│           │   ├── decorators/
│           │   │   ├── current-user.decorator.ts
│           │   │   ├── public.decorator.ts
│           │   │   ├── roles.decorator.ts         [NEW]
│           │   │   ├── permissions.decorator.ts
│           │   │   ├── store-scope.decorator.ts   [NEW]
│           │   │   └── optional-auth.decorator.ts [NEW]
│           │   └── dto/
│           │       ├── sync-profile.dto.ts        [NEW]
│           │       ├── update-profile.dto.ts      [NEW]
│           │       └── auth-envelope.dto.ts       [NEW]
│           ├── users/
│           │   ├── users.module.ts
│           │   ├── users.controller.ts            # implement list/detail/status/roles
│           │   ├── users.service.ts               [NEW]
│           │   └── dto/
│           │       ├── list-users.dto.ts          [NEW]
│           │       ├── update-user-status.dto.ts  [NEW]
│           │       └── update-user-roles.dto.ts   [NEW]
│           ├── roles/
│           │   ├── roles.module.ts
│           │   ├── roles.controller.ts            # implement CRUD
│           │   ├── roles.service.ts               [NEW]
│           │   ├── permissions.controller.ts      # implement /permissions, /permissions/grouped
│           │   ├── permissions.service.ts         [NEW]
│           │   └── dto/
│           │       ├── create-role.dto.ts         [NEW]
│           │       ├── update-role.dto.ts         [NEW]
│           │       └── set-role-permissions.dto.ts [NEW]
│           ├── me/                                [NEW]  # self-introspection
│           │   ├── me.module.ts
│           │   ├── me.controller.ts               # /me/permissions, /me/roles, /me/access-scope
│           │   └── me.service.ts
│           ├── audit/
│           │   ├── audit.module.ts
│           │   ├── audit.service.ts               # extend: query API for read endpoints
│           │   ├── audit.controller.ts            [NEW]  # /audit-logs (list + by-id)
│           │   ├── audit.interceptor.ts           # already present — keep
│           │   └── dto/
│           │       └── list-audit-logs.dto.ts     [NEW]
│           ├── supabase/
│           │   ├── supabase.module.ts
│           │   ├── supabase.service.ts            # admin client wrapper
│           │   ├── jwks-cache.service.ts          # already present
│           │   └── jwks-utils.ts                  # already present
│           ├── webhooks/                          [NEW]
│           │   ├── webhooks.module.ts
│           │   ├── supabase-webhook.controller.ts # /webhooks/supabase/auth
│           │   ├── webhook-signature.guard.ts
│           │   └── dto/supabase-event.dto.ts
│           └── common/
│               ├── envelopes/                     # already present
│               ├── filters/                       # already present
│               ├── interceptors/                  # already present
│               ├── pipes/                         # already present
│               ├── tenant/                        # already present — extend with TenantContext for store-scope
│               ├── i18n/                          # already present — keep
│               └── ratelimit/                     [NEW]  # @nestjs/throttler config + named buckets
│
├── dashboard/
│   ├── middleware.ts                              # extend: auth + locale resolve
│   └── src/
│       ├── app/
│       │   └── [locale]/
│       │       ├── (auth)/                        [NEW]
│       │       │   ├── login/page.tsx
│       │       │   ├── unauthorized/page.tsx
│       │       │   └── suspended/page.tsx
│       │       └── (protected)/                   [NEW] route group with ProtectedLayout
│       │           ├── layout.tsx                 # auth-state hydration + role/permission gate
│       │           └── ...placeholders for sections
│       ├── components/
│       │   ├── auth/                              [NEW]  # LoginForm, UserMenu, RoleBadge, PermissionGate
│       │   └── layout/                            [NEW]  # Sidebar with permission-driven nav config
│       └── lib/
│           ├── auth/                              [NEW]  # supabase browser client, server session helpers
│           └── api/                               # uses packages/api-client
│
├── website/
│   ├── middleware.ts                              # extend: locale + optional-auth
│   └── src/
│       ├── app/
│       │   └── [locale]/
│       │       ├── (auth)/                        [NEW]
│       │       │   ├── login/page.tsx
│       │       │   ├── register/page.tsx
│       │       │   ├── reset-password/page.tsx
│       │       │   └── verify-email/page.tsx
│       │       └── account/                       [NEW]  # protected account layout
│       │           └── layout.tsx
│       ├── components/auth/                       [NEW]
│       └── lib/auth/                              [NEW]
│
└── mobile/                                        # Flutter — deferred
│
packages/
├── api-client/                                    # extend: typed clients for /auth, /users, /roles, /me, /audit-logs
├── i18n/
│   ├── en.json                                    # extend: auth screens copy
│   └── ar.json                                    # extend: auth screens copy
├── types/                                         # extend: AuthEnvelope, UserStatus, RoleDto, etc.
└── shared/                                        # any shared utility (e.g., permission-key parser)
```

**Structure Decision**: Web application (NestJS backend + two Next.js apps) inside an existing pnpm/turbo monorepo. No new top-level apps; we only extend `apps/backend`, `apps/dashboard`, `apps/website`, and the shared `packages/*`. New backend modules: `me/`, `webhooks/`, plus a `common/ratelimit/` shared piece. New frontend route groups: `(auth)` (public auth screens) and `(protected)` (auth-required). Flutter app is out of scope for Phase 2.

## Complexity Tracking

> Constitution Check passes — no violations to justify.

No entries.
