# Data Model — Platform Foundation Bootstrap

**Date**: 2026-05-06
**Spec**: [./spec.md](./spec.md)
**Research**: [./research.md](./research.md)
**Plan**: [./plan.md](./plan.md)

This document is the authoritative shape of the foundation tables. The
Prisma schema in `apps/backend/prisma/schema.prisma` MUST match this
document; any discrepancy is a defect.

All tables use English names and snake_case column names. Translatable
fields use JSONB with the shape `{ "ar": string, "en": string }` and a
class-validator rule requiring at least one non-empty value
(per research R4).

---

## Conventions

- Primary keys: `uuid` (Postgres `uuid`, generated via `gen_random_uuid()`).
- Timestamps: `timestamptz`, default `now()` on `created_at`. `updated_at`
  is updated on every UPDATE via Prisma's `@updatedAt`.
- Soft-delete: `deleted_at timestamptz null`. Default reads filter
  `deleted_at IS NULL` (research R10).
- Tenant scoping: tenant-scoped tables include `merchant_id uuid` and
  optionally `store_id uuid`. Foreign keys are enforced.
- Translatable JSONB columns are documented as `jsonb {ar,en}` with a
  shape constraint enforced at the application layer.
- Table names are plural, snake_case (`audit_logs`, `country_tax_rules`).
- Index naming: `<table>_<columns>_idx` (e.g., `audit_logs_actor_user_id_occurred_at_idx`).

---

## Entity relationship overview

```
auth.users (Supabase) ──┐
                        │  user_id (FK, unique)
                        ▼
                     users  ──┬── user_roles ──── roles ──── role_permissions ──── permissions
                              │
                              │
                              ▼
                          audit_logs (append-only)
                              │
                              ▼
                       idempotency_records (append-only, expires)

settings (key/value, scoped global or per-merchant)
currencies ── exchange_rates
tax_classes ── country_tax_rules
ledger_accounts ── ledger_entries (append-only, double-entry)
```

---

## Foundation Tables

### users

Mirrors a Supabase Auth user inside the application database.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | application identity |
| `supabase_user_id` | uuid UNIQUE NOT NULL | the immutable Supabase Auth user ID |
| `email` | text NOT NULL | mirrored from Supabase; updated on profile sync |
| `display_name` | text | optional |
| `avatar_url` | text | optional; Supabase Storage URL |
| `locale` | text NOT NULL DEFAULT `'en'` | one of `'en'`, `'ar'` |
| `phone` | text | optional |
| `is_active` | boolean NOT NULL DEFAULT `true` | |
| `last_seen_at` | timestamptz | updated on auth check |
| `created_at` | timestamptz NOT NULL DEFAULT `now()` | |
| `updated_at` | timestamptz NOT NULL | `@updatedAt` |
| `deleted_at` | timestamptz NULL | soft-delete |

**Indexes**:
- UNIQUE `users_supabase_user_id_key` on `supabase_user_id`
- UNIQUE `users_email_active_key` on `(email)` WHERE `deleted_at IS NULL`

**PII fields** (registered in `docs/privacy/pii-catalog.md`):
`email`, `display_name`, `avatar_url`, `phone`, `last_seen_at`.

---

### roles

Eight seeded roles per FR-AUTH-003. Read-mostly; only Super Admin can
edit assignments. Translatable label.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE NOT NULL | one of `super_admin`, `platform_admin`, `merchant_owner`, `merchant_staff`, `customer`, `support_agent`, `finance_admin`, `shipping_agent` |
| `label` | jsonb NOT NULL | `{ ar, en }` translatable |
| `description` | jsonb NULL | `{ ar, en }` |
| `is_system` | boolean NOT NULL DEFAULT `true` | system roles cannot be deleted |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

**Seed**: rows for all eight role codes.

---

### permissions

Permission catalog. Strings follow `<scope>.<resource>.<action>` per
research R1.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE NOT NULL | regex-validated: `^[a-z]+(\.[a-z_]+){2}$` plus the wildcard form `^[a-z]+\.[a-z_]+\.\*$` |
| `description` | jsonb NULL | `{ ar, en }` |
| `created_at` | timestamptz NOT NULL | |

**Seed (Phase 0 starter set, applied to roles below)**:
- `platform.settings.read`, `platform.settings.update`
- `platform.audit.read`
- `platform.users.read`
- `platform.roles.read`
- `platform.permissions.read`
- `platform.currencies.read`
- `platform.tax.read`
- `merchant.profile.read`
- `customer.profile.read`

