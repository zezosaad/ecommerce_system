<!--
SYNC IMPACT REPORT
==================
Version change: (none) → 1.0.0   [Initial ratification]
Bump rationale: First materialization of the constitution from the template. No
prior version exists, so this is published as MAJOR 1.0.0 to establish the
authoritative baseline for all downstream specs, plans, and code generation.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Modular Monolith & Backend Ownership
  - [PRINCIPLE_2_NAME] → II. Multi-Tenancy & Data Isolation
  - [PRINCIPLE_3_NAME] → III. Spec-First Development (NON-NEGOTIABLE)
  - [PRINCIPLE_4_NAME] → IV. Security, Auth & Audit by Default
  - [PRINCIPLE_5_NAME] → V. API Contract Discipline
  - (added)            → VI. Configuration Over Hardcoding
  - (added)            → VII. Internationalization & RTL First-Class
  - (added)            → VIII. Production-Ready Quality Bar

Added sections:
  - Technology Stack & Architecture Constraints
  - Domain Rules (Payments, Inventory, Promotions, Shipping, Notifications)
  - Frontend & Mobile Standards
  - Testing & Deployment Standards
  - Spec-Kit Workflow
  - Governance (amendment procedure, versioning policy, compliance review)

Removed sections:
  - All template placeholder blocks ([SECTION_2_NAME], [SECTION_3_NAME], etc.)

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md      — review "Constitution Check"
        gate to reference Principles I–VIII (verify on next /speckit.plan run).
  - ✅ .specify/templates/spec-template.md      — ensure mandatory sections
        cover acceptance criteria, edge cases, and security requirements
        (already present in template per Spec-Kit defaults).
  - ✅ .specify/templates/tasks-template.md     — ensure task categorization
        includes contract tests, isolation tests, and migrations.
  - ⚠ README.md / docs/quickstart.md            — pending; create once first
        feature spec lands and quickstart guidance is ready.

Deferred TODOs:
  - None. All placeholders resolved from user input on 2026-05-06.
-->

# E-Commerce Marketplace Platform Constitution

> **Project**: Multi-Vendor E-Commerce Marketplace Platform
> **Scope**: Backend (NestJS), Customer Website (Next.js), Admin & Merchant
> Dashboard (Next.js), Mobile App (Flutter — roadmap), and supporting
> infrastructure.
> **Authority**: This document supersedes all other engineering practices,
> coding habits, and informal agreements. Every spec, plan, task, PR, and
> deployment MUST comply with the principles below. Where this document and
> any other guideline conflict, this document wins.

---

## Core Principles

### I. Modular Monolith & Backend Ownership

The system MUST be implemented as a **modular monolith** in NestJS. All
business logic — pricing, inventory reservation, commission calculation,
order orchestration, payment settlement, promotion evaluation, tax/VAT —
MUST live in the backend. Frontends (web, dashboard, mobile) are
presentation layers and MUST NOT replicate, override, or bypass backend
business rules.

Rules:

- Each domain module (Auth, Users, Roles, Merchants, Stores, Products,
  Categories, Inventory, Warehouses, Carts, Checkout, Orders, Sub-Orders,
  Payments, Commissions, Payouts, Refunds, Shipping, Coupons, Promotions,
  Notifications, Reports, Reviews, Wishlist, Addresses, Currencies,
  Tax/VAT, Settings, Audit Logs) MUST be a self-contained NestJS module
  with explicit public interfaces.
- Cross-module communication MUST go through documented service
  interfaces or a domain event bus. Direct imports of another module's
  internal repositories are FORBIDDEN.
- Prisma is the **only** ORM for application database access. Raw SQL is
  permitted only for performance-critical reads with explicit review.
- Supabase provides PostgreSQL, Auth, and Storage. Supabase Row-Level
  Security MAY supplement, but MUST NOT replace, NestJS-side authorization.

**Rationale**: A modular monolith gives us shipping velocity now and a
clean extraction path to services later. Centralizing business logic
prevents drift between web/mobile clients and protects financial
correctness.

### II. Multi-Tenancy & Data Isolation

