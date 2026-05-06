# Implementation Plan: Platform Foundation Bootstrap

**Branch**: `001-platform-bootstrap` | **Date**: 2026-05-06 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `specs/001-platform-bootstrap/spec.md`
**Constitution version**: 1.0.0
**Companion docs**: `docs/bootstrap-and-build-sequencing.md`, `docs/phased-delivery-plan.md`

---

## Summary

Stand up the runnable, deployable monorepo and the cross-cutting backend
plumbing that every later Spec-Kit feature will reuse. The deliverable
is a green-health, empty-of-business-logic system: containers come up
locally and on a single VPS; the NestJS backend serves
`GET /api/v1/health`, `GET /api/v1/me`, and Swagger at `/api/docs`; both
Next.js apps render in Arabic (RTL) and English (LTR); Prisma migrations
have created only the foundation tables (users, roles, permissions and
joins, audit_logs, settings, currencies, exchange_rates, tax_classes,
country_tax_rules, ledger_accounts, ledger_entries); the Common module
exposes the documented guards, decorators, interceptors,
state-component primitives, no-op observability interfaces, and the
ledger and audit services that future modules call into.

The technical approach commits to: monorepo with pnpm workspaces +
Turborepo; NestJS modular monolith with one module per foundation
domain; Prisma against Supabase Postgres with migrations checked in;
Supabase Auth + JWT verification through JWKS; `JwtAuthGuard` global
with `@Public()` opt-out; `PermissionsGuard` opt-in via `@Permissions()`;
`@StoreScope()` decorator threads tenant context into a typed
`TenantContext` consumed by every tenant-scoped repository call;
class-validator DTOs for every endpoint; uniform success/error
envelopes; `Idempotency-Key` interceptor recording first response
keyed by `(actor, route, key, body-hash)`; structured JSON logging
with redaction; correlation IDs propagated via `x-request-id`;
`MetricsService` and `TracingService` registered as no-op providers
(real implementations land in a later observability feature). Frontends
use Next.js App Router with role-gated route groups for the dashboard
and a public/SEO-friendly layout for the customer site; both consume
the standard envelope through a shared, typed API client in
`packages/api-client/`. Translatable fields use JSONB
`{ ar: string, en: string }` with a translation-fallback policy
resolved in Phase 0.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict). Node.js 20 LTS for the
backend and the Next.js apps. Flutter is roadmap-only and has no
implementation in this phase.

**Primary Dependencies**:
- Backend: NestJS 10.x, Prisma 5.x, `@supabase/supabase-js`, `class-validator`,
  `class-transformer`, `nestjs/swagger`, `nestjs/jwt` + `jose` (for JWKS
  verification), `pino` (structured logging), `bullmq` (queue factory shell;
  no live queues in this phase), `rxjs`.
- Dashboard & website: Next.js 14+ App Router, React 18, Tailwind CSS,
  shadcn/ui, `@tanstack/react-query`, `zustand` (UI state where needed),
  `next-intl` (i18n) with RTL stylesheet flipping, `axe-core` for CI a11y,
  `@supabase/auth-helpers-nextjs` (auth flows only).
- Tooling: pnpm, Turborepo, ESLint, Prettier, Husky, lint-staged,
  TypeScript project references via `packages/tsconfig/`.
- Testing: Vitest (unit) for backend and frontends; supertest +
  Vitest for backend integration tests; Playwright for end-to-end smoke
  tests of foundation user stories; Testcontainers (or a Docker-Compose
  test profile) for ephemeral Postgres in integration tests.

**Storage**: Supabase PostgreSQL via Prisma. Supabase Storage configured
with an `avatars` bucket placeholder. No additional managed datastores
in this phase. Redis and Meilisearch are NOT deployed in Phase 0 — their
docker compose entries are scaffolded but commented for activation in
Phase 2 (search) and Phase 4/5 (queues / real-time).

