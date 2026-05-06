# Phase 0 Research — Platform Foundation Bootstrap

**Date**: 2026-05-06
**Spec**: [./spec.md](./spec.md)
**Plan**: [./plan.md](./plan.md)

This document resolves every NEEDS-CLARIFICATION-equivalent unknown in the
Technical Context and the deferred clarifications from the spec. Each
entry follows the **Decision / Rationale / Alternatives considered**
format.

---

## R1. Permission string naming convention

**Decision**: All permission strings use the format
**`<scope>.<resource>.<action>`**, lowercase ASCII, dots as separators.
Scope is one of: `platform`, `merchant`, `support`, `finance`, `shipping`,
`customer`. Resource and action are noun and verb in singular form.
Wildcard match `*` is supported only at the action segment for grants
that span all actions on a resource (e.g., `merchant.products.*`). No
wildcards at the scope or resource segment.

**Rationale**:
- The format is already used implicitly in the constitution, the spec
  examples (`merchant.products.create`, `platform.payments.configure`),
  and the build-sequencing doc — adopting it formally avoids any rename
  later.
- Hierarchical sorting matches mental model and makes admin UI grouping
  trivial.
- Glob-matching at the action segment (`merchant.products.*`) supports
  bulk grants without enabling overly broad grants at higher levels.
- Lowercase + dots is unambiguous, URL-safe, and consistent with common
  RBAC libraries.

**Alternatives considered**:
- `<resource>:<action>` without scope: rejected — relying on role
  context to imply scope makes shared permissions across scopes
  ambiguous (e.g., `products:read` differs heavily between platform
  and merchant).
- Colons (`<scope>:<resource>:<action>`): functionally equivalent;
  rejected purely for consistency with existing examples.
- Four-level format with mandatory sub-action: rejected as
  over-prescriptive; sub-actions can be encoded in resource or via
  permission combinations.

**Resulting commitments**:
- Permissions table holds `code` (unique) matching this format; a
  format check (regex) is enforced at insert.
- A starter permission catalog is seeded at migration time covering
  the foundation surface only (e.g., `platform.settings.read`,
  `platform.audit.read`, `platform.users.read`); other modules add
  permissions as they ship.
- The string registry / module is documented in
  `docs/how-to-add-a-module.md`.

---

## R2. Audit log payload shape

**Decision**: The `audit_logs` table has the following shape:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `occurred_at` | timestamptz | server time, default `now()` |
| `actor_user_id` | uuid (nullable) | null for system-initiated events |
| `actor_role_codes` | text[] | snapshot of roles at the moment of action |
| `action_code` | text | follows `<scope>.<resource>.<verb>` (same shape as permissions but verb may be past-tense, e.g., `merchant.product.created`) |
| `target_type` | text (nullable) | e.g., `User`, `Setting`, `Merchant` |
| `target_id` | text (nullable) | string to allow non-uuid keys |
| `merchant_id` | uuid (nullable) | tenant scope when applicable |
| `store_id` | uuid (nullable) | tenant scope when applicable |
| `correlation_id` | text | mirrors `x-request-id` |
| `ip_address` | inet (nullable) | redacted in logs but stored |
| `user_agent` | text (nullable) | truncated to 512 chars |
| `before` | jsonb (nullable) | pre-state snapshot for changes |
| `after` | jsonb (nullable) | post-state snapshot for changes |
| `metadata` | jsonb (nullable) | open bag for action-specific context |
| `severity` | text default `'info'` | one of `info`, `warning`, `critical` |

**Rationale**:
- Splitting `before`/`after` into discrete columns keeps diff
  generation cheap and makes targeted compliance queries possible.
- Snapshotting `actor_role_codes` (rather than only `actor_user_id`)
  preserves "what they could do at the time" even if their role set
  changes later — critical for audits and disputes.
- `correlation_id` lets a single user-facing failure be traced across
  audit, ledger, logs, and traces.
- `severity` lets dashboards filter without inspecting `action_code`.
- Tenant columns enable tenant-scoped audit views without a JOIN to
  the target entity.

**Alternatives considered**:
- Single `payload jsonb` with everything inside: rejected — too easy
  to drift across modules; harder to index.
- Append-only event log with a separate "snapshot" model: rejected —
  more infrastructure than a foundation phase needs; revisit if
  compliance demands an immutable hash chain.
- Storing role IDs instead of codes: rejected — codes are stable;
  IDs may change if the seed roles are re-imported.

