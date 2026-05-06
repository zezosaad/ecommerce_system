# Feature Specification: Platform Foundation Bootstrap

**Feature Branch**: `001-platform-bootstrap`
**Created**: 2026-05-06
**Status**: Draft
**Constitution version**: 1.0.0
**Phase**: Phase 0 — Foundations (per `docs/phased-delivery-plan.md`)
**Companion docs**:
- `.specify/memory/constitution.md`
- `docs/bootstrap-and-build-sequencing.md`
- `docs/phased-delivery-plan.md`

**Input**: Phase 1: Project Foundation Specification — establish the technical
and architectural foundation of the multi-vendor e-commerce marketplace
platform. No business features are implemented in this phase. The phase
delivers the repository structure, backend skeleton, frontend skeletons,
configuration management, security/auth foundations, multi-tenancy
guardrails, deployment scaffolding, documentation, and the conventions every
future Spec-Kit feature will build on.

---

## Overview

This feature is the **bootstrap** of the platform. After this feature ships,
no end-user can buy or sell anything — but every later feature spec
(merchants, products, checkout, payments, etc.) can be implemented without
re-litigating any architectural decision. The deliverable is a working,
deployable, empty-of-business-logic system: containers come up, the backend
serves a health check and Swagger docs, the dashboards and customer site
render in Arabic and English with RTL, the database schema has only
foundation tables (audit logs, settings, currencies, tax classes, ledger
skeleton), and the documented conventions, guards, decorators, and
patterns are in place for every future module to reuse.

This phase is governed by the constitution v1.0.0. Every requirement below
is either a direct implication of a constitutional principle or an
operational rule that supports one. Where the constitution is binding, this
spec restates the obligation in concrete, testable form.

---

## Clarifications

### Session 2026-05-06

- Q: What p95 latency targets should the foundation commit to as the platform's baseline? → A: p95 ≤ 200 ms for read endpoints, p95 ≤ 500 ms for write endpoints, measured at the load balancer under documented baseline load.
- Q: What availability target and deployment topology should the foundation commit to for v1? → A: Single VPS, 99.5% uptime target, daily automated Supabase DB snapshots, weekly off-site backup, manual failover runbook.
- Q: What accessibility conformance level should the foundation primitives target? → A: WCAG 2.1 AA across dashboard and customer site; foundation primitives include keyboard-nav, focus-management, ARIA semantics, and contrast-checked components.
- Q: What privacy / data-residency posture should the foundation commit to for v1? → A: Acknowledge KSA PDPL and Egypt PDPL obligations; data MAY reside in any Supabase region in v1; PII catalog and retention policies defined per-feature when PII is collected; cross-border transfer disclosed in the privacy policy.
- Q: How much observability infrastructure should land in the foundation versus a later phase? → A: Structured logs + health endpoint, plus **no-op interfaces** for metrics and tracing (MetricsService, TracingService) wired through the Common module so a later observability feature can attach a backend without code surgery.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — New Engineer Onboards Locally (Priority: P1)

A newly hired backend or frontend engineer clones the repository, follows
the documented quickstart, and within one working session has the full
stack (backend, dashboard, customer website, database, search, cache,
reverse proxy) running on their laptop with Arabic and English views
visible.

**Why this priority**: Onboarding speed is a leading indicator of project
health. If a new engineer cannot get the system running on day one, every
subsequent feature spec is slower and more error-prone. This is the
single most important outcome of the foundation.

**Independent Test**: An engineer with no prior context follows
`docs/quickstart.md` from a clean machine. They can reach a green health
check, open Swagger UI, and load both frontends in `en` (LTR) and `ar`
(RTL) within one working session.

**Acceptance Scenarios**:

1. **Given** a fresh checkout of the repository on a developer machine
   with the prerequisites installed, **When** the engineer follows the
   local quickstart, **Then** the backend serves a 200 response from the
   health endpoint, Swagger UI is reachable, and both frontends render
   with the Arabic/English locale switcher functioning correctly.
2. **Given** the engineer changes the locale to Arabic, **When** they
   reload any page, **Then** the layout flips to RTL, all visible text
   is in Arabic where translations are seeded, and no layout regressions
   appear (no overflow, mirrored icons where appropriate).
3. **Given** an engineer adds a new minimal NestJS module by following
   the documented module template, **When** they restart the backend,
   **Then** the module is loaded, its routes appear in Swagger, the
   global validation pipe and exception filter apply automatically, and
   no boilerplate auth/audit/idempotency code had to be written.

---

### User Story 2 — Backend Engineer Adds a Future Module Safely (Priority: P1)

A backend engineer follows the conventions established by this phase to
implement any future business module (e.g., Merchants, Products,
Checkout). The conventions ensure their module is automatically:
authentication-aware, permission-aware, tenant-isolated, audit-logged,
input-validated, error-formatted, paginated, idempotent (where relevant),
and Swagger-documented — without the engineer needing to re-author any of
that scaffolding.

**Why this priority**: This is the multiplier. Every later feature relies
on the patterns frozen here. If the patterns are missing, weak, or
optional, isolation bugs and inconsistencies will accumulate across 30+
modules.

**Independent Test**: An engineer creates a sample tenant-scoped CRUD
module on a feature branch, applies the documented decorators
(`@Auth()`, `@Permissions()`, `@StoreScope()`), and the resulting
endpoints (a) reject unauthenticated requests with the standard error
envelope, (b) reject cross-tenant reads, (c) appear in Swagger with
properly typed request and response schemas, (d) emit audit log entries
when a sensitive flag is set, and (e) honor an `Idempotency-Key` header
when configured — all without the engineer writing any of those
behaviors by hand.

**Acceptance Scenarios**:

1. **Given** a sample module that uses `@CurrentUser()` and `@StoreScope()`,
   **When** a request arrives without a valid JWT, **Then** the global
   guard rejects it with the standard `401` error envelope.
2. **Given** the same module, **When** a merchant from store A requests
   a record belonging to store B, **Then** the request is rejected with
   the standard `403` error envelope and a tenant-isolation violation
   is logged.
3. **Given** a sample module marked with `@Audit()`, **When** a sensitive
   action runs, **Then** an entry is written to the `audit_logs` table
   capturing actor, action, target, and metadata.