Later modules (auth-and-users, merchants, products, etc.) add their
own permissions in their own migrations.

---

### role_permissions

Many-to-many between roles and permissions.

| Column | Type | Notes |
|---|---|---|
| `role_id` | uuid FK → roles.id | ON DELETE CASCADE |
| `permission_id` | uuid FK → permissions.id | ON DELETE RESTRICT |
| `created_at` | timestamptz NOT NULL | |

**PK**: composite `(role_id, permission_id)`.

**Seed (Phase 0)**:
- `super_admin` → all seeded permissions
- `platform_admin` → all `platform.*` reads
- `finance_admin` → `platform.audit.read`
- `support_agent` → `platform.audit.read`, `platform.users.read`
- `merchant_owner` → `merchant.profile.read`
- `merchant_staff` → `merchant.profile.read`
- `customer` → `customer.profile.read`
- `shipping_agent` → none in Phase 0

---

### user_roles

Attaches roles to user profiles. Optional tenant scoping for
Merchant Staff and Shipping Agent role bindings.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users.id NOT NULL | ON DELETE CASCADE |
| `role_id` | uuid FK → roles.id NOT NULL | ON DELETE RESTRICT |
| `merchant_id` | uuid NULL | scope; required for `merchant_owner`, `merchant_staff` |
| `store_id` | uuid NULL | scope; optional, finer than merchant |
| `granted_by_user_id` | uuid FK → users.id NULL | who granted; null if seeded by system |
| `granted_at` | timestamptz NOT NULL DEFAULT `now()` | |
| `revoked_at` | timestamptz NULL | revocation; soft-delete equivalent |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

**Indexes**:
- UNIQUE `(user_id, role_id, merchant_id, store_id)` WHERE
  `revoked_at IS NULL` — a user has at most one active binding per
  `(role, merchant, store)` tuple.
- `(merchant_id) WHERE revoked_at IS NULL` — for merchant-scoped lookups.
- `(user_id) WHERE revoked_at IS NULL` — for "what can this user do?"

**Validation rule** (application layer): if `role.code IN ('merchant_owner','merchant_staff')`, `merchant_id` MUST be non-null.

---

### audit_logs

Append-only audit record per research R2.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `occurred_at` | timestamptz NOT NULL DEFAULT `now()` | |
| `actor_user_id` | uuid NULL | null for system-initiated events |
| `actor_role_codes` | text[] NOT NULL DEFAULT `'{}'` | snapshot of roles at time of action |
| `action_code` | text NOT NULL | format `<scope>.<resource>.<verb>` (verb is past-tense) |
| `target_type` | text NULL | e.g., `User`, `Setting` |
| `target_id` | text NULL | string for non-uuid keys |
| `merchant_id` | uuid NULL | tenant scope |
| `store_id` | uuid NULL | tenant scope |
| `correlation_id` | text NOT NULL | mirrors `x-request-id` |
| `ip_address` | inet NULL | |
| `user_agent` | text NULL | truncated to 512 chars |
| `before` | jsonb NULL | pre-state snapshot |
| `after` | jsonb NULL | post-state snapshot |
| `metadata` | jsonb NULL | open bag |
| `severity` | text NOT NULL DEFAULT `'info'` | one of `info`, `warning`, `critical` |

**Indexes**:
- `(occurred_at DESC)`
- `(actor_user_id, occurred_at DESC)`
- `(merchant_id, occurred_at DESC)`
- `(target_type, target_id)`
- `(action_code)`

**Constraints**:
- No UPDATE or DELETE in normal operation. Application layer refuses
  both; database GRANTs further restrict to INSERT-only for the app
  user.
- No soft-delete column.

---

### settings

Key/value store for runtime-tunable configuration. Scope is either
**global** (`merchant_id IS NULL`) or **per-merchant**
(`merchant_id` set).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `key` | text NOT NULL | namespaced: `platform.<area>.<name>` or `merchant.<area>.<name>` |
| `merchant_id` | uuid NULL | NULL = global |
| `value` | jsonb NOT NULL | shape per setting |
| `is_secret` | boolean NOT NULL DEFAULT `false` | secret values redacted in audit `before`/`after` |
| `description` | jsonb NULL | `{ ar, en }` |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |
| `deleted_at` | timestamptz NULL | soft-delete |

