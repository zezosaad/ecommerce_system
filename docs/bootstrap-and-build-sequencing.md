# Plan: Bootstrap & Build Sequencing for VendorHub Marketplace

> **Status**: Approved 2026-05-06.
> **Date**: 2026-05-06
> **Constitution version in force**: 1.0.0
> **Source**: Generated via `/plan` and approved through ExitPlanMode.
> **Working copy**: `C:\Users\zezo\.claude\plans\sharded-discovering-avalanche.md`

---

## 1. Context

The user shared a long-form architecture/feature document drafted with ChatGPT
("VendorHub Commerce Platform") covering a multi-vendor e-commerce marketplace:
NestJS modular monolith + Prisma + Supabase (Postgres / Auth / Storage),
Next.js dashboards and customer site, Flutter app on the roadmap, Docker on a
Hostinger VPS, Arabic/English with full RTL, multi-currency, tax/VAT,
multi-warehouse inventory, parent + per-merchant sub-orders, hybrid payment
settlement, ~14 payment gateways, 5 notification channels, full ledger.

Repo state is **truly greenfield** — only `.specify/`, `.git/`, and `.claude/`
exist. The constitution at `.specify/memory/constitution.md` was just ratified
at v1.0.0 and pins the binding stack and rules. The ChatGPT document is a
loose PRD/architecture doc; this plan turns it into:

1. A locked set of **bootstrap-level decisions** that every later spec depends on.
2. A **module dependency-ordered build sequence** the team can execute against.
3. A **first concrete Spec-Kit feature to scaffold** (`001-platform-bootstrap`).

The intended outcome is that, after this plan is approved, the next command
the user runs is `/speckit.specify 001-platform-bootstrap` and we proceed
through the Spec-Kit lifecycle one feature at a time, with all cross-cutting
choices already settled.

---

## 2. Locked Decisions (20 answers from the interview)

| # | Decision | Choice |
|---|---|---|
| 1 | MVP scope | **Full Phase 1** — entire ChatGPT doc shipping pre-launch |
| 2 | Launch market | **Multi-region from day 1 (MENA + beyond)** |
| 3 | Repo structure | **Monorepo with Turborepo + pnpm workspaces** |
| 4 | Commission model | **Per-category percentage** |
| 5 | Payouts | **Weekly cadence, 7-day post-delivery hold, configurable threshold** |
| 6 | Pay-collection mode | **Per-merchant setting** (platform / merchant / hybrid) |
| 7 | Refund/RMA flow | **Customer requests → Merchant approves → Platform executes** (within configurable return window) |
| 8 | Wallets | **Merchant wallet only** (no customer wallet) |
| 9 | Search engine | **Meilisearch (self-hosted via Docker)** |
| 10 | i18n storage | **JSONB column per translatable field**: `{ ar, en }` |
| 11 | Real-time | **NestJS WebSocket Gateway (Socket.IO)** with Redis adapter |
| 12 | Auth methods | **Email + password + Google OAuth** (phone OTP and Apple OAuth deferred) |
| 13 | Brand modeling | **First-class Brand entity** (name JSONB, logo, slug, country) |
| 14 | Variant modeling | **Attribute / AttributeValue tables + Variant join** (translatable values) |
| 15 | Reviews | **Verified-buyer reviews on products + merchant ratings + merchant replies + admin moderation** |
| 16 | Platform-as-seller | **Platform is a special seeded Merchant** (`is_platform = true`) |
| 17 | Tax/VAT | **Tax-exclusive prices, tax computed at checkout per destination** |
| 18 | Roles in v1 | Super Admin, Platform Admin, Merchant Owner, Merchant Staff, Customer, Finance Admin, Support Agent, Shipping Agent |
| 19 | Shipping in v1 | **Manual rate sheets only**; carrier APIs in v1.x |
| 20 | Notification providers v1 | **Email = SendGrid**, **Push = FCM**. SMS + WhatsApp: provider abstraction in place, no integration shipped in v1. |

**Items left for per-feature specs (not blocking the plan):**
- Frontend state library (Zustand vs Redux Toolkit) — decide in `apps/dashboard` bootstrap spec.
- Test database strategy (Docker Postgres vs Supabase test project) — decide in `apps/backend` test spec.
- E-invoicing integrations (ZATCA / ETA) — phase as country-specific specs once tax module is in place.
- Customer wallet, loyalty/points, subscription products, bundle products — confirmed in scope per Q1 but designed in their own specs.

---

## 3. Risks & Tensions to Acknowledge

The user explicitly chose "Full Phase 1" scope (everything in the ChatGPT doc
before launch) combined with "multi-region from day 1" and a full role
hierarchy. The plan respects this call but flags:

