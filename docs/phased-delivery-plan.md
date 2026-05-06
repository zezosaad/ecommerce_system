# Phased Delivery Plan — VendorHub Marketplace

> **Companion to**: `docs/bootstrap-and-build-sequencing.md` and
> `.specify/memory/constitution.md` v1.0.0.
> **Date**: 2026-05-06
> **Authority**: This plan defines *when* features ship in time-boxed phases.
> The build-sequencing doc defines *what depends on what* (the 34-feature
> dependency order). The constitution defines the rules every phase must
> respect. If they conflict, escalate to amend the constitution.

---

## How to Read This Plan

- The user explicitly chose **Full Phase 1** scope (entire ChatGPT doc
  before public launch). This plan respects that — but breaks the work
  into **internal phases with measurable exit criteria and demoable
  milestones**, rather than a single "build everything for 9 months and
  hope" runway.
- Each phase has a duration **range** (in weeks). Ranges assume a small
  focused team (1 backend lead + 1 frontend lead + 1 fullstack +
  designer/PM as needed). Lower bound = experienced team and clean
  execution; upper bound = realistic with normal friction. Solo or very
  small teams should expect the upper bound or longer.
- Phases are mostly **sequential** because of the dependency graph in
  the build-sequencing doc. Where a phase can run in parallel, this
  plan calls it out.
- Exit criteria are **gates**: a phase is not "done" until every gate
  is green. The constitution's Testing Standards apply at every gate.

---

## Timeline Overview

| Phase | Name | Features | Duration | Milestone |
|-------|------|----------|----------|-----------|
| 0 | Foundations | 001–004 | 3–4 weeks | Bootstrap Complete |
| 1 | Identity & Tenancy | 005–008 | 4–5 weeks | **Internal Alpha 1** — Merchant Onboarding |
| 2 | Catalog | 009–012 | 6–8 weeks | **Internal Alpha 2** — Browseable Marketplace |
| 3 | Commerce Core | 013–017 | 6–8 weeks | **Internal Alpha 3** — End-to-End COD |
| 4 | Money | 018–023 | 8–10 weeks | **Internal Beta** — Live Payments, Payouts, Refunds |
| 5 | Engagement & Ops | 024–028 | 5–7 weeks | **Feature-Complete Beta** |
| 6 | Hardening & Pilot | (no new features) | 4–6 weeks | **Closed Pilot Launch** |
| 7 | Depth & Scale | 029–033 | 10–14 weeks | **Public GA** |
| 8 | Mobile App | 034 + parity | 8–12 weeks | **Mobile GA** (can parallel-start in Phase 6) |

**Total sequential**: ~54–74 weeks (≈ 13–18 months) to public GA, plus
mobile. With Phase 8 parallelized from Phase 6 onward, mobile lands at or
near Public GA. Numbers are estimates, not commitments — they assume
weekly velocity, no major scope additions, and that Spec-Kit features stay
small enough to ship in 3–7 days each.

---

## Phase 0 — Foundations *(3–4 weeks)*

**Goal**: Stand up the monorepo, the runtime, and the cross-cutting
infrastructure every later module depends on. No business behavior yet.

**Spec-Kit features**: 001 `platform-bootstrap`, 002 `audit-logs-and-settings`,
003 `currencies-and-tax-config`, 004 `financial-ledger-skeleton`.

**Deliverables**:
- Turborepo + pnpm workspaces, NestJS shell, Next.js dashboard + customer
  shells, Flutter folder placeholder.
- Docker Compose stack: Postgres (Supabase or local), Meilisearch, Redis,
  backend, dashboard, web, Nginx.
- Prisma initialized, migrations flow proven, `audit_logs` + `settings` +
  `currencies` + `exchange_rates` + `tax_classes` + `ledger_accounts` +
  `ledger_entries` tables exist (empty).
- Cross-cutting code from §8 of the bootstrap doc: JWT guard, permissions
  guard skeleton, tenant decorator, audit interceptor, idempotency
  interceptor, exception filter, pagination/sort/filter DTOs, translatable
  helper, ledger service, BullMQ queue factory.
- i18n + RTL plumbing in dashboard and web, Arabic/English locale switch.
- Swagger live at `/api/docs`. CI green: lint, typecheck, test.

