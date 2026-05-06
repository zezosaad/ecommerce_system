---

description: "Task list for feature 001-platform-bootstrap"
---

# Tasks: Platform Foundation Bootstrap

**Input**: Design documents from `specs/001-platform-bootstrap/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md
**Tests**: Included for the flows the constitution Testing Standards mandate (authentication, permissions, tenant isolation, audit, ledger discipline, idempotency). Other endpoints rely on contract tests against the OpenAPI files.
**Organization**: Tasks are grouped by user story so each can be implemented and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable — touches different files, no dependency on incomplete tasks.
- **[Story]**: User story tag — `US1`–`US5`, mapping to spec.md.
- Setup, Foundational, and Polish tasks have **no story tag**.
- Every task includes the exact file path it creates or modifies.

## Path Conventions

Repository root is `C:\Users\zezo\Desktop\work\ecommerce_system\`. Paths below are repo-relative. Apps live under `apps/`, shared code under `packages/`, infrastructure under `docker/` and `infra/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the empty monorepo and tooling so every subsequent task has a place to land.

- [X] T001 Initialize the monorepo at the repo root: create `package.json`, `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`, `turbo.json` with `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `test:a11y` pipelines, `.gitignore`, `.gitattributes`, and root `README.md`.
- [X] T002 [P] Create the shared TypeScript config package at `packages/config/tsconfig/` exporting `base.json`, `nextjs.json`, `nestjs.json` (all with `"strict": true`).
- [X] T003 [P] Create the shared ESLint config at `packages/config/eslint/` with TypeScript, Next.js, and NestJS presets, plus a custom rule that fails when a frontend file imports a non-`NEXT_PUBLIC_*` env var (per FR-CFG-005).
- [X] T004 [P] Create the shared Prettier config at `packages/config/prettier/index.cjs`.
- [X] T005 [P] Create the shared Tailwind preset at `packages/config/tailwind/preset.cjs` with RTL utilities and shadcn/ui defaults.
- [X] T006 [P] Configure Husky + lint-staged at `.husky/pre-commit` and root `.lintstagedrc` to run `pnpm lint` and `pnpm typecheck` on staged files.
- [X] T007 [P] Scaffold `packages/types/` (TS package exporting cross-app types: error codes mirror, envelope shapes, role and permission enums) with `package.json`, `tsconfig.json`, `src/index.ts`.
- [X] T008 [P] Scaffold `packages/shared/` (translatable resolver, formatters, constants) with `package.json`, `tsconfig.json`, `src/index.ts`.
- [X] T009 [P] Scaffold `packages/i18n/` with shared `en.json` and `ar.json` message catalogs and an `index.ts` exposing them.
- [X] T010 [P] Scaffold `packages/api-client/` (typed fetch wrapper that consumes the standard envelopes; will be used by both frontends) with `package.json`, `tsconfig.json`, `src/index.ts`, `src/client.ts`.
- [X] T011 Scaffold the NestJS backend at `apps/backend/`: `package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`, `src/health-check.ts`, an empty `prisma/` folder. Backend depends on `packages/types`, `packages/shared`, `packages/config/*`.
- [X] T012 [P] Scaffold the Next.js dashboard at `apps/dashboard/`: `package.json`, `tsconfig.json`, `next.config.mjs` (with the shared Tailwind preset wired through `tailwind.config.ts`), `src/app/layout.tsx`, `src/app/page.tsx`, `src/middleware.ts` (next-intl + auth), `postcss.config.cjs`. Depends on `packages/types`, `packages/shared`, `packages/api-client`, `packages/i18n`, `packages/config/*`.
- [X] T013 [P] Scaffold the Next.js customer website at `apps/website/` with the same structure as the dashboard but no role-gated route groups. Depends on the same shared packages.
- [X] T014 [P] Create the mobile placeholder at `apps/mobile/README.md` documenting the planned Flutter scaffold and API contract per FR-MOB-001 / FR-MOB-002.
- [X] T015 [P] Create `.env.example` files at `apps/backend/.env.example`, `apps/dashboard/.env.example`, `apps/website/.env.example` with every variable from FR-CFG-001..003 plus the `JWKS_TTL_SECONDS` and `JWKS_REFRESH_SECONDS` keys from research R6.
- [X] T016 [P] Create CI workflow `.github/workflows/ci.yml` running `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm --filter @vendorhub/dashboard test:a11y` and `pnpm --filter @vendorhub/website test:a11y`.

**Checkpoint**: monorepo is installable, `pnpm install` succeeds, `pnpm lint` and `pnpm typecheck` pass on empty apps.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting plumbing that every user story relies on. Nothing in Phases 3–7 can start until Phase 2 is green.

**⚠️ CRITICAL**: No user-story work begins before this phase completes.

### 2A — Backend Common module + env validation

- [X] T017 Add `apps/backend/src/modules/config/env.schema.ts` defining a zod schema for every env var listed in T015 + research R6/R7 defaults; on `app.module.ts` import register a `ConfigModule.forRoot({ validate })` that fails fast with a consolidated error list (FR-CFG-001, FR-BACK-012).
- [X] T018 Implement the standard envelopes and error-code enum at `apps/backend/src/modules/common/envelopes/` (`success.envelope.ts`, `list.envelope.ts`, `error.envelope.ts`) and `apps/backend/src/modules/common/errors/error-codes.ts` matching `contracts/error-codes.md` exactly. Re-export through `packages/types/src/envelopes.ts` so frontends share the type.
- [X] T019 [P] Implement `apps/backend/src/modules/common/filters/all-exceptions.filter.ts` translating every thrown exception into the error envelope; never leak stack traces or SQL fragments (FR-BACK-008, FR-BACK-010, FR-SEC-009).
- [X] T020 [P] Implement `apps/backend/src/modules/common/pipes/validation.pipe.ts` (class-validator + class-transformer) and register it globally in `app.module.ts` (FR-BACK-009, FR-API-003).
- [X] T021 [P] Implement `apps/backend/src/modules/common/interceptors/request-logging.interceptor.ts` using pino with redaction of Authorization, idempotency-key, and any header listed as sensitive (FR-BACK-011).
- [X] T022 [P] Implement `apps/backend/src/modules/common/interceptors/correlation-id.interceptor.ts` to read or generate `x-request-id`, attach it to the request, and set `meta.request_id` on responses (FR-OBS-006).
- [X] T023 [P] Implement `apps/backend/src/modules/common/observability/metrics.service.ts` (no-op `MetricsService`) and `apps/backend/src/modules/common/observability/tracing.service.ts` (no-op `TracingService`) per FR-OBS-002. Provide both via the Common module.
- [X] T024 [P] Implement `apps/backend/src/modules/common/dto/pagination.dto.ts`, `sort.dto.ts`, `filter.dto.ts` exposing the standard list-endpoint primitives (FR-API-004, FR-API-005).
- [X] T025 [P] Implement `apps/backend/src/modules/common/i18n/translatable.ts` validator + `resolveLocale(...)` helper per research R4 / FR-I18N-002. Mirror the resolver into `packages/shared/src/translatable.ts` for frontend reuse.

### 2B — Prisma + database

- [X] T026 Initialize Prisma at `apps/backend/prisma/schema.prisma` with the Postgres datasource bound to `DATABASE_URL` and `DIRECT_URL`.
- [X] T027 Author the foundation models in `apps/backend/prisma/schema.prisma` exactly per `data-model.md`: `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `AuditLog`, `Setting`, `Currency`, `ExchangeRate`, `TaxClass`, `CountryTaxRule`, `LedgerAccount`, `LedgerEntry`, `IdempotencyRecord`. Include every column, type, default, soft-delete, translatable JSONB, and relationship.
- [X] T028 Add the indexes from `data-model.md` (each `@@index` and `@@unique`) including the partial uniques (`users.email` WHERE `deletedAt IS NULL`, `currencies.is_default` WHERE true).
- [X] T029 Generate the initial migration with `pnpm --filter @vendorhub/backend prisma migrate dev --name 0001_foundation`.
- [X] T030 Create the seed script at `apps/backend/prisma/seed.ts` populating: 8 roles (FR-AUTH-003), the foundation permission catalog (data-model `permissions` seed list), `role_permissions` per data-model, 3 tax classes, 8 currencies (SAR default), country tax rules per launch market table, the platform-level ledger accounts, and the two starter settings (`platform.foundation.version`, `platform.cors.origins`).
- [X] T031 Wire the seed into `apps/backend/package.json` via the `prisma.seed` field and verify it runs idempotently (re-running does not duplicate rows).
- [X] T032 [P] Implement `apps/backend/src/modules/prisma/prisma.service.ts` with a `withTransaction(...)` helper (FR-PRIS-008) and a `softReads()` wrapper for soft-delete-aware queries (research R10).
- [X] T033 [P] Implement the database GRANT script `apps/backend/prisma/sql/audit-and-ledger-grants.sql` (applied as a migration) restricting the application DB user to `INSERT` only on `audit_logs` and `ledger_entries`. Document in the migration's README.

### 2C — Supabase + auth foundation

- [X] T034 Implement `apps/backend/src/modules/supabase/supabase.service.ts` exposing both the anon client and the service-role client, fed from env (FR-SUPA-004).
- [X] T035 Implement `apps/backend/src/modules/supabase/jwks-cache.service.ts` per research R6 (TTL 1h, 15min refresh, single out-of-schedule fetch with rate-limit guard, never clears cache on refresh failure).
- [X] T036 Implement `apps/backend/src/modules/auth/jwt.verifier.ts` validating `iss`, `aud` (against `JWT_AUDIENCE`), `exp`, and signature against the JWKS cache (FR-SUPA-002).
- [X] T037 Implement `apps/backend/src/modules/auth/jwt-auth.guard.ts` (global), `apps/backend/src/modules/auth/decorators/public.decorator.ts`, and register the guard globally in `app.module.ts` with `@Public()` opt-out (FR-AUTH-002, FR-SEC-002).
- [X] T038 Implement the auth context resolver at `apps/backend/src/modules/auth/auth-context.service.ts` that loads the application profile (auto-provisioning a Customer profile on first sight per FR-AUTH-006), the active role bindings, and the resolved permission set; guarded against race conditions via a transactional upsert.
- [X] T039 [P] Implement `apps/backend/src/modules/auth/decorators/current-user.decorator.ts` returning the typed user+roles+permissions value from the request (FR-AUTH-007).
- [X] T040 [P] Implement `apps/backend/src/modules/auth/decorators/roles.decorator.ts` and `apps/backend/src/modules/auth/decorators/permissions.decorator.ts` exposing `@Roles(...)` and `@Permissions(...)` metadata.
- [X] T041 [P] Implement `apps/backend/src/modules/auth/permissions.guard.ts` honoring `@Permissions(...)` plus wildcard match (`merchant.products.*`) per research R1 (FR-AUTH-005, FR-SEC-003).
- [X] T042 Implement `apps/backend/src/modules/auth/decorators/store-scope.decorator.ts` and the `TenantContext` type at `apps/backend/src/modules/common/tenant/tenant-context.ts` (FR-AUTH-008, FR-TEN-001..003). The decorator pulls `merchant_id`/`store_id` from path/header per documented rules and validates the user's grant.
- [X] T043 Implement `apps/backend/src/modules/common/tenant/tenant-aware.repository.ts` — a base class repository helper that refuses queries against tenant-scoped tables when `TenantContext` lacks the relevant scope and the actor is not Super Admin (FR-TEN-003). Compile-time types prevent calling read/write helpers without a context.

### 2D — Audit + ledger + idempotency services

- [X] T044 Implement `apps/backend/src/modules/audit/audit.service.ts` writing rows matching `data-model.md` `audit_logs`. Snapshot `actor_role_codes` from the resolved auth context. Support `before`/`after` diffs.
- [X] T045 Implement `apps/backend/src/modules/audit/decorators/audit.decorator.ts` and `apps/backend/src/modules/audit/audit.interceptor.ts` so endpoints declare audit-worthiness via `@Audit({ action, severity? })` (FR-SEC-004).
- [X] T046 Implement `apps/backend/src/modules/ledger/ledger.service.ts` exposing a `write({ transactionId, entries })` API that enforces the per-transaction debit==credit invariant per currency (data-model.md). Direct INSERTs on `ledger_entries` are forbidden by code review and the SQL grants from T033.
- [X] T047 Implement the canonicalized JSON body-hash helper at `apps/backend/src/modules/common/idempotency/canonicalize.ts` per research R7 (RFC 8785 / JCS).
- [X] T048 Implement `apps/backend/src/modules/common/idempotency/idempotency.interceptor.ts` and `apps/backend/src/modules/common/idempotency/decorators/idempotent.decorator.ts` storing/retrieving rows in `idempotency_records`; conflict returns `IDEMPOTENCY.CONFLICT` 409 (FR-API-006).
- [X] T049 [P] Implement the BullMQ queue factory shell at `apps/backend/src/modules/common/queues/queue.factory.ts` with no live queues registered. Used by later phases.

### 2E — Frontend foundations

- [X] T050 [P] Implement the dashboard's Supabase auth wrapper at `apps/dashboard/src/lib/auth.ts` and route middleware at `apps/dashboard/src/middleware.ts` (Supabase auth-helpers + next-intl locale detection per research R8).
- [X] T051 [P] Implement the website's Supabase auth wrapper at `apps/website/src/lib/auth.ts` and the corresponding middleware at `apps/website/src/middleware.ts`.
- [X] T052 [P] Implement the typed API client at `packages/api-client/src/client.ts` consuming `Authorization: Bearer <jwt>`, parsing the standard envelopes from `packages/types`, and surfacing `error.code`. On 401 it triggers a registered session-expired callback rather than throwing.
- [X] T053 [P] Implement state primitives at `apps/dashboard/src/components/states/Loading.tsx`, `Empty.tsx`, `Error.tsx`, `Forbidden.tsx` (FR-DASH-005). Mirror them at `apps/website/src/components/states/` with consistent props.
- [X] T054 [P] Implement i18n + RTL at `apps/dashboard/src/lib/i18n.ts` and `apps/website/src/lib/i18n.ts` using `next-intl` with sub-path locale routing (research R8). Tailwind RTL utilities applied via the shared preset.
- [X] T055 [P] Implement the permission visibility primitive at `apps/dashboard/src/lib/permissions.ts` exporting `usePermission(code)` hook + `<RequirePermission>` wrapper component (FR-DASH-008).

### 2F — Infra (configuration shells)

- [X] T056 [P] Create Dockerfiles `docker/backend.Dockerfile`, `docker/dashboard.Dockerfile`, `docker/website.Dockerfile`, all multi-stage, production-only deps in final stage, non-root user, with `HEALTHCHECK` directives (FR-DEP-001, FR-DEP-005).
- [X] T057 [P] Create `docker/docker-compose.yml` (production-shape: backend + dashboard + website + nginx; Meilisearch and Redis entries commented for later phases) and `docker/docker-compose.dev.yml` (developer overrides) per FR-DEP-001..002.
- [X] T058 [P] Create `docker/nginx/nginx.conf` and `docker/nginx/conf.d/default.conf` implementing the reverse proxy with HTTP→HTTPS redirect, the security headers from research R9, and per-path routing to backend/dashboard/website (FR-DEP-003).

**Checkpoint**: backend boots with green health check, Prisma migrations + seed succeed, Common module is fully wired, dashboard and website render in `en` and `ar` (RTL) at the placeholder layouts. From here, user story phases can run in parallel where dependencies allow.

---

## Phase 3: User Story 1 — New Engineer Onboards Locally (Priority: P1) 🎯 MVP

**Goal**: A new engineer clones the repo and reaches a green health check + both frontends rendering in `en` and `ar` (RTL) within a working session.

**Independent Test**: Per US1 acceptance scenarios — fresh clone → quickstart → 200 on health, Swagger reachable, dashboard and website both load, locale switch works on both.

- [X] T059 [US1] Implement `apps/backend/src/modules/health/health.module.ts`, `health.controller.ts`, `health.service.ts` returning the response shape from `contracts/health.openapi.yaml`. Per-dependency status: `db` (run `SELECT 1` via PrismaService), `auth` (probe JWKS cache freshness from T035), `storage` (`unknown` in Phase 0), `search`/`cache` (`unknown`). Status mapping per research R5 (`ok`/`degraded`/`unhealthy`).
- [X] T060 [US1] Wire Swagger at `apps/backend/src/main.ts` exposing `/api/docs` with the full DTO + auth requirement metadata (FR-BACK-006). Register the version string (`0.1.0+<git-sha>`) so the health endpoint and envelopes return it.
- [X] T061 [P] [US1] Implement the dashboard root page at `apps/dashboard/src/app/[locale]/page.tsx` with a locale switcher in the header that toggles `en`↔`ar`. The switcher updates the URL prefix (research R8) and persists the preference in a cookie.
- [X] T062 [P] [US1] Implement the website home placeholder at `apps/website/src/app/[locale]/page.tsx` with the same locale switcher.
- [X] T063 [P] [US1] Implement the website store page route shell at `apps/website/src/app/[locale]/stores/[storeSlug]/page.tsx` returning a placeholder "store not found yet" Empty state — proves URL routing works (FR-WEB-002).
- [X] T064 [US1] Author `docs/quickstart-local.md` covering the steps in `specs/001-platform-bootstrap/quickstart.md` §§ 1–7, plus troubleshooting from § Troubleshooting.
- [X] T065 [P] [US1] Author the root `README.md` linking to: the constitution, `docs/architecture-overview.md` (created in T087), `docs/quickstart-local.md`, `docs/quickstart-docker.md`, `docs/deployment-runbook.md`, `docs/folder-structure.md`, the API docs URL, and the bootstrap-and-build-sequencing + phased-delivery-plan docs.
- [X] T066 [US1] Add a Playwright smoke at `apps/dashboard/tests/e2e/locale-switch.spec.ts` and `apps/website/tests/e2e/locale-switch.spec.ts` asserting `dir="rtl"` after switching to Arabic and `dir="ltr"` for English on the home page.
- [X] T067 [US1] Add an integration test at `apps/backend/test/integration/health.spec.ts` asserting the health endpoint returns the documented envelope and per-dependency states.

**Checkpoint**: A new engineer following `docs/quickstart-local.md` reaches a green health check, Swagger UI, and both frontends in `en` and `ar` (RTL) within ≤ 90 minutes (SC-001).

---

## Phase 4: User Story 2 — Backend Engineer Adds a Future Module Safely (Priority: P1)

**Goal**: A backend engineer can add a new tenant-scoped CRUD module that automatically inherits auth, permissions, isolation, validation, error handling, pagination, idempotency-readiness, and Swagger — without writing any cross-cutting plumbing.

**Independent Test**: Per US2 — author a sample module, exercise the documented decorators, verify each acceptance scenario passes.

- [X] T068 [US2] Implement `apps/backend/src/modules/users/users.module.ts` + `users.controller.ts` exposing `GET /api/v1/me` per `contracts/me.openapi.yaml`. Returns the auth-context user (profile + roles + resolved permissions). Documents auto-provisioning (FR-AUTH-006) — including the audit log entry on first provisioning.
- [X] T069 [P] [US2] Implement `apps/backend/src/modules/roles/roles.controller.ts` exposing `GET /api/v1/roles` (paginated list of seeded roles, public to authenticated users). Demonstrates pagination DTO.
- [X] T070 [P] [US2] Implement `apps/backend/src/modules/roles/permissions.controller.ts` exposing `GET /api/v1/permissions` (paginated list of permission catalog).
- [X] T071 [US2] Implement `apps/backend/src/modules/settings/settings.module.ts` + `settings.controller.ts` exposing `GET /api/v1/settings` and `GET /api/v1/settings/:key` per `contracts/settings.openapi.yaml`. Gated by `@Permissions('platform.settings.read')`. Marked with `@Audit({ action: 'platform.settings.read', severity: 'info' })`. Demonstrates the permissions guard and audit interceptor end-to-end.
- [X] T072 [P] [US2] Implement `apps/backend/src/modules/currencies/currencies.controller.ts` exposing `GET /api/v1/currencies`.
- [X] T073 [P] [US2] Implement `apps/backend/src/modules/tax/tax.controller.ts` exposing `GET /api/v1/tax-classes` and `GET /api/v1/country-tax-rules` (both paginated).
- [X] T074 [US2] Author the canonical module template at `apps/backend/src/modules/_template/` (excluded from the app module via gitignore-style exclusion in `nest-cli.json`) demonstrating: controller with `@Permissions()` + `@Audit()`, service, DTOs (translatable + validation), repository extending the tenant-aware base, integration test, OpenAPI metadata.
- [X] T075 [US2] Author `docs/how-to-add-a-module.md` walking the engineer through copying `_template`, registering it in `app.module.ts`, adding a Prisma model, generating a migration, and adding tests. Reference exact file paths.
- [X] T076 [US2] Add an integration test at `apps/backend/test/integration/auth.spec.ts` covering all six auth edge cases from spec.md Edge Cases: missing/invalid/expired JWT (distinct error codes), Supabase user without profile (auto-provisions), user with no roles (`AUTHZ.NO_ROLES_ASSIGNED`), merchant user without store, staff user without permissions.
- [X] T077 [US2] Add an integration test at `apps/backend/test/integration/permissions.spec.ts` covering `@Permissions()` denial with `AUTHZ.PERMISSION_DENIED` and wildcard matches.
- [X] T078 [US2] Add an integration test at `apps/backend/test/integration/tenant-isolation.spec.ts` exercising the Settings endpoint with two merchants A and B; A cannot read B's per-merchant settings; Super Admin can with explicit cross-tenant override; the cross-tenant override emits an audit log row (FR-TEN-004 / SC-004).
- [X] T079 [US2] Add a unit test at `apps/backend/test/unit/tenant-aware.repository.spec.ts` asserting the repository helper refuses a tenant-scoped read with no `TenantContext` (FR-TEN-003).
- [X] T080 [US2] Add an integration test at `apps/backend/test/integration/audit.spec.ts` calling the Settings read endpoint and asserting an `audit_logs` row with the correct `action_code`, `actor_role_codes` snapshot, and `correlation_id`.
- [X] T081 [US2] Add an integration test at `apps/backend/test/integration/idempotency.spec.ts` posting twice with the same `Idempotency-Key` (returns same envelope) and once with the same key but a different body hash (returns `IDEMPOTENCY.CONFLICT` 409). Uses a temporary endpoint registered only for tests.
- [X] T082 [US2] Add a unit test at `apps/backend/test/unit/ledger.service.spec.ts` covering: balanced transaction succeeds; unbalanced rejected; mixed-currency rejected; direct insert path is unreachable from the public API.

**Checkpoint**: All edge cases from spec.md have automated coverage (SC-008). The sample module exercise from US2 acceptance scenarios passes verbatim.

---

## Phase 5: User Story 3 — Frontend Engineer Builds a Role-Gated Page (Priority: P1)

**Goal**: A frontend engineer can add a page that's gated to a specific role; wrong-role users see Forbidden, unauthenticated users are redirected to login, locale + RTL behave correctly, and the API client surfaces 401s into the shared session-expired flow.

**Independent Test**: Per US3 — add a Finance-Admin-only sample page; verify Customer is blocked, Finance Admin sees the page in `ar` with RTL, unauthenticated user is redirected, and any 401 from the API client triggers the session-expired flow.

- [X] T083 [P] [US3] Implement role-gated route groups in the dashboard at `apps/dashboard/src/app/[locale]/(admin)/`, `(merchant)/`, `(finance)/`, `(support)/`, plus `(auth)/login/page.tsx`. A page-level guard component reads the auth context (from a `<RequireRole>` wrapper) and short-circuits to the Forbidden state before any data fetch (FR-DASH-007).
- [X] T084 [P] [US3] Implement the dashboard shell at `apps/dashboard/src/components/shell/Shell.tsx` (sidebar + header + locale switcher + account menu) with role-aware navigation links derived from the user's resolved permissions (FR-DASH-004).
- [X] T085 [US3] Implement the session-expired flow: when `packages/api-client` reports a 401, the dashboard redirects to `/login?return=<original>` and the website displays a re-login modal (FR-DASH-006).
- [X] T086 [P] [US3] Add a sample Finance-Admin-only page at `apps/dashboard/src/app/[locale]/(finance)/sample/page.tsx` reading settings via the API client. Adopts Loading/Empty/Error/Forbidden states from T053. Use this page as the artifact for the US3 independent test.
- [X] T087 [US3] Add a Playwright e2e at `apps/dashboard/tests/e2e/role-gating.spec.ts` covering: customer hits Finance route → Forbidden state; unauthenticated hits → redirect to login preserving return URL; Finance Admin in `ar` locale → page renders RTL with correct content; API client receives 401 → session-expired flow.
- [X] T088 [P] [US3] Add an axe-core a11y test at `apps/dashboard/tests/a11y/foundation-pages.a11y.spec.ts` running against the home page, the login page, the Forbidden state, and the sample Finance page in both `en` and `ar` locales (FR-A11Y-003 / SC-013). Mirror at `apps/website/tests/a11y/foundation-pages.a11y.spec.ts` against home, store-slug placeholder, and account-menu states.

**Checkpoint**: All FR-DASH-* and FR-A11Y-* obligations are demonstrably met. SC-013 passes in CI.

---

## Phase 6: User Story 4 — Platform Operator Deploys to a VPS (Priority: P2)

**Goal**: An operator follows the deployment runbook and reaches a green health check at the production URL over HTTPS, with no secrets in any frontend bundle.

**Independent Test**: Per US4 — a second engineer who did not author the runbook deploys to a clean VPS and completes the smoke checks within one working day.

- [X] T089 [US4] Author `docs/deployment-runbook.md` covering: prerequisites (VPS specs, Docker, DNS, Supabase project), secrets injection (no baked-in values per FR-DEP-006), bring-up sequence (`docker compose up -d`), migration application (`prisma migrate deploy`), smoke tests (curl health, browser smoke), rollback (revert tag + roll back migration where compatible), and the manual failover procedure required by FR-DEP-009 (RTO ≤ 4h, RPO ≤ 24h).
- [X] T090 [US4] Author `docs/quickstart-docker.md` mirroring the local quickstart but for Docker Compose, including the production-shape compose flow.
- [X] T091 [US4] Add a CI job `.github/workflows/secrets-leak-check.yml` that scans the built dashboard and website artifacts for any non-`NEXT_PUBLIC_*` env reference (per FR-CFG-005 / SC-005) and fails the build if found. Use a simple grep + allowlist; document false-positive resolution.
- [X] T092 [P] [US4] Add a Nginx config check task `infra/nginx/test.sh` that runs `nginx -t` against `docker/nginx/nginx.conf` plus the conf.d files; wire into CI.
- [X] T093 [US4] Run a manual deployment rehearsal on a staging VPS, capture screenshots of the green production health check + Swagger + dashboard in `ar`, and attach them to the runbook as the "expected look" appendix.

**Checkpoint**: SC-006 passes — a second engineer can deploy in ≤ 1 working day.

---

## Phase 7: User Story 5 — Future Spec Author Has Clear Conventions (Priority: P3)

**Goal**: A future spec author (engineer or AI) can locate the foundation conventions (modules, decorators, services, file paths, migration policy) within 15 minutes.

**Independent Test**: Per US5 — open the architecture overview and within 15 minutes locate where to add a new module, the required decorators, DTO conventions, migration policy, translation policy, and how to register a new role/permission.

- [X] T094 [P] [US5] Author `docs/architecture-overview.md` describing the modular monolith layout, the foundation modules, the cross-cutting primitives (guards, decorators, interceptors, envelopes, ledger, audit, idempotency, observability no-ops), and the multi-tenancy enforcement model with a diagram.
- [X] T095 [P] [US5] Author `docs/folder-structure.md` matching the repo exactly. Include a verification script `scripts/verify-folder-structure.sh` that fails CI if the doc and the actual tree drift (FR-DOC-006).
- [X] T096 [P] [US5] Create `docs/privacy/pii-catalog.md` (header + table headers; rows added per-feature per FR-PRIV-003).
- [X] T097 [P] [US5] Create `docs/privacy/retention-policy.md` (template + guidance; rows added per-feature per FR-PRIV-004).
- [X] T098 [P] [US5] Author `docs/privacy/privacy-policy.md` v1 in English and Arabic per FR-PRIV-005, disclosing PII categories, lawful bases, cross-border transfer, retention, and contact.
- [X] T099 [P] [US5] Author `docs/privacy/data-subject-rights-procedure.md` documenting the internal export/erase process required by FR-PRIV-006 and SC-014. Include the rehearsal checklist.

**Checkpoint**: SC-014 (privacy readiness) and SC-010 (documentation accuracy) pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening before the foundation is declared shippable. These tasks touch multiple user stories and don't fit cleanly under any one.

- [X] T100 [P] Author the k6 load-test script at `apps/backend/test/load/baseline.js` per research R3 (50 RPS sustained × 10 min, 100 RPS peak × 1 min, 80/20 read/write mix targeting `/api/v1/health`, `/api/v1/me`, `/api/v1/settings/:key`, `/api/v1/currencies`).
- [X] T101 Add CI workflow `.github/workflows/load-test.yml` running the k6 baseline against staging on every release-candidate PR and nightly. Failures asserting p95 ≤ 200 ms (reads) / ≤ 500 ms (writes) block merge (SC-011).
- [X] T102 [P] Add the Swagger coverage check at `apps/backend/test/contract/swagger-coverage.spec.ts` asserting every registered route appears in the OpenAPI document with auth + permission metadata (SC-007).
- [X] T103 [P] Add a contract test at `apps/backend/test/contract/contracts-conformance.spec.ts` validating runtime responses from `/health`, `/me`, `/settings`, `/settings/:key` against `contracts/*.openapi.yaml` schemas using a Zod-based validator generated from the OpenAPI files.
- [X] T104 [P] Add an integration test at `apps/backend/test/integration/error-envelopes.spec.ts` covering every error code from `contracts/error-codes.md` (a synthetic endpoint per category).
- [X] T105 [P] Add an integration test at `apps/backend/test/integration/supabase-degradation.spec.ts` simulating DB unreachable (returns `SERVICE_UNAVAILABLE_DB`) and JWKS unreachable with cache exhausted (returns `SERVICE_UNAVAILABLE_AUTH`); per research R5.
- [X] T106 Implement the soft-delete query convention end-to-end: confirm every Prisma read in `apps/backend/src/modules/**` defaults to the `softReads()` helper from T032; add an ESLint rule at `packages/config/eslint/rules/no-bare-prisma-read.cjs` failing direct calls to the Prisma client outside the `softReads()` wrapper (research R10).
- [X] T107 [P] Add a unit test at `apps/backend/test/unit/translatable.spec.ts` covering: validates `{ar,en}` shape, rejects empty-empty, accepts at-least-one-non-empty, fallback resolver chain (research R4 / FR-I18N-002).
- [X] T108 [P] Add the verification script `scripts/verify-no-frontend-secrets.sh` (used by T091's CI job) plus a documentation block in `docs/architecture-overview.md` explaining how to run it locally.
- [X] T109 Manual screen-reader smoke test (FR-A11Y-004 / SC-013): execute the documented checklist on the dashboard and customer site in `en` and `ar` with one screen reader (NVDA on Windows or VoiceOver on macOS) and attach findings to `docs/qa/screen-reader-smoke-2026-05-06.md`.
- [X] T110 Run the privacy readiness rehearsal (SC-014): pick a test customer, perform the export-and-erase procedure documented in T099, log the result in `docs/qa/privacy-rehearsal-2026-05-06.md`. Confirm completion within 30 days simulated end-to-end.
- [X] T111 Final constitution-check pass: walk every Functional Requirement in `spec.md` and confirm a corresponding code or test artifact exists. File any gap as a follow-up issue. Document the result in `specs/001-platform-bootstrap/checklists/foundation-acceptance.md`.

**Checkpoint**: Every Success Criterion (SC-001 through SC-015) has a verifying artifact. The foundation is shippable.

---

## Dependencies

Phase ordering:

```
Phase 1 (Setup)
   │
   ▼
Phase 2 (Foundational) — BLOCKING
   │
   ├─────────────┬─────────────┬─────────────┐
   ▼             ▼             ▼             ▼
Phase 3 (US1)   Phase 4 (US2)  Phase 5 (US3)  Phase 6 (US4) ◄── benefits from US1+US2 done
   │
   ▼
Phase 7 (US5) ◄── lightweight, can parallel-start once Phases 3–4 begin
   │
   ▼
Phase 8 (Polish) ◄── after Phases 3–7
```

Within Phase 2:
- 2A (Common module) and 2C (Auth) are mostly independent; both depend on T017 (env validation).
- 2B (Prisma + DB) depends on T026; the seed (T030) depends on 2A's translatable validator (T025).
- 2D (Audit/Ledger/Idempotency) depends on 2A (envelopes, error codes) and 2B (`audit_logs`, `ledger_entries`, `idempotency_records` tables).
- 2E (Frontend foundations) is mostly independent of 2A–2D but consumes the shared types from T018.
- 2F (Infra) is independent and parallelizable with 2A–2E.

Within user-story phases:
- Phase 3 (US1) depends only on Phase 2 completion.
- Phase 4 (US2) depends on Phase 2; T076–T082 (the test tasks) depend on T068–T074 (the endpoints they exercise).
- Phase 5 (US3) depends on Phase 2 + T068 (`/me` for the auth context client side).
- Phase 6 (US4) depends on Phase 2 + Phase 1 Docker scaffolding (T056–T058).
- Phase 7 (US5) is mostly documentation; can run in parallel with 3–6.
- Phase 8 references endpoints, contracts, and behaviors from earlier phases — runs last.

---

## Parallel execution opportunities

Within Phase 1 (Setup), these can run in parallel after T001 lands:
**T002, T003, T004, T005, T006, T007, T008, T009, T010, T012, T013, T014, T015, T016**.

Within Phase 2A (Common module), these can run in parallel after T017 + T018:
**T019, T020, T021, T022, T023, T024, T025**.

Within Phase 2C (Auth), once T037 lands:
**T039, T040, T041** (different files, no dependency on each other).

Within Phase 2E (Frontend), once T018 + T053 land:
**T050, T051, T052, T054, T055**.

Within Phase 2F (Infra), all three of **T056, T057, T058** can run in parallel.

Within Phase 4 (US2), once T068 lands:
**T069, T070, T072, T073** can run in parallel; **T076, T077, T078, T079, T080, T081, T082** can be authored in parallel as the endpoints they exercise become ready.

Within Phase 5 (US3), once T083–T085 land:
**T086, T087, T088** can run in parallel.

Within Phase 7 (US5), all of **T094, T095, T096, T097, T098, T099** are documentation files — fully parallel.

Within Phase 8, **T100, T102, T103, T104, T105, T107, T108** can run in parallel.

---

## Implementation strategy

**MVP scope = Phase 1 + Phase 2 + Phase 3 (US1)**. Stop-and-demoable: containers up, health green, Swagger live, both frontends in `en`/`ar` with RTL, all foundation tables and seed in place, the cross-cutting primitives (guards, decorators, interceptors, envelopes, audit, ledger no-flow, idempotency-ready) wired but no business endpoints yet.

**Increment 1 (US1)**: ship MVP + the documentation it requires. Demo to the team.

**Increment 2 (US2)**: layer the proof-of-pattern endpoints (`/me`, `/settings`, `/roles`, `/permissions`, `/currencies`, `/tax-classes`, `/country-tax-rules`) and the test suite that proves the cross-cutting concerns work. This is the moment the team can confidently start feature 002+.

**Increment 3 (US3)**: complete the role-gated frontend story; dashboards become safely dividable per role.

**Increment 4 (US4)**: ship the deployment runbook + the secret-leak CI check + a rehearsed VPS deployment.

**Increment 5 (US5 + Polish)**: ship the architecture and how-to documentation, the privacy scaffolding, and the final cross-cutting tests (load, contracts, error envelopes, Supabase degradation, screen-reader smoke).

Each increment ends with a written retrospective at `docs/retros/foundation-increment-N.md` per the constitution's cross-phase tracks.