**Resulting commitments**:
- `audit_logs` is **append-only**: no UPDATE or DELETE in normal
  operation; soft-delete column is intentionally absent.
- Index plan: `(occurred_at desc)`, `(actor_user_id, occurred_at desc)`,
  `(merchant_id, occurred_at desc)`, `(target_type, target_id)`,
  `(action_code)`. Covered in `data-model.md`.

---

## R3. Baseline load definition for SC-011 / SC-012

**Decision**: The "documented baseline load" against which p95
thresholds are measured is:

- **Sustained load**: 50 RPS for 10 minutes against the deployed
  staging environment, of which 80% are read endpoints
  (`GET /api/v1/me`, `GET /api/v1/health`, `GET /api/v1/settings/:key`,
  `GET /api/v1/currencies`) and 20% are write endpoints
  (none in Phase 0; the test reserves capacity for future writes
  by hitting permission-gated reads with cache-busting params).
- **Peak load**: 100 RPS for 1 minute (burst), same mix.
- **Concurrency**: 50 simultaneous virtual users at sustained,
  100 at peak.

The CI load test (`/.github/workflows/load-test.yml`) runs this
profile against staging on every release-candidate PR and on a
nightly schedule. It uses **k6** as the load tool. Failure to meet
the p95 thresholds blocks merge.

**Rationale**:
- 50 RPS sustained / 100 RPS peak comfortably matches Phase 0 traffic
  expectations on a single VPS while leaving headroom.
- A 10-minute sustained run is long enough to expose connection-pool
  sizing or memory leaks; a 1-minute peak is enough to expose burst
  failures without burning CI budget.
- 80/20 read/write mix mirrors the expected steady-state shape of an
  e-commerce marketplace once business endpoints arrive.
- k6 has first-class JS scripting, runs in Docker, integrates cleanly
  with CI, and emits useful percentile reports.

**Alternatives considered**:
- "Best-effort load test" with no fixed numbers: rejected — turns
  SC-011 into a non-test.
- A more aggressive baseline (e.g., 500 RPS): rejected — premature for
  Phase 0 and would force early caching/tuning that doesn't fit the
  bootstrap budget.
- Locust or JMeter instead of k6: rejected — k6's authoring DX is
  better and its CI fit is cleaner.

**Resulting commitments**:
- `apps/backend/test/load/` holds the k6 scripts.
- The CI workflow runs against the staging environment, never against
  production.
- Phase 6 hardening will revisit the numbers and may scale them up.

---

## R4. Translation fallback policy

**Decision**: When a translatable JSONB field is read and the
requested locale's value is missing or empty:

1. The API **returns the full JSONB object as-is** (`{ ar, en }`),
   never collapsing to a single string. The frontend chooses what to
   display.
2. The frontend's resolver picks the requested locale; if it is empty,
   it falls back to the other supported locale; if both are empty, it
   renders an explicit "Translation missing" placeholder (Empty state)
   with a help link to the merchant dashboard's Edit Translations
   page.
3. List endpoints accept an optional `?locale=ar|en` query parameter;
   when provided, the server includes a computed `displayName` (or
   equivalent) per row alongside the raw JSONB, applying the same
   fallback chain server-side. This is a convenience for SSR pages
   that don't want to run the resolver themselves.
4. Validation: at least one of `ar` or `en` MUST be non-empty when an
   entity that uses translatable fields is created or updated;
   enforcement is a class-validator rule applied to the translatable
   helper introduced in FR-I18N-002.

**Rationale**:
- Returning the full JSONB keeps the server stateless about the
  caller's UX preferences and lets the frontend handle the
  "missing translation" experience consistently.
- Forcing at-least-one non-empty value prevents silent gaps from
  reaching the storefront.
- The optional `?locale=` server-side resolver supports SSR/SEO
  without forcing every consumer to implement the same logic.
- The dashboard Empty-state placeholder makes the gap visible to
  merchants rather than hiding it.

**Alternatives considered**:
- Return only the requested locale (collapse to string): rejected —
  loses ground truth and breaks merchant editing.
- Always require both locales at write time (no fallback): rejected
  — common merchants will produce content in one language first; a
  hard requirement blocks legitimate workflows.
- Auto-translate via a third-party service when missing: rejected —
  out of scope for v1; quality and cost concerns.