- **Scope vs timeline**: Full Phase 1 with multi-region, multi-warehouse,
  full ledger, RMA, all 14 payment gateways, ratings/reviews, Meilisearch,
  WebSockets, and all 8 roles is a 6–12 month build with a focused team. A
  smaller team should expect longer.
- **Multi-region launch tax exposure**: Multi-region (MENA + beyond) means
  ZATCA (KSA) and ETA (Egypt) e-invoicing become real obligations the moment
  invoices are issued from those countries. We are deferring compliance
  integrations but **must surface the obligation** in the Tax/VAT spec.
- **No phone OTP**: Phone-based signup is a strong KSA/GCC UX expectation.
  v1 ships without it; recommend revisiting before KSA/UAE marketing push.
- **Payment gateway count**: 14 listed gateways. Each is a 1–3-week
  integration. We will sequence by region priority and ship the abstraction
  + 3–4 gateways in v1; the rest become follow-on specs.
- **Shipping Agent role with manual rates only**: The role makes sense once
  carrier integrations exist; in v1 it's effectively a read-only tracking
  updater. Document the v1 thin scope clearly.

---

## 4. Architecture Snapshot (locked)

```
ecommerce_system/                    (monorepo root, pnpm workspaces + Turborepo)
├── apps/
│   ├── backend/                     NestJS modular monolith
│   ├── dashboard/                   Next.js (admin + merchant, role-gated)
│   ├── web/                         Next.js (customer marketplace)
│   └── mobile/                      Flutter (roadmap; scaffolded later)
├── packages/
│   ├── shared-types/                Cross-app TypeScript types (DTOs, enums)
│   ├── i18n/                        Static UI translation keys (ar/en)
│   ├── eslint-config/               Shared ESLint config
│   └── tsconfig/                    Shared tsconfig presets
├── prisma/
│   └── schema.prisma                Single source of truth for DB schema
├── infra/
│   ├── docker/                      Dockerfiles per app
│   ├── nginx/                       Reverse proxy config (SSL/HTTP→HTTPS)
│   └── docker-compose.yml           Dev + prod compose
├── .specify/                        (already exists)
├── specs/                           Feature specs (created via /speckit.specify)
├── turbo.json                       Turborepo pipeline
├── pnpm-workspace.yaml
└── package.json
```

External services:
- **Supabase**: Postgres + Auth + Storage (one project per environment).
- **Meilisearch**: Docker container alongside the backend. Indexes products,
  stores, brands, categories.
- **Redis**: Docker container. Used by NestJS for the Socket.IO adapter,
  BullMQ queues (notifications, webhooks, search sync, payouts), and
  rate-limiting.
- **SendGrid**: Email.
- **FCM**: Push.
- Payment gateways: integrated per region priority via `PaymentProvider`
  abstraction.

---

## 5. Module Dependency Graph (build order)

The constitution's 28 modules cannot all start at once. The dependency graph
forces this order:

```
Tier 0 — Cross-cutting infrastructure (must exist before any module ships)
  Audit Logs · Settings · Currencies · Tax/VAT (config only) · Financial Ledger

Tier 1 — Identity & tenancy
  Auth → Users → Roles & Permissions → Merchants → Stores → Addresses

Tier 2 — Catalog
  Categories → Brands → Attributes/Variants → Products → Inventory (single-warehouse)
                                            ↘ Reviews (read-only seed)

Tier 3 — Commerce core
  Cart → Checkout → Orders + Sub-Orders → Coupons (basic) → Shipping (manual rates)

Tier 4 — Money
  Payments (gateway abstraction + 1 online + COD + bank transfer)
    → Commissions → Merchant Wallet → Payouts → Refunds (RMA)

Tier 5 — Engagement & ops
  Notifications (email + in-app + push) → Promotions engine →
  Reviews (write + moderation) → Wishlist → Reports

Tier 6 — Depth & scale
  Multi-warehouse → Purchase orders → Stock transfers → Damaged stock →
  Additional payment gateways (Tier 4 expansion) →
  Carrier API integrations → Advanced reports → Mobile app
```

Within "Full Phase 1" all six tiers ship before launch. The order above is
the **build order**, not the **launch order**.

---

## 6. Build Sequence (Spec-Kit features to scaffold, in order)

Each entry below maps to one `/speckit.specify` invocation. Naming follows
Spec-Kit's sequential numbering (existing extension is configured for it).