The platform is multi-tenant by construction. Every record that belongs
to a merchant MUST carry `merchant_id` and, where applicable, `store_id`.
Every query that reads or mutates merchant-scoped data MUST enforce that
isolation.

Rules:

- Super Admin MAY access all data. Merchant Owner and Store Staff MAY
  access only their own merchant/store data, gated by role and permission.
  Customers MAY access only their own data.
- Merchant-scoped repositories MUST accept and enforce a tenant context
  (`merchant_id` / `store_id`) on every read, write, update, and delete.
  A query that omits tenant context against a tenant-scoped table is a
  bug and MUST fail code review.
- Orders MUST model a parent `Order` plus per-merchant `SubOrder`s. Cart
  and checkout MUST allow products from multiple merchants in a single
  customer purchase, splitting into sub-orders at order placement.
- Reports, dashboards, and exports MUST be scoped by role: platform
  admins see global aggregates; merchants see only their own.
- Tenant isolation MUST be covered by automated tests. Cross-tenant data
  leakage is a release-blocking defect.

**Rationale**: The marketplace's integrity depends on merchants trusting
that their data, orders, and finances are walled off from other
merchants. Isolation is a security property, not a UX nicety.

### III. Spec-First Development (NON-NEGOTIABLE)

No production code MAY be written before its governing spec exists and
has been read.

Rules:

- Every major feature MUST have, at minimum: `spec.md`, `plan.md`,
  `tasks.md`. It MUST also have `data-model.md` when database changes
  are required, `contracts/` when APIs are introduced or changed, and
  `quickstart.md` when setup or developer-facing usage is involved.
- Each spec MUST define: user scenarios, functional requirements,
  acceptance criteria, edge cases, and security requirements.
- Tasks MUST be small, ordered, and independently actionable.
- If a requirement is ambiguous, implementation MUST stop and seek
  clarification (`/speckit.clarify`) rather than guess.
- Code that has no spec, or that diverges from its spec, MUST be either
  reverted or paired with an amendment to the spec in the same PR.

**Rationale**: Specs prevent rework, clarify acceptance, and make
generated code reviewable. They are the single source of truth that
both humans and AI assistants commit to.

### IV. Security, Auth & Audit by Default

Authentication, authorization, validation, and auditability are baseline
requirements — not features.

Rules:

- Authentication MUST use Supabase Auth issuing JWTs; NestJS MUST
  validate every JWT it accepts.
- Every protected endpoint MUST apply an authentication guard. Every
  sensitive endpoint MUST additionally apply role and permission checks
  (RBAC + fine-grained permissions for store staff).
- Every endpoint MUST validate input via class-validator DTOs. Untyped
  `any` payloads are FORBIDDEN.
- All provider secrets (payment, shipping, notification, Supabase
  service keys) MUST live in environment variables and MUST NEVER be
  shipped to any frontend bundle.
- Sensitive operations — merchant approval, role changes, payouts,
  refunds, settings changes, gateway config changes, manual stock
  adjustments — MUST write an immutable entry to `audit_logs`.
- Soft deletes MUST be used for entities with business or compliance
  history (orders, payments, payouts, ledger entries, audit logs).
- Webhooks MUST verify provider signatures before any business effect
  and MUST log the raw payload for replay/forensics.
- All financial state changes (payment, order, sub-order, inventory
  reservation, ledger, payout) MUST execute inside a database
  transaction. Eventual consistency is permitted only across
  asynchronous boundaries (notifications, reporting projections), never
  within a single business transaction.

**Rationale**: Money and customer trust are the assets at risk. Every
default leans toward "fail closed."

### V. API Contract Discipline

The backend exposes a versioned, documented, consistent REST API.

Rules:

- REST is the default style. All public APIs MUST be exposed under a
  version prefix (e.g., `/api/v1/...`). Breaking changes require a new
  version.
- Swagger/OpenAPI documentation MUST be generated from code (decorators
  + DTOs) and MUST be kept current. An undocumented endpoint is a
  defect.
- All list endpoints MUST support pagination, and SHOULD support
  filtering and sorting where the use case warrants.