4. **Given** a list endpoint using the standard pagination DTO, **When**
   it is called with `?page=2&pageSize=20`, **Then** the response uses
   the standard list envelope with `data`, `pagination`, and `meta`
   fields.

---

### User Story 3 — Frontend Engineer Builds a Role-Gated Page (Priority: P1)

A frontend engineer adds a new dashboard page that is visible only to a
specific role (e.g., Finance Admin). The page automatically inherits
authentication checks, role gating, layout chrome, the locale switcher,
RTL flipping, the loading/empty/error/forbidden states, and the API
client — without the engineer wiring those concerns by hand.

**Why this priority**: The dashboard hosts five logical experiences
(Platform Admin, Merchant, Merchant Staff, Finance Admin, Support Agent).
Without role-gating primitives in the foundation, those experiences will
leak into one another.

**Independent Test**: An engineer adds a sample page under a role-gated
route. A user with the wrong role who navigates to the URL is redirected
or sees the standard Forbidden state component; a user with the right
role sees the page rendered in their selected locale with correct RTL
behavior; an unauthenticated user is redirected to login.

**Acceptance Scenarios**:

1. **Given** a page declared as Finance-Admin-only, **When** a Customer
   user reaches its URL, **Then** they are blocked with the standard
   Forbidden state component.
2. **Given** the same page, **When** a Finance Admin user reaches it
   in Arabic locale, **Then** the page renders RTL with correct
   layout, navigation, and language strings.
3. **Given** the API client receives a 401 response on any page,
   **When** the response arrives, **Then** the client triggers the
   shared session-expired flow (redirect to login, preserve return
   URL) without per-page handling.

---

### User Story 4 — Platform Operator Deploys to a VPS (Priority: P2)

An operator follows the deployment runbook to bring up the system on a
production VPS behind Nginx with SSL. The runbook covers prerequisites,
secrets injection, container bring-up sequence, migration application,
smoke verification, and rollback.

**Why this priority**: A foundation that runs only on developer laptops
is not a foundation. Production-readiness is a constitutional
requirement (Principle VIII), and the runbook must exist before any
later phase can launch even a closed pilot.

**Independent Test**: A second engineer who did not author the runbook
follows it on a clean VPS and reaches a green health check at the
production URL with a valid SSL certificate, no secrets in any frontend
bundle, and an immutable audit-log entry for the deployment.

**Acceptance Scenarios**:

1. **Given** a fresh VPS that meets the documented prerequisites,
   **When** the operator follows the deployment runbook, **Then** the
   system is reachable at the production URL over HTTPS with a valid
   certificate, and HTTP requests redirect to HTTPS.
2. **Given** the deployed system, **When** the operator inspects the
   client-side bundle of either Next.js application, **Then** no
   service-role secrets, JWT secret, or other backend-only environment
   variables are present.

---

### User Story 5 — Future Spec Author Has Clear Conventions (Priority: P3)

An engineer (or AI assistant) authoring the next Spec-Kit feature
(`002-audit-logs-and-settings`, `005-auth-and-users`, etc.) finds in
this foundation a documented, navigable inventory of the conventions,
decorators, services, file paths, and module template they must use.
They do not invent parallel patterns.

**Why this priority**: This is what prevents drift over the project's
multi-month build. Less critical than P1/P2 because it does not block
day-one execution, but vital for sustained discipline.

**Independent Test**: A spec author opens `docs/architecture-overview.md`
(or equivalent) and within fifteen minutes can locate: (a) where to add
a new module, (b) which decorators their endpoints must use, (c) where
to put DTOs, (d) which migration policy to follow, (e) how to add
translations, (f) how to register a new role or permission.

---

### Edge Cases

The foundation MUST address each of the following edge cases. Each is
testable.

- **Missing JWT**: A request to a protected endpoint without an
  `Authorization` header receives a standard `401` error envelope; no
  stack traces or internal details leak.
- **Invalid JWT**: A request with a syntactically invalid or
  signature-mismatched token receives a standard `401` envelope.
- **Expired JWT**: A request with an expired token receives a standard
  `401` envelope distinguishable (in the `code` field) from "missing"
  and "invalid" so frontends can route to refresh vs login.
- **Audited Auth user with no application profile**: A user who exists
  in Supabase Auth but not yet in the application's `users` table is
  either auto-provisioned with the default Customer role or rejected
  with a clear error code — the foundation defines exactly which (see
  FR-AUTH-006). The flow MUST NOT fail with an unhandled 500.
- **User with no assigned role**: A user whose account exists but has
  no role record receives the same Forbidden envelope as a wrong-role
  user when accessing role-gated routes; an internal alert/audit-log
  entry MUST be created so the gap is visible to operators.
- **Merchant user without an active store**: A user with the Merchant
  role but no store assignment cannot access store-scoped endpoints;
  they are routed (in the dashboard) to the store-creation flow
  placeholder.
- **Staff user without permissions**: A Merchant Staff user with no
  permissions receives the Forbidden envelope on every staff-gated
  endpoint, with a clear error code that the dashboard can surface as
  "Ask your store owner to grant access."
- **Frontend reaches a protected route without auth**: The dashboard or
  customer site redirects to login, preserving the intended
  destination, without a flash of unauthenticated content (FOUC).
- **Backend cannot connect to the database at startup**: The backend
  fails fast with a clearly logged, non-secret-leaking error and a
  non-zero exit code; the health endpoint reports `unhealthy` if the
  process is kept up.
- **Missing required environment variable at startup**: The backend
  fails fast at boot with a single consolidated error listing every
  missing or invalid variable; it MUST NOT start with partial config.
- **CORS request from an unauthorized origin**: The request is rejected
  by the configured CORS policy; no body is returned beyond the
  framework default; the rejection is logged.
- **Idempotency-Key reuse with a different request body** (foundation
  contract; payments use it later): The endpoint returns a standard
  `409` envelope with a `code` indicating idempotency conflict.
- **Webhook signature missing or invalid** (foundation contract;
  providers integrate later): The endpoint returns `401`/`403` per
  policy and writes an audit-log entry with the raw payload preserved
  for forensics.
- **Service-role key accidentally referenced in a frontend file**: A
  static check (lint rule or build-time guard) MUST fail the build.
- **Soft-deleted record returned by accident**: Default repository
  reads MUST exclude soft-deleted rows; opting into them requires an
  explicit, audited query.