**Testing**:
- Unit tests for foundation services (Common module, AuditService,
  LedgerService, PrismaService transaction helper, env validation).
- Integration tests for: JWT validation, `JwtAuthGuard` global behavior,
  `PermissionsGuard`, `@StoreScope()` repository refusal, audit
  interceptor, idempotency interceptor, error envelope, pagination
  envelope.
- E2E (Playwright) smoke for: locale switch + RTL on dashboard and web,
  login redirect, Forbidden state, health endpoint reachability through
  Nginx.
- Accessibility tests via axe-core against storybook/sample pages.

**Target Platform**: Linux x86_64 server (single VPS for production),
Docker Compose orchestrated, behind Nginx reverse proxy with SSL via
Let's Encrypt (or pre-issued certificates). Developer machines: macOS,
Linux, Windows (WSL2 recommended on Windows) all supported via Docker
Desktop.

**Project Type**: Web service (NestJS API) + two web applications
(Next.js dashboard and Next.js customer website) + a placeholder for
a future mobile application. Monorepo layout (Option 2 in the template,
extended).

**Performance Goals** (from spec SC-011): Foundation read endpoints
**p95 ≤ 200 ms**, write endpoints **p95 ≤ 500 ms**, measured at the
load balancer under documented baseline load. The "documented
baseline load" definition is resolved in Phase 0 research and committed
in `research.md`.

**Constraints**:
- Constitution v1.0.0 binding: Modular Monolith (I), Multi-Tenancy &
  Data Isolation (II), Spec-First (III), Security/Auth/Audit by
  default (IV), API Contract Discipline (V), Configuration Over
  Hardcoding (VI), i18n & RTL First-Class (VII), Production-Ready
  Quality Bar (VIII).
- Single-VPS topology for v1 (FR-DEP-009); 99.5% availability target
  (SC-012); RTO ≤ 4 h, RPO ≤ 24 h.
- WCAG 2.1 AA across all UI (FR-A11Y-001..004, SC-013).
- KSA PDPL & Egypt PDPL acknowledged (FR-PRIV-001..006, SC-014).
- TypeScript strict mode in every package.
- No business logic in Phase 0 (no products, orders, payments, etc.).

**Scale/Scope**:
- Phase 0 traffic: a handful of internal users, no real customers.
  Capacity sized for a single VPS comfortably below 100 RPS sustained.
- Phase 0 schema: ~13 foundation tables, all empty except seed data
  (8 roles + a starter permission catalog).
- Codebase size projected for Phase 0 deliverable: backend ~30
  modules' worth of cross-cutting code (~5–8 kLOC TS), dashboard
  shell with role-gated routing (~3 kLOC TSX), customer site shell
  (~2 kLOC TSX), shared packages (~1 kLOC). Numbers are order-of-
  magnitude estimates.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The plan is checked against the eight binding principles plus the
domain rules and standards in the constitution v1.0.0.

| # | Principle / Rule | Compliance | Evidence in this plan |
|---|---|---|---|
| I | Modular Monolith & Backend Ownership | ✅ | NestJS modular monolith; Common module owns guards/interceptors/services. No business logic in frontends. Prisma is sole ORM. |
| II | Multi-Tenancy & Data Isolation | ✅ | Tenant-context primitive (`@StoreScope()` + `TenantContext` injected into repositories); isolation enforced server-side; isolation tests required (FR-TEN-007). |
| III | Spec-First Development (NON-NEGOTIABLE) | ✅ | This plan exists because the spec exists. Phase 0 research will resolve any remaining clarifications **before** code. Tasks generated only after this plan is approved. |
| IV | Security, Auth & Audit by Default | ✅ | `JwtAuthGuard` global with `@Public()` opt-out; `PermissionsGuard` for sensitive routes; `@Audit()` decorator + `AuditService` writing immutable rows; class-validator DTOs everywhere; secrets backend-only; webhook signature verification convention; soft-delete default; transactions via PrismaService helper. |
| V | API Contract Discipline | ✅ | REST under `/api/v1`; Swagger generated from decorators; consistent envelopes; pagination DTO; idempotency interceptor; webhook signature convention; canonical error-code registry. |
| VI | Configuration Over Hardcoding | ✅ | `Settings` table for runtime-tunable config; environment variables validated by zod schema at boot; provider abstractions established for later phases. |
| VII | Internationalization & RTL First-Class | ✅ | Translatable JSONB shape mandated; both frontends ship with `ar` (RTL) and `en` (LTR) from day one; Tailwind RTL support; `next-intl` integration. |
| VIII | Production-Ready Quality Bar | ✅ | TS strict mode; layered controllers→services→repositories; Loading/Empty/Error/Forbidden state primitives; testing standards committed (foundation tests for auth, isolation, idempotency, audit, ledger). |