- Responses MUST follow a consistent success envelope. Errors MUST
  follow a consistent error envelope with a stable `code`, human
  message, and (where appropriate) `details`.
- Payment intents, checkout submissions, and any state-mutating retry-
  prone operation MUST accept and honor an `Idempotency-Key` header.
- Webhooks MUST be authenticated, logged, and processed idempotently.

**Rationale**: Multiple clients (customer web, dashboard, Flutter app,
third-party integrations) depend on these contracts. Discipline here
prevents costly client breakage.

### VI. Configuration Over Hardcoding

Anything a non-engineer might reasonably want to change MUST be
configurable.

Rules:

- Business settings — currencies, tax/VAT rules, commission rates,
  shipping zones and rates, payment provider credentials and modes
  (test/live), notification provider credentials and templates,
  promotion rules, feature flags — MUST be stored in the database and
  manageable from the dashboard.
- Hardcoded business values in source code are FORBIDDEN. Constants for
  technical defaults (timeouts, page sizes) are permitted but SHOULD be
  overridable via configuration when realistic.
- Each payment provider, shipping provider, and notification provider
  MUST be implemented behind a provider-abstraction interface and MUST
  support per-environment test/live modes from configuration.

**Rationale**: Operations, finance, and merchants need to change
parameters without engineering involvement. Hardcoding turns business
changes into release events.

### VII. Internationalization & RTL First-Class

Arabic and English are co-equal first-class languages, with RTL support
required everywhere a user sees content.

Rules:

- All user-facing UI (customer site, admin dashboard, merchant
  dashboard, Flutter app) MUST render correctly in both LTR (English)
  and RTL (Arabic).
- Database fields that hold user-facing content (product names,
  descriptions, category names, store names, notification templates,
  promotion labels) MUST support Arabic and English values, typically
  via a structured translations column or related table.
- API responses MUST return localized fields in a structure compatible
  with frontend locale switching (e.g., `{ en, ar }` or honoring an
  `Accept-Language` header).
- Multi-currency and country-aware pricing, tax/VAT, and shipping MUST
  be supported end to end.

**Rationale**: The target market spans Arabic- and English-speaking
users. Bolt-on i18n always loses; it must be designed in from day one.

### VIII. Production-Ready Quality Bar

Every change MUST be production-ready. "Demo code" is not acceptable in
the main branch.

Rules:

- TypeScript strict mode MUST be enabled in all TypeScript projects.
- Code MUST follow the layered conventions: Controllers → Services
  (business logic) → Prisma/repositories (data access). DTOs validate
  input; Guards enforce authentication/authorization; Interceptors and
  Filters handle cross-cutting concerns when appropriate.
- Duplication of business logic across modules is FORBIDDEN; extract
  into a shared service or domain library.
- Critical business flows MUST have automated tests (see Testing
  Standards): authentication, permissions, merchant isolation, product
  creation, inventory reservation, checkout, payments, refunds,
  coupons, shipping rates, payout calculation.
- Frontends MUST handle loading, empty, error, and forbidden (no
  permission) states explicitly. Silent failures are FORBIDDEN.
- All code, file names, database fields, API routes, and in-code
  comments and documentation MUST be in English. User-facing content is
  governed by Principle VII.

**Rationale**: We are building a financial system that handles real
purchases. The bar is "ready for paying customers," not "works on my
machine."

---

## Technology Stack & Architecture Constraints

The following stack is binding. Substitutions require a constitution
amendment.

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Backend          | NestJS (TypeScript, strict mode)                        |
| Database         | Supabase PostgreSQL                                     |
| ORM              | Prisma                                                  |
| Auth             | Supabase Auth + JWT validation in NestJS                |
| API Docs         | Swagger / OpenAPI                                       |
| Storage          | Supabase Storage                                        |
| Admin/Merchant   | Next.js + TypeScript + Tailwind CSS + shadcn/ui         |
| Customer Site    | Next.js                                                 |
| Mobile (roadmap) | Flutter                                                 |
| Deployment       | Docker + Docker Compose, Nginx reverse proxy on VPS, SSL |
| Architecture     | Modular Monolith                                        |