**Indexes**:
- UNIQUE `(key, merchant_id)` — uniqueness within scope
- `(merchant_id)` for per-tenant queries

**Seed (Phase 0)**:
- `platform.foundation.version` → current Phase-0 build version
- `platform.cors.origins` → mirrors `CORS_ORIGINS` env (read-only
  display)

---

### currencies

ISO 4217 currency catalog.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE NOT NULL | ISO 4217, uppercase, length 3 |
| `name` | jsonb NOT NULL | `{ ar, en }` |
| `symbol` | text NOT NULL | e.g., `SAR`, `ر.س.`, `EGP`, `£` |
| `decimal_digits` | smallint NOT NULL DEFAULT `2` | |
| `is_default` | boolean NOT NULL DEFAULT `false` | exactly one row has true |
| `is_active` | boolean NOT NULL DEFAULT `true` | |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

**Constraints**: partial unique index on `is_default` WHERE `is_default = true` ensures only one default currency.

**Seed**: `SAR`, `AED`, `EGP`, `KWD`, `BHD`, `QAR`, `OMR`, `USD`. `SAR` flagged as default.

---

### exchange_rates

Currency-pair exchange rates. Foundation only seeds the schema; no
rates are populated in Phase 0.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `from_currency_code` | text FK → currencies.code NOT NULL | |
| `to_currency_code` | text FK → currencies.code NOT NULL | |
| `rate` | numeric(20,10) NOT NULL | rate from→to |
| `source` | text NOT NULL | e.g., `manual`, `xe`, `ecb` |
| `effective_at` | timestamptz NOT NULL | |
| `created_at` | timestamptz NOT NULL | |

**Indexes**: `(from_currency_code, to_currency_code, effective_at DESC)`.

---

### tax_classes

Logical groupings (e.g., "standard goods", "digital services",
"exempt").

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE NOT NULL | e.g., `standard`, `reduced`, `exempt` |
| `name` | jsonb NOT NULL | `{ ar, en }` |
| `description` | jsonb NULL | `{ ar, en }` |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

**Seed**: `standard`, `reduced`, `exempt`.

---

### country_tax_rules

Country × tax-class → rate + inclusivity policy.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `country_code` | text NOT NULL | ISO 3166-1 alpha-2 |
| `tax_class_id` | uuid FK → tax_classes.id NOT NULL | |
| `rate_percent` | numeric(6,3) NOT NULL | e.g., `15.000`, `5.000`, `14.000`, `0.000` |
| `is_inclusive` | boolean NOT NULL DEFAULT `false` | spec stores tax-exclusive prices; this flag remains for documentation/per-jurisdiction display only |
| `effective_from` | timestamptz NOT NULL | |
| `effective_to` | timestamptz NULL | open-ended if null |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

**Indexes**: UNIQUE `(country_code, tax_class_id, effective_from)`.

**Seed**: KSA standard 15%, UAE standard 5%, Egypt standard 14%, Kuwait standard 0%, Bahrain standard 10%, Qatar standard 0%, Oman standard 5%, USA standard `null` (out of scope of v1 — placeholder).

---

### ledger_accounts

Skeleton of the financial ledger. No flows wired in Phase 0.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE NOT NULL | account code, namespaced (e.g., `platform.cash`, `merchant.<merchantId>.payable`) |
| `name` | jsonb NOT NULL | `{ ar, en }` |
| `type` | text NOT NULL | one of `asset`, `liability`, `revenue`, `expense`, `equity` |
| `owner_kind` | text NOT NULL | one of `platform`, `merchant` |
| `owner_merchant_id` | uuid NULL | required when `owner_kind = 'merchant'` |
| `currency_code` | text FK → currencies.code NOT NULL | |
| `is_active` | boolean NOT NULL DEFAULT `true` | |
| `created_at` | timestamptz NOT NULL | |
| `updated_at` | timestamptz NOT NULL | |

**Seed (Phase 0)**: a small set of platform-level accounts so the
schema is exercised:
- `platform.cash.SAR`, `platform.cash.EGP` (assets)
- `platform.commission_revenue.SAR`, `platform.commission_revenue.EGP` (revenues)
- `platform.refunds.SAR`, `platform.refunds.EGP` (expenses)

---

### ledger_entries