**Exit criteria (gates)**:
- `docker compose up` succeeds; all services healthy.
- `GET /api/v1/health` 200; `GET /api/v1/me` 401 unauthenticated.
- Dashboard and web home pages render in `ar` (RTL) and `en` (LTR).
- `pnpm prisma migrate status` clean; tables above exist and are empty.
- `pnpm lint && pnpm typecheck && pnpm test` all pass.

**Risks**: Supabase auth integration glitches; Docker on Windows hosts;
i18n/RTL plumbing harder than expected. Buffer ~3 days for these.

---

## Phase 1 — Identity & Tenancy *(4–5 weeks)*  →  **Internal Alpha 1**

**Goal**: A real merchant can sign up, get approved, set up a store, and
manage staff and addresses. Platform admins can manage users and roles.

**Spec-Kit features**: 005 `auth-and-users`, 006 `roles-and-permissions`,
007 `merchants-and-stores`, 008 `addresses`.

**Deliverables**:
- Email + password and Google OAuth working through Supabase Auth, JWT
  validated in NestJS, profile management, soft-deletes, audit logging.
- 8 roles seeded (Super Admin, Platform Admin, Merchant Owner, Merchant
  Staff, Customer, Finance Admin, Support Agent, Shipping Agent),
  fine-grained permissions, `@Permissions()` decorator wired across
  routes.
- Merchant onboarding + approval workflow with audit trail. Platform-as-
  merchant seed row created at migration time.
- Stores with unique slugs and `/stores/:storeSlug` route shape (no
  product content yet, but the page exists).
- Customer + merchant addresses, country and city tables with a small
  seed for launch markets.

**Exit criteria (gates)**:
- A merchant can complete signup → application → approval → store
  creation in dashboard.