---

## Requirements *(mandatory)*

The requirements are grouped by foundation area for readability, but each
is a single testable obligation.

### Functional Requirements — Repository Structure

- **FR-REPO-001**: The repository MUST be a single monorepo containing
  the backend, the unified dashboard, the customer website, a placeholder
  folder for the future mobile app, shared packages, the specs folder,
  the docker folder, and the docs folder, organized as follows:

  ```
  apps/
    backend/         (NestJS modular monolith)
    dashboard/       (unified Next.js app for Platform Admin, Merchant,
                      Merchant Staff, Finance Admin, Support Agent —
                      role-gated)
    website/         (customer-facing Next.js marketplace)
    mobile/          (Flutter — placeholder only in this phase)
  packages/
    shared/          (shared utilities and helpers)
    types/           (cross-app TypeScript types, DTOs, enums)
    config/          (shared configuration helpers and zod schemas for env)
  specs/             (Spec-Kit feature specs)
  docker/            (Dockerfiles, compose files, Nginx config)
  docs/              (architecture, runbooks, quickstarts, this spec)
  ```

- **FR-REPO-002**: The repository MUST use a workspace tool that allows
  the backend and frontends to share types from `packages/types/` without
  duplication or publishing to a registry.
- **FR-REPO-003**: The repository MUST enforce a single TypeScript strict
  configuration baseline shared across all TypeScript apps via
  `packages/config/`.
- **FR-REPO-004**: The repository MUST include a single root-level
  README that links to the quickstart, architecture overview,
  deployment runbook, and the constitution.

### Functional Requirements — Backend Foundation

- **FR-BACK-001**: The backend MUST be a NestJS modular monolith.
- **FR-BACK-002**: The backend MUST register the following foundation
  modules at startup, each isolated under `src/modules/<module>/`:
  Configuration, Prisma, Supabase, Auth (foundation only), Users
  (foundation only), Roles & Permissions (foundation only), Health
  Check, Settings (foundation only), Audit Logs (foundation only).
- **FR-BACK-003**: The backend MUST expose a `Common` module providing:
  global exception filter, global validation pipe, request-logging
  interceptor, audit interceptor, idempotency interceptor (registered
  but no-op for endpoints that do not opt in), pagination/sort/filter
  DTOs, the standard success/error envelope shapes, the
  `@CurrentUser`, `@Public`, `@Roles`, `@Permissions`, `@StoreScope`,
  and `@Audit` decorators, and the `JwtAuthGuard` and
  `PermissionsGuard`.
- **FR-BACK-004**: All API routes MUST be served under `/api/v1`.
  Adding a future v2 MUST be possible without breaking v1 consumers.
- **FR-BACK-005**: A health endpoint at `GET /api/v1/health` MUST
  return overall status plus the status of each downstream
  dependency (database, search, cache, when those are integrated in
  later phases).
- **FR-BACK-006**: Swagger UI MUST be served at `GET /api/docs` and
  reflect every registered route with its DTOs, response schemas,
  required permissions, and authentication requirement.
- **FR-BACK-007**: The standard success response envelope MUST be
  consistent across all endpoints and identifiable by frontends; it
  MUST contain at least `data`, `meta`, and (for list endpoints) a
  `pagination` block with `page`, `pageSize`, `total`, `totalPages`.
- **FR-BACK-008**: The standard error response envelope MUST contain
  at least `error.code` (stable, machine-readable), `error.message`
  (human-readable, localizable), and an optional `error.details`
  block. Internal stack traces, SQL fragments, secret values, and
  framework internals MUST NOT appear in the envelope.
- **FR-BACK-009**: The global validation pipe MUST be enabled for
  every endpoint by default; bypassing requires an explicit
  decorator.
- **FR-BACK-010**: The global exception filter MUST translate every
  thrown exception into the standard error envelope.
- **FR-BACK-011**: Request logging MUST capture method, path, status,
  duration, and a request-correlation ID. Sensitive headers and
  bodies (Authorization, payment data) MUST be redacted.
- **FR-BACK-012**: The backend MUST validate every required
  environment variable at boot using a typed schema; missing or
  malformed variables MUST cause a fail-fast startup with a
  consolidated error listing every offender.

### Functional Requirements — Supabase Foundation

- **FR-SUPA-001**: Supabase MUST be used for PostgreSQL, Auth, and
  Storage.
- **FR-SUPA-002**: The backend MUST validate Supabase JWTs against
  the configured JWT secret/JWKS; the validation MUST honor `iss`,
  `aud` (against `JWT_AUDIENCE`), `exp`, and signature.
- **FR-SUPA-003**: The application MUST maintain a clear separation
  between the Supabase Auth user and the application profile in the
  `users` table; the Supabase user ID MUST be stored on the
  application profile as the immutable foreign key.
- **FR-SUPA-004**: The Supabase service role key MUST be available
  to the backend only and MUST never be referenced from any
  frontend codepath. A static check MUST enforce this.
- **FR-SUPA-005**: Supabase Storage usage MUST be configured (bucket
  conventions, signed-URL strategy) but no buckets are created in
  this phase beyond an `avatars` bucket placeholder.
- **FR-SUPA-006**: Frontends MAY use the Supabase JS client only for
  authentication flows (sign-in, sign-up, OAuth redirect, session
  refresh). All business operations MUST go through the NestJS API.

### Functional Requirements — Prisma Foundation

- **FR-PRIS-001**: Prisma MUST be the sole ORM connecting the backend
  to Supabase PostgreSQL.
- **FR-PRIS-002**: All schema changes MUST flow through Prisma
  Migrate; ad-hoc SQL changes against a deployed environment are
  forbidden.
- **FR-PRIS-003**: The backend MUST expose a single, injectable
  `PrismaService` that all repositories and services consume; no
  module may instantiate its own Prisma client.
- **FR-PRIS-004**: The schema MUST use English names for all tables,
  columns, enums, indexes, and constraints. User-facing translatable
  fields use a JSONB column with `{ ar, en }` per the constitution.
- **FR-PRIS-005**: Every tenant-scoped table MUST include
  `merchant_id` (required) and, where applicable, `store_id`. A
  documented checklist MUST exist for "is this table tenant-scoped?"