Architectural constraints:

- The backend is the system of record. Frontends MUST NOT bypass it.
- Module boundaries are enforced by directory structure and code review;
  reaching into another module's internals is FORBIDDEN.
- Long-running or asynchronous work (email, SMS, WhatsApp, push,
  webhooks consumption, reports) MUST be queued and processed
  asynchronously, not inline in request handlers.

---

## Domain Rules

### Payments

- Payment integrations MUST use a `PaymentProvider` abstraction. Adding
  a provider means implementing the interface, not editing core flow.
- Supported methods (initial set): Cash on Delivery, Bank Transfer,
  Visa/Mastercard, Apple Pay, Google Pay, Samsung Pay, Moyasar, Tap
  Payments, Stripe, PayPal, HyperPay, PayTabs, MyFatoorah, Checkout.com.
- Each provider's credentials, mode (test/live), enabled methods, and
  scope (platform-wide vs. merchant-specific) MUST be configurable from
  the dashboard.
- The system MUST support three settlement models simultaneously:
  **platform-collected**, **merchant-collected**, and **hybrid**.
- Webhooks MUST be signature-verified and processed idempotently.
- The system MUST maintain a **financial ledger** capturing every
  movement (charge, capture, refund, commission accrual, payout,
  adjustment) with double-entry semantics or an equivalent auditable
  scheme. Commissions, payouts, and refunds MUST reconcile against the
  ledger.

### Inventory

- Inventory MUST support warehouses, on-hand quantities, reserved
  quantities, stock movements, low-stock alerts, purchase orders,
  stock transfers between warehouses, returns restocking, and damaged-
  stock write-offs.
- Stock MUST be reserved at checkout (with a TTL), committed on
  payment success, and released on cancellation, payment failure,
  refund, or expiration.
- Inventory invariants MUST hold across checkout, payment,
  cancellation, refund, and return flows. Negative on-hand or reserved
  values are FORBIDDEN and MUST be enforced at the database level
  where feasible.

### Promotions

- A rule-based promotion engine MUST evaluate: coupons, percentage and
  fixed discounts, flash sales, free shipping, buy-X-get-Y, category
  discounts, product discounts, store-level discounts, and customer-
  segment discounts.
- Platform admins MAY create global promotions. Merchants MAY create
  store-scoped promotions when permitted by platform settings.
- Promotion stacking, exclusivity, and precedence rules MUST be
  defined explicitly in the promotion engine, not improvised in
  controllers.

### Shipping

- The platform MAY define **global shipping companies** usable by any
  merchant. Merchants MAY use platform companies and/or add **private
  shipping companies** scoped to their store.
- Shipping configuration MUST support zones, countries, cities, rates,
  delivery time, tracking, and COD availability.
- Shipping rate selection MUST be deterministic and traceable for any
  given cart.

### Notifications

- Channels: Email, SMS, WhatsApp, Push, In-App. Each channel uses a
  configurable provider behind an abstraction.
- Templates MUST exist in both Arabic and English and MUST be editable
  from the dashboard.
- Required notification events include order lifecycle, payment
  outcomes, shipping updates, inventory alerts, merchant approval,
  refunds, coupon usage, and payouts.

---

## Frontend & Mobile Standards

- Admin dashboard and merchant dashboard MAY share a Next.js codebase
  but MUST be cleanly separated by role and permission. A merchant MUST
  NEVER see admin-only screens, navigation, or data — even briefly
  during loading.
- All frontends MUST handle: loading, empty, error, and
  permission-denied states explicitly, including in lists, detail
  pages, and forms.
- Frontends MUST NOT compute pricing, taxes, commissions, or stock
  decisions locally for the purpose of completing a transaction. They
  MAY display server-provided values.
- The Flutter mobile app (roadmap) MUST consume the same versioned
  REST APIs as the web clients and MUST cover, at minimum:
  authentication, products browsing, cart, checkout, orders, profile,
  addresses, wishlist, and notifications, with Arabic/English/RTL
  support.

---

## Testing Standards