- Tenant isolation integration tests pass (merchant A cannot read or
  mutate merchant B's records via any endpoint).
- All sensitive operations (approval, role changes, settings changes)
  appear in `audit_logs`.
- Permission gates verified by integration tests for all 8 roles.

**Milestone**: **Internal Alpha 1** — demoable merchant onboarding flow.

**Risks**: Permission matrix sprawl. Lock the permission list in spec
006; defer additions until Phase 5.

---

## Phase 2 — Catalog *(6–8 weeks)*  →  **Internal Alpha 2**

**Goal**: Browseable marketplace. Merchants list products with variants,
brands, and categories. Customers browse, search, and filter — but
cannot yet check out.

**Spec-Kit features**: 009 `categories-and-brands`, 010
`attributes-and-variants`, 011 `products`, 012 `inventory-single-warehouse`.

**Deliverables**:
- Hierarchical categories (translatable). Brand entity with logo on
  Supabase Storage, slug, country, translatable name.
- Attribute + AttributeValue tables (translatable, swatches), variants
  joined to products through normalized attribute pairs.
- Product types: Simple + Variable functional; Digital, Service, Bundle
  modeled as stubs (creation works; checkout treats as Simple until later).
- Subscription products: schema placeholder only (full lifecycle in a
  later phase).
- Single-warehouse inventory: stock levels, reservations, movements,
  low-stock thresholds, audit trail.
- Meilisearch indexer worker (BullMQ-backed) keeps indexes in sync with
  Prisma writes. Marketplace-wide and store-scoped search APIs and UI.

**Exit criteria (gates)**:
- A merchant creates a Variable product with 3 attributes (color, size,
  material) and 6 variants in under 5 minutes through the dashboard.
- Customer site lists products from all merchants with filters working
  (category, brand, price range, store, rating placeholder).
- Search returns results in Arabic and English with typo tolerance
  (Meilisearch baseline).
- `/stores/:storeSlug` shows the merchant's products and store metadata.
- Inventory tests: reservation, commit, release, low-stock alert all green.

**Milestone**: **Internal Alpha 2** — browseable marketplace (no checkout).

**Risks**: Search relevance tuning for Arabic stems. Variant UI complexity.
Bundle/Digital/Service flagged as stub creation only — explicit deferral.

---

## Phase 3 — Commerce Core *(6–8 weeks)*  →  **Internal Alpha 3**

**Goal**: End-to-end purchase with Cash on Delivery. Multi-merchant cart
splits into a parent order plus per-merchant sub-orders. Inventory and
ledger stay consistent across the flow.

**Spec-Kit features**: 013 `cart`, 014 `checkout`, 015 `orders-and-sub-orders`,
016 `coupons-basic`, 017 `shipping-manual-rates`.

**Deliverables**:
- Multi-merchant cart (server-side for logged-in users; guest cart with
  merge-on-login).
- Checkout with quote calculation: per-destination tax (tax-exclusive
  prices, computed at checkout), per-zone shipping, coupon application,
  inventory reservation with TTL, idempotency keys honored.
- Orders + Sub-Orders state machines, ledger entries on every transition.
- Basic coupons (code-based, fixed/percent, expiry, usage limits, per-
  customer limits). Promotions engine deferred to Phase 5.
- Shipping manual rate sheets: shipping companies (platform-global +
  merchant-private), zones (country/city), per-zone rates, COD flag,
  delivery time, tracking URL templates.

**Exit criteria (gates)**:
- A customer adds items from 2 merchants + 1 platform product to cart,
  checks out with COD, and the system creates 1 parent order + 3 sub-
  orders with correct line items, tax, shipping, and reservations.
- Inventory invariants hold: on-hand − reserved = available, no negative
  values, reservations release on cancellation/expiry.
- Tax invoices generate per sub-order with the correct VAT rate for the
  destination.
- Idempotency: replaying a checkout request with the same key returns
  the same order, no duplicates.
- All Testing Standards flows for checkout, coupons, shipping rates pass.

**Milestone**: **Internal Alpha 3** — full purchase flow with COD.

**Risks**: Tax computation across destinations is the highest-complexity
piece in this phase. Multi-merchant cart edge cases (different shipping
zones, different stock states across the cart). Coupon stacking — keep
v1 strictly non-stacking.

---

## Phase 4 — Money *(8–10 weeks)*  →  **Internal Beta**

**Goal**: Real money. Online payments via 3–4 gateways, accrued
commissions, merchant wallet, weekly payouts, end-to-end refunds and
ledger consistency. This is the riskiest phase — every flow must be
tested under every failure mode.

**Spec-Kit features**: 018 `payments-abstraction`, 019
`payments-providers-v1`, 020 `commissions`, 021 `merchant-wallet`, 022
`payouts`, 023 `refunds-rma`.

**Deliverables**:
- `PaymentProvider` interface with idempotent intent creation, signed
  webhook validation, audit + ledger entries on every state change.
- 3–4 gateways live (selected by region priority — likely Tap/Moyasar
  for KSA, Paymob for Egypt, Stripe as global fallback) plus COD and
  Bank Transfer as built-in providers. Provider configs (test/live mode,
  keys, fees, allowed methods, allowed merchants) editable from
  dashboard.
- Per-category commission rates configurable; commission accrual
  triggered on sub-order delivery; ledger entries written.
- Merchant wallet balance derived from ledger views (no separate wallet
  table — pure read-side projection). Credits on commission accrual,
  debits on payout.
- Weekly payout job (BullMQ scheduled): includes only earnings whose
  delivery is ≥ 7 days old, respects threshold, writes payout records,
  audit-logged, manual approval optional per merchant.
- RMA workflow: customer request within configurable window → merchant
  approval (or admin override) → platform executes refund via original
  gateway, restocks per disposition (resellable / damaged), reverses
  commission accrual, writes ledger entries.

**Exit criteria (gates)**:
- A live test purchase via each integrated gateway succeeds, and a
  refund of that purchase succeeds, with ledger entries reconciling to
  zero.
- A weekly payout run for a test merchant produces the correct amount
  (sales − commissions − refunds within hold) and updates the wallet.
- All Testing Standards for payments, refunds, payouts pass.
- Webhook replay protection verified (duplicate webhook does not
  double-count).
- Failure modes covered: gateway timeout, webhook lost, payment
  succeeded after timeout, partial refund on partial-delivery sub-order.

**Milestone**: **Internal Beta** — live payments, payouts, refunds.

**Risks**: Highest-risk phase by far. Reserve buffer; do not skip the
ledger reconciliation tests. Plan for one full week of money-flow
hardening before declaring exit.

---

## Phase 5 — Engagement & Ops *(5–7 weeks)*  →  **Feature-Complete Beta**

**Goal**: Bring the system to feature-complete state for the v1 launch
scope (everything except multi-warehouse, additional gateways, carrier
APIs, and the mobile app — those are Phase 7+).

**Spec-Kit features**: 024 `notifications-core`, 025 `promotions-engine`,
026 `reviews`, 027 `wishlist`, 028 `reports`.

**Deliverables**:
- Notifications: provider abstraction, ar/en template registry, event
  bus, in-app + email (SendGrid) + push (FCM) channels live. SMS and
  WhatsApp wired through abstraction but no provider integration shipped.
- Promotions engine: rule-based, supports percent/fixed, BOGO, free
  shipping, flash sales, category/store/segment scopes, stacking and
  precedence policy (single explicit policy, not ad-hoc).
- Reviews: verified-buyer write flow, merchant rating aggregation,
  merchant reply, admin moderation queue.
- Wishlist with merge-on-login.
- Role-scoped reports: admin sees global GMV, commission, merchants top
  list, refund rates, shipping performance, coupon performance, tax/VAT
  summary; merchants see only their own. Basic charts in dashboard.

**Exit criteria (gates)**:
- An order placed by a customer triggers the documented notification
  matrix (order created, paid, shipped, delivered) on email + in-app +
  push.
- A flash-sale promotion correctly applies precedence over a coupon per
  the documented stacking policy.
- A delivered order produces a reviewable product; a non-buyer cannot
  review.
- Admin and merchant report dashboards render with correct role-scoped
  data.

**Milestone**: **Feature-Complete Beta** — all v1-scope features in
place, ready for hardening.

---

## Phase 6 — Hardening & Pilot *(4–6 weeks)*  →  **Closed Pilot Launch**

**Goal**: No new features. Production hardening, performance, security
audit, full Testing Standards coverage, pilot with 5–10 real merchants
and 50–100 real customers.

**Activities (no Spec-Kit features added; existing specs may be
amended)**:
- Performance: load test marketplace listing, search, checkout, payment
  webhooks. Identify and fix N+1 queries, missing indexes, slow
  endpoints.
- Security: full OWASP top-10 review, penetration test (external
  vendor), Supabase RLS audit, secret rotation, rate limiting on auth
  and payment endpoints.
- Observability: structured logging across all modules, error tracking
  (Sentry or similar), payment-flow alerting, uptime monitoring.
- Documentation: deployment runbook, on-call runbook, merchant docs,
  customer FAQs, internal API docs review.
- Pilot rollout: invite 5–10 merchants across launch markets, gather
  feedback, fix issues. Customer cohort small and watched closely.

**Exit criteria (gates)**:
- p95 latency targets met (TBD per spec — typically <200ms for product
  list, <500ms for checkout quote, <2s for payment intent creation).
- Penetration test report has no Critical or High findings open.
- 100% of constitution Testing Standards flows have automated coverage.
- Pilot merchants report no blocking issues for 7 consecutive days.

**Milestone**: **Closed Pilot Launch** — public-facing under invite-only
access.

---

## Phase 7 — Depth & Scale *(10–14 weeks)*  →  **Public GA**

**Goal**: Ship the remaining "Full Phase 1" scope items and remove the
invite gate.

**Spec-Kit features**: 029 `multi-warehouse`, 030
`purchase-orders-and-stock-ops`, 031 `payments-providers-v1.x`, 032
`carrier-integrations`, 033 `advanced-reports`.

**Deliverables**:
- Multi-warehouse: per-merchant warehouses, warehouse selection during
  fulfillment, stock transfers, audit.
- Purchase orders, damaged stock workflow, return restocking flows,
  stock-transfer workflows.
- Remaining payment gateways from the doc's 14 (Apple Pay, Google Pay,
  Samsung Pay, PayPal, HyperPay, PayTabs, MyFatoorah, Checkout.com, etc.
  — the ones not picked in Phase 4).