- **FR-PRIS-006**: Every business entity MUST include `created_at`,
  `updated_at`, and `deleted_at` (nullable, soft-delete) where
  business or compliance history must be preserved.
- **FR-PRIS-007**: Indexes MUST be added on columns used in
  high-volume filters, sorts, and joins. The convention for naming
  indexes MUST be documented.
- **FR-PRIS-008**: The PrismaService MUST expose a transaction
  helper that future critical flows (payments, orders, inventory,
  ledger) will use.
- **FR-PRIS-009**: This phase MUST create only the foundation
  tables: `users`, `roles`, `permissions`, `role_permissions`,
  `user_roles`, `audit_logs`, `settings`, `currencies`,
  `exchange_rates`, `tax_classes`, `country_tax_rules`,
  `ledger_accounts`, `ledger_entries`. All tables are empty after
  migrations except for seed data (e.g., the eight roles).

### Functional Requirements — Authentication Foundation

- **FR-AUTH-001**: Supabase Auth MUST be the identity provider for
  all human users (customers, merchants, staff, admins).
- **FR-AUTH-002**: NestJS MUST validate every incoming JWT through a
  global `JwtAuthGuard`; routes opt out via the `@Public()`
  decorator only.
- **FR-AUTH-003**: The eight roles MUST be seeded at migration time
  with stable identifiers: Super Admin, Platform Admin, Merchant
  Owner, Merchant Staff, Customer, Support Agent, Finance Admin,
  Shipping Agent. Role labels MUST be translatable.
- **FR-AUTH-004**: The RBAC foundation MUST support fine-grained
  permissions attached to roles (e.g.,
  `merchant.products.create`). Permission strings MUST follow a
  documented namespace convention.
- **FR-AUTH-005**: The `@Permissions(...)` decorator and
  `PermissionsGuard` MUST be implemented and demonstrated on at
  least one foundation endpoint (e.g., a settings endpoint).
- **FR-AUTH-006**: When a JWT belongs to a Supabase user without a
  matching application profile, the foundation MUST auto-provision
  a profile with the default Customer role and write an audit-log
  entry. Auto-provisioning MUST be idempotent and race-safe.
- **FR-AUTH-007**: The `@CurrentUser()` decorator MUST resolve to a
  fully-typed value combining the Supabase user, the application
  profile, the active roles, and the resolved permissions.
- **FR-AUTH-008**: The `@StoreScope()` decorator MUST extract a
  `storeId` from the request (path or header per documented rules),
  validate that the current user is allowed to act inside that
  store, and attach a typed scope value to the request that
  repositories use.
- **FR-AUTH-009**: This phase implements the foundations only. Full
  sign-in, sign-up, password reset, OAuth, and session refresh
  flows are delivered by feature `005-auth-and-users`.

### Functional Requirements — Multi-Tenancy Foundation

- **FR-TEN-001**: Tenant isolation MUST be enforced server-side.
  Frontend filtering does not constitute isolation.
- **FR-TEN-002**: A documented tenant-context object (built from
  the JWT, profile, and `@StoreScope`) MUST be threaded into every
  repository call against a tenant-scoped table.
- **FR-TEN-003**: Repository helpers MUST refuse to issue queries
  against a tenant-scoped table without a tenant-context value.
  This refusal MUST be enforced in code (compile-time types where
  possible, runtime guards otherwise), not by convention.
- **FR-TEN-004**: Super Admin MAY pass an explicit
  "cross-tenant" override flag that bypasses isolation; using the
  override MUST emit an audit-log entry.
- **FR-TEN-005**: Platform Admin access MUST be limited to
  platform-level data; access to a specific merchant's data
  requires either Super Admin or an explicit support-impersonation
  flow (designed in a later phase, not implemented here).
- **FR-TEN-006**: Customer access MUST be limited to records the
  customer owns, joined through their user ID.
- **FR-TEN-007**: A documented test pattern MUST exist for
  tenant-isolation tests, and at least one example test MUST cover
  the Settings module to demonstrate the pattern.

### Functional Requirements — Dashboard Foundation

- **FR-DASH-001**: The dashboard MUST be a single Next.js
  application with role-gated route groups for Platform Admin,
  Merchant Owner, Merchant Staff, Finance Admin, and Support Agent.
- **FR-DASH-002**: The dashboard MUST authenticate users via
  Supabase Auth and obtain a JWT used for all backend calls; the
  JWT MUST be transmitted via the standard `Authorization: Bearer`
  header.
- **FR-DASH-003**: The dashboard MUST support Arabic and English
  with full RTL flipping; locale switching MUST be persistent
  (cookie or user preference).
- **FR-DASH-004**: The dashboard MUST provide shared layout
  components: shell with role-aware navigation, header with
  locale and account menu, and section-aware breadcrumbs.
- **FR-DASH-005**: The dashboard MUST provide reusable Loading,
  Empty, Error, and Forbidden state components and document their
  usage; pages MUST adopt them rather than inventing their own.
- **FR-DASH-006**: The dashboard MUST provide a typed API client
  that consumes the backend's standard response envelope, surfaces
  the error `code`, and triggers the shared session-expired flow
  on `401`.
- **FR-DASH-007**: A page-level guard MUST enforce role gating
  before any data fetch; a wrong-role user MUST see the Forbidden
  state without a flash of authorized content.
- **FR-DASH-008**: Permission-based UI visibility MUST be a
  primitive (helper hook or wrapper component) so feature pages
  can conditionally render actions without reimplementing the
  check.

### Functional Requirements — Customer Website Foundation

- **FR-WEB-001**: The customer website MUST be a single Next.js
  application supporting Arabic, English, and full RTL.
- **FR-WEB-002**: The website MUST expose route shells for: home
  marketplace listing, product detail, store page (path pattern
  `/stores/:storeSlug`), search, account, cart, and checkout. In
  this phase the routes return placeholder content but the URL
  contracts MUST be stable.
- **FR-WEB-003**: The website MUST be SEO-ready: server-rendered,
  per-locale metadata (title, description, hreflang), canonical
  URL handling, robots and sitemap placeholders, structured-data
  scaffolding for products and stores.
- **FR-WEB-004**: The website MUST share the typed API client and
  the standard error/loading/empty/forbidden state primitives
  with the dashboard via a shared package.