Skeleton of double-entry rows. Append-only.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `transaction_id` | uuid NOT NULL | groups debits and credits of one logical transaction |
| `account_id` | uuid FK → ledger_accounts.id NOT NULL | |
| `direction` | text NOT NULL | one of `debit`, `credit` |
| `amount` | numeric(20,4) NOT NULL | positive |
| `currency_code` | text FK → currencies.code NOT NULL | |
| `description` | text NULL | |
| `correlation_id` | text NOT NULL | mirrors `x-request-id` |
| `metadata` | jsonb NULL | open bag |
| `occurred_at` | timestamptz NOT NULL DEFAULT `now()` | |
| `created_at` | timestamptz NOT NULL | |

**Indexes**:
- `(transaction_id)`
- `(account_id, occurred_at DESC)`
- `(occurred_at DESC)`

**Constraints**:
- No UPDATE or DELETE; same as audit_logs.
- Application-level invariant: for any `transaction_id`, the sum of
  debits equals the sum of credits per currency. Enforced via the
  `LedgerService.write(...)` API; direct INSERTs are forbidden by
  convention.

---

### idempotency_records

Per research R7. Stores request → response mappings to make
state-mutating endpoints replay-safe. No rows in Phase 0 because no
mutation endpoints exist; the table and service are exercised by
integration tests.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `actor_user_id` | uuid NULL | null for unauthenticated idempotent requests (rare) |
| `route` | text NOT NULL | normalized route string, e.g., `POST /api/v1/orders` |
| `idempotency_key` | text NOT NULL | client-supplied key |
| `body_hash` | text NOT NULL | SHA-256 over canonicalized JSON (RFC 8785) |
| `response_status` | int NOT NULL | HTTP status |
| `response_headers` | jsonb NOT NULL | a curated subset (Location, Content-Type, ...) |
| `response_body` | jsonb NOT NULL | full envelope as returned |
| `expires_at` | timestamptz NOT NULL | default `now() + 24h` |
| `created_at` | timestamptz NOT NULL | |

**Indexes**:
- UNIQUE `(actor_user_id, route, idempotency_key)` — replays match here
- `(expires_at)` for purge job

---

## Translatable JSONB shape (cross-cutting)

Wherever this document says `jsonb { ar, en }` the column stores:

```json
{ "ar": "string or empty", "en": "string or empty" }
```

The application-level validator enforces:

- The object is exactly an object with keys `ar` and `en` (extra keys
  rejected).
- Both values are strings.
- At least one of the two is non-empty (`length > 0` after trim).

The shared resolver (`packages/shared/translatable.ts`) provides:

```ts
resolveLocale(value: { ar: string; en: string }, locale: 'ar' | 'en', fallbacks?: ('ar'|'en')[]): string
```

Default fallback chain: `[locale, otherLocale]`. If both are empty,
returns an empty string; UI components MUST render the
"Translation missing" Empty state in that case.

---

## State transitions

Phase 0 entities have minimal state machines. The notable ones:

- **users**: `active → soft-deleted` (no hard delete in foundation).
- **user_roles**: `granted → revoked` (revocation is soft, preserves
  history; never hard-deleted).
- **settings**: free-form value updates; deletion is soft.
- **audit_logs / ledger_entries / idempotency_records**: terminal on
  insert.

Future entities (orders, sub-orders, payments) carry rich state
machines documented in their own data-model files.

---

## Tenant isolation matrix

| Table | Tenant column(s) | Notes |
|---|---|---|
| `users` | none (joined to merchants via `user_roles`) | per-user scope |
| `roles` | none | platform-global |
| `permissions` | none | platform-global |
| `role_permissions` | none | platform-global |
| `user_roles` | `merchant_id`, `store_id` (nullable) | scope of binding |
| `audit_logs` | `merchant_id`, `store_id` (nullable) | tenant-aware |
| `settings` | `merchant_id` (nullable, NULL = global) | global or per-merchant |
| `currencies` | none | platform-global |
| `exchange_rates` | none | platform-global |
| `tax_classes` | none | platform-global |
| `country_tax_rules` | none | platform-global |
| `ledger_accounts` | `owner_merchant_id` (nullable) | platform or per-merchant |
| `ledger_entries` | none directly; via `account.owner_merchant_id` | join-derived |
| `idempotency_records` | none directly; scoped by `actor_user_id` | per-actor |

The `TenantContext` type passed into repositories carries
`{ merchantId?, storeId?, isSuperAdmin: boolean }`. Repository helpers
refuse a query against a tenant-scoped table when a non-Super-Admin
context is missing the relevant scope.