| # | Feature slug | Tier | Output |
|---|---|---|---|
| 001 | `platform-bootstrap` | 0 | Monorepo scaffold, NestJS shell, Next.js shells, Prisma init, Docker Compose, Nginx, Supabase client, Swagger, JWT guard, i18n + RTL plumbing, ESLint/TS strict, Husky, CI skeleton |
| 002 | `audit-logs-and-settings` | 0 | `audit_logs` + `settings` (key/value scoped global/merchant) tables + service + admin UI |
| 003 | `currencies-and-tax-config` | 0 | Currencies table, exchange-rate table, tax classes, country tax rules, merchant tax registration fields |
| 004 | `financial-ledger-skeleton` | 0 | Double-entry ledger schema (`ledger_accounts`, `ledger_entries`), service contract, no real flows wired yet |
| 005 | `auth-and-users` | 1 | Supabase Auth integration, JWT validation, email+password + Google OAuth, user profile, soft-delete, audit-logged sensitive ops |
| 006 | `roles-and-permissions` | 1 | RBAC tables, 8 seeded roles, fine-grained permissions, guards, decorators (`@Permissions()`), seed data |
| 007 | `merchants-and-stores` | 1 | Merchant + Store tables (slug-unique), platform-merchant seed, onboarding/approval flow with audit logs, store page route shape `/stores/:storeSlug` |
| 008 | `addresses` | 1 | Customer + merchant addresses, country/city tables, validation per region |
| 009 | `categories-and-brands` | 2 | Category tree (translatable), Brand entity (translatable, logo on Supabase Storage) |
| 010 | `attributes-and-variants` | 2 | Attribute + AttributeValue tables (translatable), variant join table |
| 011 | `products` | 2 | Products (Simple + Variable + Digital + Service + Bundle stubs), Meilisearch indexer worker, store-scoped + marketplace-wide search APIs |
| 012 | `inventory-single-warehouse` | 2 | Warehouse, stock_levels, reservations, stock movements, low-stock alerts; ledger-style movement table |
| 013 | `cart` | 3 | Multi-merchant cart, server-side cart for logged-in users, guest cart merge on login |
| 014 | `checkout` | 3 | Quote calculation (tax per destination, shipping per zone, coupons), reservation, idempotency keys |
| 015 | `orders-and-sub-orders` | 3 | Parent Order + per-merchant SubOrder, status state machines, ledger entries on transitions |
| 016 | `coupons-basic` | 3 | Coupon entity, application engine v1 (code-based, fixed/percent, expiry, usage limits) |
| 017 | `shipping-manual-rates` | 3 | Shipping companies (platform-global + merchant-private), zones, manual rates, COD flag, tracking URL templates |
| 018 | `payments-abstraction` | 4 | `PaymentProvider` interface, idempotent intents, signed webhook handling, audit + ledger entries |
| 019 | `payments-providers-v1` | 4 | First gateway integrations (chosen from doc list per region priority, ~3-4 gateways) + COD + bank transfer |
| 020 | `commissions` | 4 | Per-category commission config, accrual on sub-order delivery, ledger entries |
| 021 | `merchant-wallet` | 4 | Wallet balance derived from ledger views; debit on payout, credit on commission accrual |
| 022 | `payouts` | 4 | Weekly batch payout job, 7-day delivery hold, threshold check, payout records, audit |
| 023 | `refunds-rma` | 4 | RMA workflow (customer request → merchant approve → platform execute), partial refunds at sub-order line level, commission reversal, restock, ledger entries |
| 024 | `notifications-core` | 5 | Provider abstraction, template registry (ar/en), event bus, in-app + email (SendGrid) + push (FCM) channels |
| 025 | `promotions-engine` | 5 | Rule-based engine: percent/fixed, BOGO, free shipping, flash sales, category/store/segment scopes, stacking + precedence rules |
| 026 | `reviews` | 5 | Verified-buyer write flow, merchant rating aggregation, merchant replies, admin moderation queue |
| 027 | `wishlist` | 5 | Customer wishlist with merge-on-login |
| 028 | `reports` | 5 | Role-scoped report endpoints + dashboard widgets (admin global, merchant own) |
| 029 | `multi-warehouse` | 6 | Extends inventory: per-merchant warehouses, warehouse selection during fulfillment, stock transfers, audit |
| 030 | `purchase-orders-and-stock-ops` | 6 | Purchase orders, damaged stock, return restocking, stock-transfer workflows |
| 031 | `payments-providers-v1.x` | 6 | Remaining gateways from the doc's 14 |
| 032 | `carrier-integrations` | 6 | API integrations: Aramex, SMSA, Bosta (and DHL/J&T as needed) — rate quotes, AWB generation, tracking webhooks |
| 033 | `advanced-reports` | 6 | Cohort/retention, GMV trends, tax/VAT exports per country, payout reconciliation |
| 034 | `mobile-app-bootstrap` | 6 | Flutter app skeleton consuming versioned REST APIs |

This is the suggested sequencing. Re-ordering within a tier is fine; jumping
across tiers risks missing dependencies (e.g., shipping before checkout,
commissions before orders).

---