- **FR-WEB-005**: The website MUST support an authenticated layout
  (logged-in customer header, account menu) without yet
  implementing the customer-side flows beyond authentication.
- **FR-WEB-006**: A cart-ready architecture (state container or
  context, persistence strategy, shape) MUST be in place so the
  Phase-3 cart feature can plug in without rewriting page
  layouts.

### Functional Requirements — Mobile App Foundation

- **FR-MOB-001**: The `apps/mobile/` folder MUST exist with a
  README documenting the planned Flutter scaffold, the API base
  URL contract, the auth flow contract, and the Arabic/English
  + RTL requirement.
- **FR-MOB-002**: No Flutter code beyond the README is delivered
  in this phase. The folder is scaffolded so later features can
  drop into a known location.

### Functional Requirements — Configuration Management

- **FR-CFG-001**: The backend MUST require the following
  environment variables, each validated at startup: `DATABASE_URL`,
  `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
  `JWT_AUDIENCE`, `APP_ENV`, `APP_PORT`, `API_PREFIX`,
  `CORS_ORIGINS`.
- **FR-CFG-002**: The dashboard MUST require: `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No
  other secrets MUST be embedded at build time.
- **FR-CFG-003**: The website MUST require the same three public
  variables as the dashboard.
- **FR-CFG-004**: A single canonical `.env.example` MUST exist per
  app, documenting every variable with a non-sensitive example
  value and a one-line description.
- **FR-CFG-005**: A static check MUST flag any reference to a
  non-`NEXT_PUBLIC_*` variable from a frontend client-side
  codepath.
- **FR-CFG-006**: Per-environment configuration MUST be supported
  (development, staging, production) without code changes — only
  via environment variables.

### Functional Requirements — API Standards

- **FR-API-001**: All public APIs MUST be REST under `/api/v1`.
- **FR-API-002**: All endpoints MUST be documented in Swagger/OpenAPI
  with DTOs, response shapes, error codes, and required
  authentication / permissions.
- **FR-API-003**: All input MUST be validated by class-validator
  DTOs; untyped or `any` payloads are forbidden.
- **FR-API-004**: All list endpoints MUST follow the standard
  pagination shape and accept `page` and `pageSize` query
  parameters with documented defaults and limits.
- **FR-API-005**: A standard filtering and sorting query convention
  MUST be defined and documented; example: `?sort=-created_at` and
  `?filter[status]=active`.
- **FR-API-006**: An idempotency strategy MUST be defined: the
  `Idempotency-Key` header on opt-in endpoints; the
  `IdempotencyInterceptor` records the first response keyed by
  `(actor, route, key, body-hash)` and returns the same response
  for replays. Conflicts (same key, different body) return a
  documented `409` error code.
- **FR-API-007**: A webhook validation strategy MUST be defined:
  every webhook handler runs the provider-specific signature
  verification before any business logic; the raw payload is
  persisted (for replay/forensics) before the response.
- **FR-API-008**: A canonical error-code registry MUST exist; new
  modules add codes by registering them, not by inventing strings
  inline.

### Functional Requirements — Security Foundation

- **FR-SEC-001**: No secret value (service role key, JWT secret,
  payment provider keys) MAY appear in any frontend bundle,
  source map, public asset, or environment variable that lacks a
  `NEXT_PUBLIC_` prefix.
- **FR-SEC-002**: Every protected route MUST use `JwtAuthGuard`
  (applied globally with `@Public()` opt-out).
- **FR-SEC-003**: Every sensitive route MUST additionally use
  `PermissionsGuard` with one or more permission strings.
- **FR-SEC-004**: Every sensitive action MUST be audit-logged via
  the `@Audit()` decorator; the foundation provides the storage,
  the convention, and at least one demonstrating endpoint.
- **FR-SEC-005**: A rate-limiting strategy MUST be configured
  (per-IP and per-user) for authentication endpoints,
  payment-related endpoints (forward-looking), and webhook
  endpoints.
- **FR-SEC-006**: The CORS policy MUST honor the configured
  `CORS_ORIGINS` allowlist; unknown origins are rejected by the
  framework.
- **FR-SEC-007**: A secure file-upload strategy (signed URLs to
  Supabase Storage, allowed MIME types, max sizes, virus-scan
  hook) MUST be documented; no upload endpoints are implemented
  in this phase beyond the convention.
- **FR-SEC-008**: Soft-delete MUST be the default for entities
  whose business or compliance history must be preserved; the
  default repository read path MUST exclude soft-deleted rows.
- **FR-SEC-009**: API errors MUST NOT leak SQL fragments, stack
  traces, secret values, or other internals. The standard error
  envelope is the only response shape.

### Functional Requirements — Privacy & Data Residency Foundation

- **FR-PRIV-001**: The platform's privacy posture MUST formally
  acknowledge the **Saudi Arabia Personal Data Protection Law
  (PDPL)** and the **Egypt Personal Data Protection Law
  (Law 151/2020)** as applicable obligations from v1, given the
  multi-region launch target. Other MENA jurisdictions (UAE,
  Bahrain, Kuwait, Qatar, Oman) are added to the applicable-law
  list when launching there.
- **FR-PRIV-002**: For v1, PII data MAY reside in any Supabase
  region of the platform's choosing. Strict in-country residency
  is **not** required by v1; the choice is revisited if any
  customer or merchant agreement, regulator request, or material
  change in law mandates it.
- **FR-PRIV-003**: Every Spec-Kit feature that introduces a new
  PII field MUST extend a single canonical **PII catalog** in
  `docs/privacy/pii-catalog.md` (created in this phase, empty
  beyond a header in v1) listing for each field: entity, field
  name, lawful basis, retention period, data-subject rights
  applicable, and whether export/erasure are programmatic or
  manual today.
- **FR-PRIV-004**: A retention policy template MUST exist in
  `docs/privacy/retention-policy.md` and be filled in per-feature
  as the feature ships. Audit logs, ledger entries, and
  compliance-relevant records are explicitly retained per
  applicable law (no auto-purge in v1).
- **FR-PRIV-005**: A v1 **privacy policy** document
  (`docs/privacy/privacy-policy.md`, English + Arabic) MUST
  disclose: the categories of PII collected, lawful bases,
  cross-border transfer (Supabase regions used), retention,
  and data-subject contact. The policy is published before any
  public traffic touches the system.