- Carrier API integrations: Aramex, SMSA, Bosta first; DHL/J&T as
  needed. Rate quotes, AWB generation, tracking webhooks. Shipping
  Agent role becomes meaningful here.
- Advanced reports: cohort/retention, GMV trends, country-specific
  tax/VAT exports (groundwork for ZATCA/ETA e-invoicing in a later
  phase), payout reconciliation views.

**Exit criteria (gates)**:
- A merchant can move stock between two of their warehouses; on-hand
  totals reconcile; ledger-style movement table is correct.
- A customer purchase routed to Aramex via API generates a valid AWB
  and the tracking webhook flows back to the customer notification.
- Each remaining gateway integration passes the same Testing Standards
  as the v1 gateways (live test purchase + refund + reconciliation).

**Milestone**: **Public GA** — invite gate removed, marketing campaign
ready, full v1 scope live.

---

## Phase 8 — Mobile App *(8–12 weeks; can parallel-start from Phase 6)*  →  **Mobile GA**

**Goal**: Flutter app reaching feature parity for customer flows.

**Spec-Kit features**: 034 `mobile-app-bootstrap` plus parity specs per
flow (auth, browse, cart, checkout, orders, profile, addresses,
wishlist, notifications).

**Deliverables**:
- Flutter app consuming the same versioned REST APIs (no mobile-only
  endpoints).