**Resulting commitments**:
- `packages/shared/translatable.ts` exposes a `resolveLocale(value, locale, fallbacks)` helper used by both frontends.
- The DTO base class for translatable fields enforces "at least one non-empty".

---

## R5. Supabase outage degradation policy

**Decision**:

- **Database outage** (Supabase Postgres unreachable):
  - Any endpoint that requires DB access returns `503 Service
    Unavailable` with the standard envelope and error code
    `SERVICE_UNAVAILABLE_DB`.
  - The health endpoint reports `status: degraded` and
    `dependencies.db: unhealthy`.
  - Frontends detect 503 + `SERVICE_UNAVAILABLE_*` and render a
    full-page maintenance state with a localized message.
  - The backend retries with exponential backoff at a connection-
    pool level for transient errors; only sustained failures
    surface to the client.

- **Auth outage** (Supabase Auth / JWKS endpoint unreachable):
  - JWKS keys are cached in-memory with the policy below (see R6);
    cached keys are honored even if JWKS is briefly unreachable.
  - If a token verification requires a fresh JWKS fetch and the
    fetch fails, the request returns `503` with code
    `SERVICE_UNAVAILABLE_AUTH`.
  - Existing-session reads with already-cached keys keep working.
  - Health reports `dependencies.auth: degraded` if the last JWKS
    fetch attempt failed but cached keys are still valid; reports
    `unhealthy` only when cached keys have expired and refresh
    fails.

- **Storage outage** (no storage usage in Phase 0): foundation
  contract states future media-uploading endpoints MUST handle a
  `SERVICE_UNAVAILABLE_STORAGE` envelope; not exercised in this
  phase.

**Rationale**:
- Returning a structured envelope lets frontends route to a
  dedicated maintenance UI rather than guessing at random failures.
- Honoring cached JWKS during a brief Supabase Auth blip preserves
  uptime; refusing only when both fetch fails AND cache has expired
  prevents a stale-key window.
- A separate `degraded` status (vs `unhealthy`) gives ops a useful
  intermediate signal.

**Alternatives considered**:
- Read-only mode with served-from-cache responses: rejected —
  premature for Phase 0; we have nothing meaningful to cache yet.
- Hard 500 errors on dependency outage: rejected — provides no
  signal for the client to differentiate maintenance from bugs.

**Resulting commitments**:
- Error code registry (in `contracts/error-codes.md`) includes
  `SERVICE_UNAVAILABLE_DB`, `SERVICE_UNAVAILABLE_AUTH`,
  `SERVICE_UNAVAILABLE_STORAGE`.
- Health endpoint contract includes the per-dependency states and
  the `status: ok | degraded | unhealthy` triple.

---

## R6. JWKS verification cache strategy

**Decision**:
- The backend fetches Supabase JWKS at boot and caches keys
  in-memory with a **TTL of 1 hour**.
- Background refresh runs every **15 minutes**; refresh failures do
  NOT clear the cache.
- A token whose `kid` is not in cache triggers a single
  out-of-schedule JWKS fetch (with 1-second timeout); failure causes
  `503 SERVICE_UNAVAILABLE_AUTH` per R5.
- A fixed-window rate limit prevents stampedes on simultaneous
  unknown-`kid` events.

**Rationale**: Balances freshness (key rotations propagate within
~15 min) against availability (cached keys survive transient
outages). Out-of-schedule fetch supports legitimate key rotation
without frequent cache misses.

**Alternatives considered**:
- TTL of 5 minutes: rejected as too chatty.
- Boot-time fetch only: rejected — would block on long uptimes if
  keys rotate.

**Resulting commitments**: `apps/backend/src/modules/supabase/jwks-cache.service.ts` owns this; configuration knobs (`JWKS_TTL_SECONDS`,
`JWKS_REFRESH_SECONDS`) added to env schema with the values above as
defaults.

---

## R7. Idempotency-Key body-hash algorithm and TTL

**Decision**:
- Body hash: **SHA-256 over the canonicalized JSON** (sorted keys,
  Unicode-NFC normalized strings, no insignificant whitespace,
  deterministic number formatting per RFC 8785 / JCS).
- Stored key: `(actor_user_id, route, idempotency_key, body_hash)`.
- TTL: **24 hours** by default; per-endpoint override allowed via
  the `@Idempotent({ ttlSeconds })` decorator.