- **FR-PRIV-006**: Data-subject rights (access, correction,
  erasure, portability) MUST be **operationally** supported in
  v1 even if the customer-facing self-service flows are
  deferred: an internal admin process (run by Support Agent or
  Platform Admin under audit) MUST be able to export and erase
  a customer's PII on request within statutory timeframes. The
  data model from this phase forward MUST not block this —
  every PII-bearing entity MUST be reachable from a user ID
  through a documented join path.

### Functional Requirements — Internationalization Foundation

- **FR-I18N-001**: The platform MUST support Arabic and English as
  first-class locales across the dashboard, the customer website,
  and (later) the mobile app.
- **FR-I18N-002**: Translatable database fields MUST use JSONB
  with the shape `{ "ar": string, "en": string }`. A typed helper
  MUST exist in the backend Common module to validate and
  serialize these fields.
- **FR-I18N-003**: API responses for entities with translatable
  fields MUST return the JSONB shape; the frontend chooses the
  active locale at render time.
- **FR-I18N-004**: Frontends MUST persist the user's locale
  selection and apply RTL flipping, mirrored icons where
  appropriate, and locale-aware number/date formatting.
- **FR-I18N-005**: Backend error messages MUST be returned via
  the stable `error.code`; localized human-readable strings are
  produced by the frontend from a shared message catalog. (This
  prevents the backend from owning translations of UI copy.)
- **FR-I18N-006**: Currency and tax/VAT scaffolding MUST exist
  in the database (per FR-PRIS-009) so later phases can attach
  per-country rules without a schema rewrite.

### Functional Requirements — Accessibility Foundation

- **FR-A11Y-001**: The dashboard and the customer website MUST
  conform to **WCAG 2.1 Level AA** across every screen and
  primitive shipped in this phase, in both Arabic (RTL) and
  English (LTR).
- **FR-A11Y-002**: Foundation UI primitives — including the
  layout shell, navigation, forms, dialogs, tables, and the
  Loading/Empty/Error/Forbidden state components from
  FR-DASH-005 — MUST ship with: full keyboard navigation,
  visible and consistent focus indicators, ARIA roles and
  labels where the underlying HTML semantics are not
  sufficient, and color-contrast ratios meeting the AA
  threshold (4.5:1 for normal text, 3:1 for large text and
  non-text UI components).
- **FR-A11Y-003**: An automated accessibility check (e.g., axe
  or equivalent) MUST run in CI against the dashboard and
  customer-website storybook/sample pages; new violations
  block PR merge.
- **FR-A11Y-004**: A manual screen-reader smoke test (one
  modern screen reader on Windows or macOS) MUST be documented
  as part of the foundation QA checklist and re-run before
  every milestone exit. Findings are filed against the spec
  that owns the violating screen.

### Functional Requirements — Docker & Deployment Foundation

- **FR-DEP-001**: Docker Compose configurations MUST exist for
  development and production, bringing up the backend, the
  dashboard, the website, Nginx, and supporting services
  (search engine and cache placeholders may be added in their
  respective phases — at minimum the compose graph supports
  adding them without restructuring).
- **FR-DEP-002**: Supabase MUST be treated as an external
  managed service; no PostgreSQL container is run in production
  compose. A local-development PostgreSQL container is allowed
  if developers prefer not to use a Supabase dev project.
- **FR-DEP-003**: Nginx MUST be configured as a reverse proxy in
  front of all HTTP services with HTTP→HTTPS redirect and SSL
  via the documented certificate strategy.
- **FR-DEP-004**: Each service MUST expose a Docker `HEALTHCHECK`
  hitting its health endpoint.
- **FR-DEP-005**: Production images MUST NOT contain dev
  dependencies; the build is multi-stage.
- **FR-DEP-006**: Production secrets MUST be injected via
  environment variables or a secrets manager; they MUST NOT be
  baked into images.
- **FR-DEP-007**: A logs strategy MUST be documented: structured
  JSON logs to stdout, captured by the host log driver,
  forwarded to the eventual aggregator (introduced in a later
  phase but planned here).
- **FR-DEP-008**: A deployment runbook MUST exist in `docs/`
  covering: prerequisites, secrets, bring-up sequence, migration
  application, smoke tests, and rollback.
- **FR-DEP-009**: The v1 production topology MUST be a **single
  VPS** running the Docker Compose stack behind Nginx with SSL.
  The runbook MUST document: daily automated Supabase database
  snapshots, weekly off-site backup of the snapshot artifacts to
  a documented secondary location, and a **manual failover
  procedure** (rebuild on a fresh VPS from the latest snapshot
  with documented RTO of ≤ 4 hours, RPO ≤ 24 hours). HA / hot-
  standby topologies are out of scope for v1 and revisited at
  the Public GA milestone.

### Functional Requirements — Observability Foundation

- **FR-OBS-001**: The backend MUST emit structured JSON logs to
  stdout for every request (per FR-BACK-011) and for every
  domain event the audit and ledger services record. Sensitive
  fields are redacted per FR-BACK-011.
- **FR-OBS-002**: The backend's Common module MUST expose two
  injectable interfaces — `MetricsService` and `TracingService`
  — with **no-op implementations** registered by default. The
  shape of each MUST be documented:
  - `MetricsService`: `increment(name, labels?)`,
    `gauge(name, value, labels?)`, `histogram(name, value, labels?)`,
    `timing(name, durationMs, labels?)`.
  - `TracingService`: `startSpan(name, attributes?)` returning a
    span handle with `setAttribute`, `recordException`, `end`.
- **FR-OBS-003**: Foundation interceptors and the ledger/audit
  services MUST call into `MetricsService` and `TracingService`
  at well-known points (request start/end, audit-write,
  ledger-write, idempotency hit/miss, webhook signature
  verify). With the default no-op providers these calls are
  free; replacing the providers later lights up data across
  every module without changes to calling code.
- **FR-OBS-004**: A documented contract MUST describe how a
  later observability feature replaces the no-op providers
  (e.g., binding `MetricsService` to a Prometheus or OTel-based
  implementation) and how to add new metric/trace points
  without breaking the foundation contract.
- **FR-OBS-005**: The `/api/v1/health` endpoint (FR-BACK-005)
  MUST return both an overall status and per-dependency status
  (database, search, cache — `unknown` for dependencies not yet
  wired). Health responses MUST include a service version
  identifier (build SHA or semver) for incident triage.