- Arabic/English with full RTL.
- Push notifications via FCM with the same templates as web.
- Deep links into product, store, order detail.
- Apple OAuth added (App Store guideline requirement once any social
  login is offered).

**Exit criteria (gates)**:
- TestFlight + Play Store internal track builds pass review with no
  blocking issues.
- All customer-side Testing Standards flows pass on the mobile app.
- Crash-free sessions ≥ 99% across 1k beta sessions.

**Milestone**: **Mobile GA** — apps in stores.

**Parallelization note**: Mobile bootstrap (auth + navigation + base
screens) can start during Phase 6 hardening using stable v1 APIs. Full
parity development overlaps with Phase 7. Mobile GA can land at or
shortly after Public GA if the team has dedicated mobile capacity.

---

## Cross-Phase Tracks (Continuous)

These run continuously, not as discrete phases:

- **Constitutional compliance**: every PR passes Constitution Check from
  Phase 0 onward.
- **Spec-Kit hygiene**: every feature has spec.md, plan.md, tasks.md
  before code starts. No exceptions.
- **Audit log + ledger discipline**: every sensitive operation writes
  to audit logs; every money movement writes to ledger. Reviewed in
  every code review starting Phase 1.
- **Tenant isolation tests**: added with every new tenant-scoped table
  starting Phase 1. Drift here is a release blocker.
- **i18n + RTL**: every new UI screen and DB field reviewed for
  translation completeness and RTL correctness from Phase 0 onward.
- **Documentation**: deployment runbook, API docs, merchant docs grow
  with each phase; not left to the end.

---

## Phase Decision Points (where to revisit scope)

Three natural points to reassess scope before continuing:

1. **End of Phase 3 (Internal Alpha 3)**: Decide whether to launch a
   COD-only soft launch in Egypt or KSA before Phase 4 finishes (faster
   feedback, real GMV, but no online payments).
2. **End of Phase 5 (Feature-Complete Beta)**: Decide whether to launch
   the **Closed Pilot** with v1 scope and defer Phase 7 to post-launch
   — common practice in marketplaces; avoids the "everything before
   launch" risk while still delivering most of the doc's promise.
3. **End of Phase 6 (Closed Pilot)**: Decide whether to go to Public
   GA before Phase 7 ships, treating Phase 7 as a v1.x rollout. This
   is the **strongly recommended** call for solo or small teams.

The user has chosen "Full Phase 1 before launch." That call holds
unless explicitly re-scoped at one of the decision points above.

---

## Tracking & Reporting

- Track phase status in a simple top-of-repo `STATUS.md` (created in
  Phase 0): current phase, exit criteria checklist, blockers, ETA.
- Each phase ends with a written **phase retrospective** (added under
  `docs/retros/phase-N.md`) covering: what shipped, what slipped,
  decisions deferred, scope adjustments, lessons.
- Constitution amendments only when a phase reveals a binding rule that
  no longer fits — never to relax discipline mid-phase.