- Unit tests MUST cover service-layer business logic.
- Integration tests MUST cover the following flows end-to-end against a
  real (test) database where feasible:
  authentication, permission enforcement, **merchant isolation**,
  product creation, inventory reservation, checkout (multi-merchant),
  payment success and failure paths, refunds, coupon application,
  shipping rate computation, and payout calculation.
- Tests MUST be deterministic. Flaky tests MUST be fixed or quarantined
  with a tracking ticket; they MUST NOT be silenced.
- A failing test in a critical flow is a release blocker.

---

## Deployment Standards

- All environments (dev, staging, production) MUST be defined via
  Docker / Docker Compose with environment-specific configuration.
- Production MUST run behind Nginx as a reverse proxy with SSL/TLS
  enforced. HTTP MUST redirect to HTTPS.
- Production secrets MUST be injected via environment variables or a
  secrets manager. They MUST NEVER appear in committed files.
- Database migrations MUST be authored via Prisma Migrate, reviewed,
  and applied as part of an explicit, logged release step. Schema
  drift between environments is FORBIDDEN.
- Deployment documentation MUST be kept current in `docs/` (or
  equivalent) and MUST cover: prerequisites, environment variables,
  bring-up sequence, migration application, rollback, and smoke tests.

---

## Spec-Kit Workflow

This project is governed by Spec-Kit. The workflow is:

1. `/speckit.constitution` — establish or amend this document.
2. `/speckit.specify` — author `spec.md` for a feature.
3. `/speckit.clarify` — resolve ambiguities before planning.
4. `/speckit.plan` — produce `plan.md`, `data-model.md`, `contracts/`,
   and `quickstart.md` as applicable.
5. `/speckit.tasks` — produce a small, ordered, actionable `tasks.md`.
6. `/speckit.implement` — execute tasks against the spec.

Mandatory artifacts per major feature:

- `spec.md`               — always required.
- `plan.md`               — always required.
- `tasks.md`              — always required.
- `data-model.md`         — required when DB schema changes.
- `contracts/`            — required when APIs are added or changed.
- `quickstart.md`         — required when setup or usage instructions
                            are needed.

Each `spec.md` MUST contain explicit sections for **acceptance
criteria**, **edge cases**, and **security requirements**. AI assistants
(including Claude Code) MUST follow the spec exactly. When requirements
are unclear, implementation MUST stop and request clarification rather
than guess.

---

## Governance

### Authority and Precedence

This constitution supersedes all other engineering practices. Where any
README, internal doc, code comment, or informal agreement conflicts
with this document, this document wins until amended.

### Amendment Procedure

1. Propose the change as a PR that edits `.specify/memory/constitution.md`
   together with any affected templates (`.specify/templates/*`) and
   docs.
2. The PR description MUST state: motivation, scope of change, version
   bump (MAJOR / MINOR / PATCH), and migration impact on existing
   specs/code.
3. The PR MUST be approved by at least one project owner / maintainer.
4. On merge, run `/speckit.constitution` to regenerate the Sync Impact
   Report at the top of this file.

### Versioning Policy

Semantic versioning of the constitution itself:

- **MAJOR** — Backward-incompatible governance changes, removed
  principles, or redefined principles in ways that invalidate prior
  specs.
- **MINOR** — New principle or section added, or material expansion of
  existing guidance.
- **PATCH** — Clarifications, wording, typo fixes, non-semantic
  refinements.

### Compliance Review

- Every PR review MUST verify compliance with the principles relevant
  to the change. PRs that violate the constitution MUST be either
  revised or paired with a constitution amendment.
- Each `/speckit.plan` run MUST execute a Constitution Check gate that
  cross-references Principles I–VIII and the domain rules above.
- A quarterly compliance review SHOULD audit: tenant isolation in
  queries, Swagger coverage, audit-log completeness for sensitive
  actions, secrets hygiene, and test coverage of the critical flows
  enumerated in Testing Standards.

### Non-Compliance

Shipping code that violates this constitution is grounds for revert.
Repeated violations MUST be raised as process issues, not absorbed as
"the way we do things."

---

**Version**: 1.0.0 | **Ratified**: 2026-05-06 | **Last Amended**: 2026-05-06