- **FR-OBS-006**: A correlation-ID convention MUST be defined:
  every inbound HTTP request gets an `x-request-id` (created if
  absent), it is propagated to logs, audit entries, ledger
  entries (via metadata), and outbound calls (when integrations
  arrive in later phases).

### Functional Requirements — Documentation

- **FR-DOC-001**: The root `README.md` MUST link to all of:
  the constitution, the architecture overview, the local
  quickstart, the docker quickstart, the deployment runbook,
  the API docs URL, and the folder-structure explanation.
- **FR-DOC-002**: An architecture overview document MUST describe
  the modular monolith layout, the foundation modules, the
  cross-cutting primitives (guards, decorators, interceptors,
  envelopes, ledger service), and the multi-tenancy enforcement
  model.
- **FR-DOC-003**: A local quickstart MUST take a new engineer
  from clone to running stack in a single document, including
  how to seed the database with foundation data.
- **FR-DOC-004**: A docker quickstart MUST cover the equivalent
  flow via Docker Compose.
- **FR-DOC-005**: A "how to add a new module" guide MUST exist,
  showing the canonical module template, decorator usage, DTO
  conventions, migration policy, translation policy, and audit
  policy.
- **FR-DOC-006**: A folder-structure explanation MUST exist and
  match the repo exactly; drift between docs and code is a
  defect.

### Key Entities

The foundation creates persistence-only scaffolding for the entities
below. No business behavior is implemented around them in this phase
beyond the constraints described.

- **User Profile**: Mirrors a Supabase Auth user inside the
  application database. Holds the immutable Supabase user ID, a
  display name, an email, an avatar URL, the active locale, and
  soft-delete metadata. Owns role assignments through the
  `user_roles` join.
- **Role**: One of the eight seeded roles. Translatable label,
  stable code, optional description.
- **Permission**: A namespaced action string (e.g.,
  `merchant.products.create`). Belongs to many roles.
- **Role-Permission**: Join entity attaching permissions to roles.
  Editable by Super Admin.
- **User-Role**: Join entity attaching roles to user profiles.
  Optional `merchant_id` / `store_id` scope columns enable
  per-store role assignments (used heavily by Merchant Staff).
- **Audit Log**: Immutable record of a sensitive action. Captures
  actor, action code, target entity reference, before/after
  payload (where applicable), correlation ID, and timestamp.
- **Setting**: Key/value record scoped either globally
  (platform-wide) or per merchant. Translatable values where
  applicable.
- **Currency**: Stable currency code (ISO 4217), translatable
  display name, decimal precision, default flag.
- **Exchange Rate**: Pair of currencies with a rate and effective
  date. Source attribution.
- **Tax Class**: Logical grouping (e.g., "standard goods",
  "digital services", "exempt") with translatable labels.
- **Country Tax Rule**: Country code + tax class → rate +
  inclusive/exclusive policy + effective date.
- **Ledger Account**: Skeleton of the financial ledger; account
  type (asset, liability, revenue, expense, equity), owner
  (platform-wide or per merchant), currency.
- **Ledger Entry**: Skeleton of a double-entry ledger row;
  reference to a transaction grouping, debit/credit account,
  amount, currency, and immutable timestamp. The foundation
  defines the schema and the `LedgerService` contract; no real
  flows are wired into it until Phase 4.

---

## Success Criteria *(mandatory)*

All metrics below are measurable and technology-agnostic. They
describe outcomes, not implementations.

- **SC-001 (Onboarding speed)**: A new engineer with prerequisites
  installed can clone the repo and reach a green health check, a
  rendered dashboard in `ar` and `en`, and a rendered customer
  site in `ar` and `en` in **under 90 minutes** following the
  documented quickstart.
- **SC-002 (Module scaffolding speed)**: A backend engineer can
  add a new tenant-scoped module that inherits authentication,
  permissions, tenant isolation, validation, error handling,
  pagination, and Swagger documentation **without writing any
  cross-cutting plumbing** — verified by the sample-module
  exercise in User Story 2.
- **SC-003 (Localization completeness)**: 100% of foundation UI
  text in the dashboard and the customer site is rendered
  through the i18n system (no hard-coded English strings); a
  full RTL pass on every foundation screen produces no visual
  defects in a manual review.
- **SC-004 (Tenant-isolation safety)**: At least one automated
  isolation test exists per tenant-scoped foundation table, and
  every test passes. The repository helper refuses any query
  against a tenant-scoped table without tenant context — verified
  by a unit test.
- **SC-005 (Secret-leak safety)**: A static check fails the build
  if any frontend client-side file references a non-`NEXT_PUBLIC_*`
  variable. The check is exercised in CI on every PR.
- **SC-006 (Deployment readiness)**: A second engineer who did
  not author the runbook can deploy the stack to a clean VPS,
  reach a green health check at the production URL over HTTPS,
  and confirm no secrets are present in either frontend bundle —
  in **under one working day**.
- **SC-007 (API discoverability)**: 100% of foundation endpoints
  appear in Swagger UI with their DTOs, error codes, required
  authentication, and required permissions visible.
- **SC-008 (Edge-case coverage)**: Every edge case listed in the
  Edge Cases section has a corresponding automated test that
  asserts the documented behavior.
- **SC-009 (Cross-app type sharing)**: The dashboard and customer
  site import shared types from `packages/types/` and a manual
  attempt to redefine a shared type in an app fails the lint or
  typecheck step.
- **SC-010 (Documentation accuracy)**: A reviewer following the
  "how to add a new module" guide verbatim produces a working,
  Swagger-documented, role-gated module — verified by the
  exercise in User Story 2.
- **SC-011 (Performance baseline)**: Under documented baseline
  load measured at the load balancer, foundation read endpoints
  meet **p95 ≤ 200 ms** and foundation write endpoints meet
  **p95 ≤ 500 ms**. The baseline is exercised by a CI load test
  that runs against the deployed staging environment; failures
  block release. These thresholds are inherited as the default
  by every later feature unless explicitly raised in that
  feature's spec.