## 7. Critical Files (created across the build sequence — not in plan-mode scope)

Plan mode does not allow creating these now. They will be authored under
their respective Spec-Kit features.

- `package.json`, `pnpm-workspace.yaml`, `turbo.json` — feature 001
- `apps/backend/` — NestJS bootstrap, feature 001
- `apps/dashboard/`, `apps/web/` — Next.js bootstraps, feature 001
- `packages/shared-types/`, `packages/i18n/`, `packages/eslint-config/`, `packages/tsconfig/` — feature 001
- `prisma/schema.prisma` — grows feature by feature; first models in feature 002
- `infra/docker/`, `infra/nginx/`, `infra/docker-compose.yml` — feature 001
- `.env.example` — feature 001 (placeholders for Supabase URL/key, Meilisearch, Redis, SendGrid, FCM, OAuth)
- `apps/backend/src/modules/<module>/` — one directory per module per the constitution and feature list above
- `specs/001-platform-bootstrap/spec.md` (and downstream `plan.md`, `tasks.md`, etc.) — generated by `/speckit.specify`

---

## 8. Reusable Patterns to Establish in Feature 001

These get authored once and reused by every later module. Naming them here so
later specs can reference them by location:

- `apps/backend/src/common/guards/jwt-auth.guard.ts` — Supabase JWT validation against JWKS.
- `apps/backend/src/common/guards/permissions.guard.ts` + `@Permissions(...)` decorator — RBAC + fine-grained.
- `apps/backend/src/common/decorators/tenant.decorator.ts` — extracts `merchant_id`/`store_id` from request, fed to repositories.
- `apps/backend/src/common/interceptors/audit.interceptor.ts` — declarative audit logging on sensitive endpoints.
- `apps/backend/src/common/interceptors/idempotency.interceptor.ts` — `Idempotency-Key` handling for payments/checkout.
- `apps/backend/src/common/filters/all-exceptions.filter.ts` — uniform error envelope.
- `apps/backend/src/common/dto/pagination.dto.ts`, `sort.dto.ts`, `filter.dto.ts` — list-endpoint primitives.
- `apps/backend/src/common/i18n/translatable.ts` — Zod/class-validator helper for `{ ar, en }` JSONB fields.
- `apps/backend/src/common/ledger/ledger.service.ts` — single entry point for all ledger writes; only this service may insert ledger rows.
- `apps/backend/src/common/queues/` — BullMQ queue factory.
- `apps/dashboard/src/lib/auth.ts`, `apps/web/src/lib/auth.ts` — Supabase client wrappers.
- `apps/dashboard/src/components/states/{Loading,Empty,Error,Forbidden}.tsx` — required state components per constitution Principle VIII.

These are constitutional infrastructure — every later module must use them
rather than reinventing.

---

## 9. Verification

After feature 001 ships, the bootstrap is verifiable by:

1. **Container bring-up**: `docker compose up` brings up Postgres (Supabase
   local or remote), Meilisearch, Redis, the NestJS backend, the dashboard,
   and the customer site behind Nginx. All health checks green.
2. **Backend smoke**: `GET /api/v1/health` returns 200; `GET /api/docs`
   serves Swagger UI; an unauthenticated `GET /api/v1/me` returns 401; a
   request bearing a valid Supabase JWT returns 200 with the user profile.
3. **Frontend smoke**: dashboard at `/`, customer site at `/`, both render
   in English and Arabic with RTL flipped layouts; locale switch persists.
4. **Database**: `pnpm prisma migrate status` shows clean state; the
   `audit_logs`, `settings`, and `ledger_accounts` tables exist and are
   empty.
5. **Tooling**: `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass.

After each subsequent feature ships, verification follows the spec's
acceptance criteria and is checked against the constitution's Testing
Standards (auth, permissions, merchant isolation, product creation,
inventory reservation, checkout, payments, refunds, coupons, shipping,
payouts) — each is required to be covered by automated tests when its
corresponding module ships.

---

## 10. What Happens After This Plan Is Approved

1. User runs `/speckit.specify 001-platform-bootstrap`.
2. The pre-hook `speckit.git.feature` creates a feature branch.
3. Spec-Kit generates `specs/001-platform-bootstrap/spec.md`. The user (or
   I) fill it in with concrete acceptance criteria, edge cases, and
   security requirements per Principle III.
4. `/speckit.clarify` resolves any remaining ambiguities.
5. `/speckit.plan` produces `plan.md`, `data-model.md` (Tier-0 tables),
   `contracts/` (auth + health endpoints), and `quickstart.md`.
6. `/speckit.tasks` produces an ordered task list.
7. `/speckit.implement` executes — and at that point we leave plan mode
   for code mode.

Subsequent features 002–034 follow the same loop, in the order in §6.