**Domain rules check (foundation-relevant):**
- Tax/VAT: tax-exclusive prices, computed at checkout (foundation
  scaffolds `tax_classes` + `country_tax_rules` only). ✅
- Payments: provider abstraction NOT instantiated here; ledger schema
  scaffolded. ✅
- Inventory: deferred. ✅
- Notifications: provider abstraction shell only; no live providers. ✅

**Cross-phase tracks check:**
- Audit log discipline: enforced via `@Audit()` decorator and
  AuditService. ✅
- Tenant isolation tests: required by FR-TEN-007. ✅
- i18n + RTL: built into the dashboard and customer website shells. ✅
- Documentation: README, architecture overview, quickstarts, deployment
  runbook, "how to add a new module" guide all required (FR-DOC-001..006). ✅

**Verdict**: Constitution check PASSES at plan stage. No exceptions.
Re-check is performed after Phase 1 design (data-model + contracts).

---

## Project Structure

### Documentation (this feature)

```text
specs/001-platform-bootstrap/
├── plan.md                  # This file
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/               # Phase 1 output
│   ├── README.md
│   ├── health.openapi.yaml
│   ├── me.openapi.yaml
│   ├── settings.openapi.yaml
│   ├── envelopes.md         # Standard success/error envelope shapes
│   └── error-codes.md       # Canonical error code registry (v1 seed)
├── checklists/
│   └── requirements.md      # Already created by /speckit.specify
├── spec.md
└── tasks.md                 # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
ecommerce_system/                         (monorepo root)
├── apps/
│   ├── backend/                          NestJS modular monolith
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── modules/
│   │   │   │   ├── common/               Guards, decorators, interceptors,
│   │   │   │   │                         filters, DTOs, envelopes, error-code
│   │   │   │   │                         registry, MetricsService (no-op),
│   │   │   │   │                         TracingService (no-op).
│   │   │   │   ├── config/               Env schema (zod), feature flags.
│   │   │   │   ├── prisma/               PrismaService + transaction helper.
│   │   │   │   ├── supabase/             Supabase admin/anon clients;
│   │   │   │                             JWKS-based JWT verifier.
│   │   │   │   ├── auth/                 JwtAuthGuard, PermissionsGuard,
│   │   │   │                             @CurrentUser, @Public, @Roles,
│   │   │   │                             @Permissions, @StoreScope,
│   │   │   │                             auto-provisioning of profiles.
│   │   │   │   ├── users/                Profile read endpoint (GET /me).
│   │   │   │   ├── roles/                Roles + Permissions foundation
│   │   │   │                             (read-only listing endpoints).
│   │   │   │   ├── settings/             Setting read endpoint demonstrating
│   │   │   │                             @Permissions() + audit.
│   │   │   │   ├── audit/                AuditService + Audit interceptor.
│   │   │   │   ├── ledger/               LedgerService skeleton (no flows).
│   │   │   │   ├── currencies/           Read-only listing.
│   │   │   │   ├── tax/                  Read-only listing of tax classes
│   │   │   │                             and country tax rules.
│   │   │   │   └── health/               Per-dependency health endpoint.
│   │   │   └── i18n/                     Optional backend message catalog
│   │   │                                 (only if needed; constitution prefers
│   │   │                                 frontend-owned translations).
│   │   ├── prisma/                       schema.prisma + migrations
│   │   ├── test/                         Unit + integration suites
│   │   └── package.json
│   ├── dashboard/                        Next.js (admin + merchant + staff +
│   │                                     finance + support; role-gated)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (admin)/              Platform Admin route group
│   │   │   │   ├── (merchant)/           Merchant Owner / Staff route group
│   │   │   │   ├── (finance)/            Finance Admin route group
│   │   │   │   ├── (support)/            Support Agent route group
│   │   │   │   ├── (auth)/               Login + session-expired flows
│   │   │   │   ├── api/                  Server actions / route handlers
│   │   │   │   ├── globals.css
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── states/               Loading, Empty, Error, Forbidden
│   │   │   │   └── shell/                Role-aware nav, header, locale.
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts               Supabase auth client wrapper
│   │   │   │   ├── api-client.ts         (re-export from packages/api-client)
│   │   │   │   ├── permissions.ts        usePermission() hook + guards
│   │   │   │   └── i18n.ts               next-intl setup, RTL toggle
│   │   │   └── styles/
│   │   ├── public/
│   │   ├── tests/                        Vitest + Playwright smoke
│   │   └── package.json
│   ├── website/                          Next.js customer marketplace
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (public)/             Home, search, product, store
│   │   │   │   ├── (account)/            Authenticated account routes
│   │   │   │   ├── stores/[storeSlug]/   Store page route shell
│   │   │   │   ├── api/
│   │   │   │   ├── globals.css
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   └── styles/
│   │   ├── public/
│   │   └── package.json
│   └── mobile/                           Flutter (placeholder only)
│       └── README.md
├── packages/
│   ├── api-client/                       Typed fetch wrapper consuming
│   │                                     standard envelopes; shared between
│   │                                     dashboard + website.
│   ├── shared/                           Cross-app helpers (formatters,
│   │                                     translations, error codes mirror).
│   ├── types/                            Shared TS types and DTO mirrors
│   │                                     (export from backend DTOs).
│   ├── config/                           Shared env-schema helpers,
│   │                                     tsconfig presets, eslint config,
│   │                                     prettier config, tailwind preset.
│   └── i18n/                             Shared message catalogs
│                                         (en/ar) for UI strings.
├── docker/
│   ├── backend.Dockerfile
│   ├── dashboard.Dockerfile
│   ├── website.Dockerfile
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── conf.d/
│   ├── docker-compose.yml                production-shape
│   ├── docker-compose.dev.yml            developer override
│   └── README.md
├── docs/
│   ├── architecture-overview.md
│   ├── how-to-add-a-module.md
│   ├── quickstart-local.md
│   ├── quickstart-docker.md
│   ├── deployment-runbook.md
│   ├── folder-structure.md
│   ├── privacy/
│   │   ├── pii-catalog.md                empty-but-scaffolded
│   │   ├── retention-policy.md           empty-but-scaffolded
│   │   └── privacy-policy.md             v1 in en + ar
│   ├── bootstrap-and-build-sequencing.md (existing)
│   └── phased-delivery-plan.md           (existing)
├── specs/
│   └── 001-platform-bootstrap/           (this feature)
├── .specify/                             (existing)
├── .github/
│   └── workflows/
│       ├── ci.yml                        lint, typecheck, test, axe scan
│       └── load-test.yml                 CI baseline-load run against staging
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

**Structure Decision**: Monorepo using **pnpm workspaces +
Turborepo** (Option 2, extended). The decision is binding per the
approved plan in `docs/bootstrap-and-build-sequencing.md` §4. The
backend and the two Next.js apps are separate workspace packages; the
mobile folder is a placeholder. Shared TypeScript packages
(`packages/api-client`, `packages/types`, `packages/shared`,
`packages/config`, `packages/i18n`) provide cross-app reuse without
publishing to a registry.

The customer site lives at `apps/website/` (matching the spec input).
The earlier planning doc's `apps/web/` reference is reconciled to
`apps/website/` going forward — the planning doc will be updated in
the next constitution amendment cycle.

---

## Phase 0 — Research

Phase 0 produces `research.md`. The intent is to resolve every
genuinely unknown technical decision **before** writing data-model
and contracts.

Phase 0 research topics:

1. **Permission string naming convention** (deferred from clarify
   round 2, Q1) — pin the exact string format used across all
   modules (`<scope>.<resource>.<action>`).
2. **Audit log payload shape** (deferred from clarify round 2, Q2)
   — fix the columns and JSONB shape so every later module's audit
   writes are uniform.
3. **Baseline load definition for SC-011** (deferred from clarify
   round 2, Q3) — pin the RPS/concurrent-user numbers that the CI
   load test exercises so the p95 thresholds are verifiable.
4. **Translation fallback policy** (deferred from clarify round 2,
   Q4) — when a translatable JSONB field has only one of `ar`/`en`
   populated, what does the API return for the missing locale?
5. **Supabase outage degradation policy** (deferred from clarify
   round 2, Q5) — health endpoint behavior, error envelope, and
   client UX when Supabase Postgres or Auth is unreachable.
6. **JWKS verification cache strategy** — how aggressively to
   cache Supabase JWKS, refresh policy on key rotation.
7. **Idempotency-Key body-hash algorithm** — pin algorithm (SHA-256
   over canonicalized JSON) and TTL (24 h default; configurable).
8. **i18n routing pattern** — sub-path (`/ar/...`) vs cookie-only;
   SEO and Next.js App Router considerations.
9. **CSP / security headers baseline** — defaults shipped by Nginx
   for both Next.js apps and the backend.
10. **Soft-delete query convention** — Prisma middleware vs explicit
    `.where({ deletedAt: null })` everywhere; how to opt in.

Each research topic becomes one entry in `research.md` with
**Decision**, **Rationale**, **Alternatives considered**.

---

## Phase 1 — Design & Contracts

Phase 1 produces:

- `data-model.md` — every foundation table with columns, types,
  relationships, indexes, soft-delete policy, translatable fields,
  and seed data (the eight roles plus a starter permissions catalog).
- `contracts/` — OpenAPI specs for the foundation endpoints and
  documented standard envelopes / error-code registry.
- `quickstart.md` — local dev quickstart (clone → run).
- Agent context update via `update-agent-context.ps1`.

Phase 1 endpoints (foundation):

- `GET /api/v1/health` — overall + per-dependency status, version.
- `GET /api/v1/me` — current user profile + roles + permissions.
- `GET /api/v1/roles` — list seeded roles (read-only).
- `GET /api/v1/permissions` — list permission catalog (read-only).
- `GET /api/v1/settings` and `GET /api/v1/settings/:key` — read,
  permission-gated, audit-logged demonstration endpoints.
- `GET /api/v1/currencies` — list currencies.
- `GET /api/v1/tax-classes` — list tax classes.
- `GET /api/v1/country-tax-rules` — list country tax rules.

Out of scope (these endpoints do **not** exist in Phase 0): any
mutation endpoints for merchants/products/orders/payments/etc. The
foundation is read-mostly with a couple of permission-gated
demonstrators so the patterns are exercised end-to-end.

---

## Complexity Tracking

The plan introduces no exceptions to the constitution. The single
notable complexity is the breadth of the foundation itself — many
small, cross-cutting concerns must coexist correctly. This is
inherent to a foundation phase, not a deviation. No table entry
required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| (none) | — | — |