- **SC-012 (Availability target)**: The v1 production deployment
  meets a **99.5% monthly uptime** target on a single-VPS
  topology, with daily Supabase database snapshots, weekly
  off-site backup verification, and a documented manual-failover
  rebuild runbook with **RTO ≤ 4 hours** and **RPO ≤ 24 hours**.
  Higher SLOs and HA topologies are revisited at the Public GA
  milestone.
- **SC-013 (Accessibility conformance)**: Automated accessibility
  scans of the dashboard and customer-website foundation pages
  produce **zero WCAG 2.1 AA violations**, in both Arabic (RTL)
  and English (LTR). The CI accessibility check fails the build
  on any new violation. A documented screen-reader smoke test
  passes on at least one modern screen reader.
- **SC-014 (Privacy readiness)**: The foundation ships with a
  published privacy policy in Arabic and English, an empty-but-
  scaffolded PII catalog, an empty-but-scaffolded retention
  policy, and a documented internal data-subject-rights
  procedure. A trial export-and-erase rehearsal against a test
  customer succeeds within 30 days end-to-end.
- **SC-015 (Observability scaffolding)**: A reviewer can swap
  the default no-op `MetricsService` and `TracingService` for a
  real implementation in **a single Common-module wiring
  change**, with no edits to any other module, and observe
  metrics and traces flowing from request handling, audit
  writes, ledger writes, idempotency checks, and webhook
  signature verification.

---

## Out of Scope (this phase)

The following are explicitly **not** delivered by this feature.
They appear in later Spec-Kit features (see
`docs/bootstrap-and-build-sequencing.md`).

- Full merchant onboarding and approval workflows (feature 007).
- Product CRUD, variants, brands, categories (features 009–011).
- Inventory implementation beyond schema (feature 012).
- Cart, checkout, orders, sub-orders (features 013–015).
- Coupon application engine (feature 016).
- Payment provider integrations and ledger flows (features 018–023).
- Shipping rate sheets, carriers, and integrations (features 017,
  032).
- Promotions engine, notifications, reviews, wishlist, reports
  (features 024–028).
- Multi-warehouse, purchase orders, stock transfers (features
  029–030).
- Flutter mobile app implementation (feature 034).
- Full UI design system beyond the shadcn/ui defaults; final
  visual design lands during the catalog and commerce phases.

---

## Security Requirements (consolidated)

Security obligations appear inline in the FRs above. Consolidated
here for cross-cutting visibility:

- The Supabase service role key MUST never reach any frontend
  surface (FR-SUPA-004, FR-SEC-001).
- Every protected endpoint MUST require JWT authentication
  (FR-AUTH-002, FR-SEC-002).
- Every sensitive endpoint MUST require permission checks
  (FR-AUTH-005, FR-SEC-003).
- Tenant-scoped data access MUST be isolated server-side
  (FR-TEN-001 through FR-TEN-007).
- Sensitive actions MUST be audit-logged (FR-SEC-004).
- All required environment variables MUST be validated at boot
  (FR-CFG-001, FR-BACK-012).
- API errors MUST NOT leak internals (FR-BACK-008, FR-SEC-009).
- Webhooks MUST be signature-verified before business logic
  (FR-API-007).
- Rate limits MUST protect auth, payment, and webhook endpoints
  (FR-SEC-005).
- Soft-delete MUST be the default for compliance-sensitive
  entities (FR-SEC-008, FR-PRIS-006).

---

## Assumptions

- The constitution at `.specify/memory/constitution.md` v1.0.0 is
  in force and binding. Any conflict between this spec and the
  constitution is resolved in the constitution's favor; conflicts
  trigger a constitutional amendment, not a spec workaround.
- The dashboard is delivered as a **single Next.js app with
  role-gated route groups** (per the user's explicit choice
  "shared dashboard with role-based routing"). Platform Admin,
  Merchant Owner, Merchant Staff, Finance Admin, and Support
  Agent experiences live in this one app, not separately.
- The customer site lives at `apps/website/` (matching the user's
  spec input). Earlier planning docs use `apps/web/` — those docs
  will be reconciled with this spec on the next constitution
  amendment cycle, with `apps/website/` as the source of truth.
- Supabase is the runtime PostgreSQL, Auth, and Storage provider.
  Self-hosting Postgres alongside the app is not pursued.
- Real-time, search, queues, and email/push providers are
  scaffolded only in this phase. Their integrations land in the
  features that need them (notifications, products, payments,
  etc.) per the bootstrap-and-build-sequencing roadmap.
- The eight roles listed in FR-AUTH-003 are the canonical role
  set for v1. Adding more roles requires a constitution
  amendment.
- The repository uses pnpm workspaces and Turborepo for the
  monorepo orchestration (per the approved plan in
  `docs/bootstrap-and-build-sequencing.md`). This is a
  workspace-tool choice that satisfies FR-REPO-002; substituting
  another workspace tool requires re-evaluating the FR.
- The development team's working language for code, schema, API
  routes, and in-code documentation is English (per the
  constitution Principle VIII). Arabic and English are user-facing
  only.

---

## Dependencies

- **Constitution**: `.specify/memory/constitution.md` v1.0.0.
- **Approved bootstrap plan**: `docs/bootstrap-and-build-sequencing.md`.
- **Approved phased delivery plan**: `docs/phased-delivery-plan.md`.
- **External services to be provisioned before implementation**:
  a Supabase development project (with PostgreSQL connection
  details, anon key, service role key, JWT secret), DNS for the
  staging/production hostnames, and a TLS certificate strategy
  for Nginx.

---

## Out of Scope Crosswalk → Future Features

| Out-of-scope area | Owning future feature |
|---|---|
| Auth flows (login UI, OAuth, password reset) | 005 `auth-and-users` |
| Roles & Permissions admin UI and seeding beyond foundation | 006 `roles-and-permissions` |
| Merchant onboarding / approval | 007 `merchants-and-stores` |
| Product / catalog | 009–011 |
| Inventory beyond schema | 012 |
| Cart / checkout / orders | 013–015 |
| Coupons | 016 |
| Shipping (rate sheets) | 017 |
| Payments | 018–019 |
| Commissions / wallet / payouts / refunds | 020–023 |
| Notifications | 024 |
| Promotions engine | 025 |
| Reviews | 026 |
| Wishlist | 027 |
| Reports | 028 |
| Multi-warehouse and stock ops | 029–030 |
| Carrier integrations | 032 |
| Mobile | 034 |