- Storage: a `idempotency_records` table (added to data-model.md,
  see Foundation Tables) with `request_hash`, `response_status`,
  `response_body`, `response_headers`, `expires_at`. A background
  job purges expired rows daily.

**Rationale**: SHA-256 over canonicalized JSON is the de-facto
standard for idempotent request matching. 24 hours is long enough to
cover network retries and short outages without bloating the table.

**Alternatives considered**:
- Hashing raw bytes: rejected — different serializations of the
  same logical body would mismatch.
- Storing in Redis only: rejected — Redis isn't deployed in Phase 0;
  Postgres works for the modest Phase-0 idempotency volume; revisit
  in Phase 4 when payments arrive.

---

## R8. i18n routing pattern

**Decision**: **Sub-path routing** (`/en/...`, `/ar/...`) for both
the dashboard and the customer website, with a **default-locale
prefix-stripped variant** (`/...` → `en` by default) for SEO
canonicalization. The customer site emits proper `hreflang` tags
linking the two locale variants.

**Rationale**:
- Sub-paths give Google distinct indexable URLs per locale, which
  matters for the customer-facing marketplace.
- next-intl's middleware supports this with built-in locale detection
  and persistence; no custom router work needed.
- A persistent locale cookie still drives the in-session preference,
  but URL is canonical for sharing and SEO.

**Alternatives considered**:
- Cookie-only with one URL: rejected — bad for SEO; sharing a URL
  between Arabic and English speakers loses context.
- Sub-domain (`ar.example.com`): rejected — operational complexity
  (separate certs, separate analytics) without enough benefit.

---

## R9. CSP and security headers baseline

**Decision**: Nginx applies the following headers globally to both
Next.js apps and the backend (where appropriate):

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(self)`
- `X-Frame-Options: DENY` (the dashboard); `SAMEORIGIN` is acceptable
  for the customer site embed flows in later phases.
- **CSP** (Next.js apps): `default-src 'self'; script-src 'self' 'nonce-<runtime>'; img-src 'self' data: https://<supabase-storage-host>; connect-src 'self' https://<supabase-host>; style-src 'self' 'unsafe-inline'; font-src 'self' data:`
- **CSP** (backend): `default-src 'none'` (the backend serves no
  HTML beyond Swagger; Swagger is restricted by IP/auth in production).

**Rationale**: A strict baseline reduces XSS blast radius and
clickjacking risk. Nonce-based script CSP is the modern Next.js
recommendation.

**Alternatives considered**: Skipping CSP in v1: rejected — much
cheaper to ship right than to retrofit later.

---

## R10. Soft-delete query convention

**Decision**:
- Soft-deleted entities: `users`, `merchants`, `stores`, `products`,
  `orders` (all when those tables arrive), and any other table
  representing business or compliance state. Audit logs and ledger
  entries are **append-only** with no soft-delete column.
- Implementation: each `PrismaService` exposes a `softReads` helper
  that builds queries with a default `deletedAt: null` filter. Every
  repository function defaults to `softReads`. Bypass requires an
  explicit `{ includeDeleted: true }` argument that is itself audit-
  logged.
- Prisma middleware was considered but rejected (see alternatives).

**Rationale**:
- Explicit helper keeps the soft-delete behavior visible at every
  call site; new engineers won't be surprised by hidden middleware.
- Bypass requires explicit opt-in + audit log, which prevents
  accidental leakage.

**Alternatives considered**:
- Prisma client middleware (`$use`): historically the easy path but
  Prisma is moving away from it (deprecated in v5.x). Rejected.
- Database views to hide soft-deleted rows: rejected — would
  force every read through views and complicate joins.

---

## Cross-cutting consequences for data-model.md and contracts/

The decisions above shape the data model and contracts:

- `audit_logs` table shape per R2.
- `permissions.code` regex constraint per R1.
- `idempotency_records` table per R7 (new foundation table — added
  to the spec via this research finding; data-model.md reflects it).
- Health endpoint response shape per R5.
- Error code registry includes the new `SERVICE_UNAVAILABLE_*` codes
  and the existing envelope codes from FR-BACK-008.
- Translatable fields: validators enforce "at least one non-empty"
  per R4.
- Soft-delete column applied to the foundation tables per R10
  (none of the foundation entities except `users` actually need it
  in Phase 0; the convention is established for later phases).

---

## NEEDS-CLARIFICATION items remaining

**None.** All deferred clarifications and technical unknowns are
resolved above. Phase 1 design proceeds.
