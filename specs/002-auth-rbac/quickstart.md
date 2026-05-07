# Quickstart — Phase 2 (Auth & RBAC)

**Audience**: backend / frontend developers bringing up the auth + RBAC
foundation locally and verifying it end-to-end.
**Assumes**: Phase 1 (`001-platform-bootstrap`) is already running locally —
Postgres reachable, Supabase project provisioned, monorepo bootstrapped.

If any "Assumes" item is not true, run the Phase 1 quickstart first
(`specs/001-platform-bootstrap/quickstart.md`).

---

## 1. Prerequisites

| Tool                 | Version             | Notes                                        |
|----------------------|---------------------|----------------------------------------------|
| Node.js              | 20 LTS              | matches Phase 1                              |
| pnpm                 | 9.x                 | repo uses `pnpm-workspace.yaml`              |
| Docker + Compose     | latest              | for local Postgres if not using hosted       |
| Supabase project     | dev / staging       | Auth enabled; JWKS endpoint reachable        |
| `psql`               | 15+                 | for ad-hoc DB inspection                     |

---

## 2. Environment variables (Phase 2 additions)

Add or confirm these in `apps/backend/.env` (and the deploy compose file):

```env
# Identity provider
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon key>                          # safe for frontends
SUPABASE_SERVICE_ROLE_KEY=<service role key>          # backend-only — NEVER ship
SUPABASE_JWKS_URL=https://<project>.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_ISSUER=https://<project>.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWT_CLOCK_SKEW_SECONDS=5

# Webhooks
SUPABASE_WEBHOOK_SECRET=<32+ char random>             # HMAC key used by Supabase

# Effective-permissions cache
AUTH_PERMISSIONS_CACHE_TTL_SECONDS=60
AUTH_PERMISSIONS_CACHE_MAX=10000

# Rate limits (per FR-048; all configurable)
RL_AUTH_SYNC_PER_MIN=10
RL_WEBHOOK_SUPABASE_PER_MIN=10
RL_WEBHOOK_PWD_RESET_PER_MIN=5
RL_ME_READ_PER_MIN=30
RL_ADMIN_WRITE_PER_MIN=20

# Bootstrap Super Admin (dev / staging only — not used in prod)
SUPERADMIN_EMAIL=admin@example.test
SUPERADMIN_SUPABASE_USER_ID=<uuid of admin@example.test in Supabase>
```

For `apps/dashboard/.env.local` and `apps/website/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=<same as backend SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as backend SUPABASE_ANON_KEY>
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

`SUPABASE_SERVICE_ROLE_KEY` MUST NOT appear anywhere in frontend env files. A
build-time check (added in Phase 2) fails the dashboard / website build if it
detects the variable.

---

## 3. Apply the migration & seed

```sh
cd apps/backend
pnpm prisma migrate deploy            # applies 002_auth_rbac
pnpm prisma generate                  # regenerates the Prisma client
pnpm ts-node prisma/seed.ts           # idempotent — re-run safely
```

Expected output (excerpt):

```
[seed] roles: upserted 8 (super_admin, platform_admin, merchant, merchant_staff,
        customer, support_agent, finance_admin, shipping_agent)
[seed] permissions: upserted 80 across 17 modules
[seed] role_permissions: reconciled (added X, removed 0 — never deletes
        custom additions)
[seed] super_admin: ensured for SUPERADMIN_EMAIL → user_roles row created
[seed] complete
```

---

## 4. Run the stack

```sh
# in three terminals
pnpm --filter @platform/backend dev
pnpm --filter @platform/dashboard dev
pnpm --filter @platform/website dev
```

Open Swagger: `http://localhost:3000/api/docs`. Confirm the new tags:
`Auth`, `Users`, `Roles`, `Permissions`, `Me`, `AuditLogs`, `Webhooks`.

---

## 5. Smoke test — Super Admin path

1. Sign in as `SUPERADMIN_EMAIL` on the dashboard
   (`http://localhost:3001/en/login`). Use Supabase Auth.
2. After redirect, the dashboard calls `POST /api/v1/auth/sync-profile`
   automatically. Verify in DB:
   ```sql
   SELECT id, email, status FROM users WHERE email = $SUPERADMIN_EMAIL;
   -- expect: 1 row, status = 'active'
   ```
3. The dashboard renders the Super Admin sidebar (full nav). Navigate to
   **Roles**. Confirm the 8 system roles show, marked "system".
4. Click **New Role**. Create `catalog_reviewer` with `products.manage.view`.
   Verify a `roles` row + `role_permissions` rows + an `audit_logs` row with
   `action_code = 'roles.created'`.
5. Open **Users**, find any user, assign them `catalog_reviewer`. Verify
   `user_roles` row + `user_access_scope` row (scopeType=`platform` since the
   role was unscoped) + an `audit_logs` row.
6. Switch the locale toggle to `ar`. Confirm the layout flips to RTL and all
   auth/admin labels are translated. No layout regressions.

---

## 6. Smoke test — Customer registration path

1. Open `http://localhost:3002/en/register`. Register a new customer.
2. Confirm Supabase sends a verification email; the dev environment can use
   Supabase's "Inbucket" inbox.
3. Before clicking the verification link, call `GET /api/v1/auth/me` with the
   user's JWT (use the dashboard dev tools or `curl`):
   ```sh
   curl -H "Authorization: Bearer <jwt>" http://localhost:3000/api/v1/auth/me
   ```
   Verify response: `data.user.status = 'pending_verification'`,
   `data.roles = [{ key: 'customer', ... }]`,
   `data.permissions` contains `users.profile.view` and `users.profile.update`.
4. Click the verification link. Within ~1 s the Supabase webhook hits
   `/api/v1/webhooks/supabase/auth`. Verify:
   ```sql
   SELECT status FROM users WHERE email = '<test-email>';
   -- expect: 'active'
   SELECT event_type, processed_at FROM webhook_events
     WHERE payload->>'email' = '<test-email>' ORDER BY received_at DESC LIMIT 1;
   -- expect: 'user.email_confirmed', processed_at NOT NULL
   SELECT action_code FROM audit_logs WHERE action_code = 'auth.profile.activated'
     ORDER BY occurred_at DESC LIMIT 1;
   -- expect: 1 row
   ```
5. Disable the webhook endpoint to test the lazy fallback (FR-005b):
   1. Stop the backend, set `SUPABASE_WEBHOOK_SECRET` to a wrong value, restart.
   2. Register a second customer.
   3. Verify their email in Supabase manually.
   4. Call `GET /auth/me` with their token. Verify status flips to `active`
      and an `auth.profile.activated` audit row is written by the lazy path
      (look for `metadata.source = 'lazy_reconcile'`).

---

## 7. Smoke test — Suspended/deleted blocking (FR-005)

```sh
# Find a real user id from `users`
USER_ID=...

# Suspend
curl -X PATCH -H "Authorization: Bearer <super-admin-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"status":"suspended","reason":"smoke test"}' \
     http://localhost:3000/api/v1/users/$USER_ID/status
```

Within 60 s (cache TTL), the user's calls to `GET /auth/me` MUST return 401
with code `AUTH/PROFILE_BLOCKED`. Cache invalidation should make this
near-instant; verify by hitting `/auth/me` from the user's session immediately
after the PATCH.

---

## 8. Smoke test — Cross-merchant isolation (SC-003)

This is the test in `apps/backend/test/integration/store-scope.spec.ts`. To
run manually:

```sh
cd apps/backend
pnpm test:e2e -- store-scope
```

Expected: every `@StoreScope`-annotated endpoint returns 403 when called by a
Merchant A staff member with a Merchant B id, and an audit row with
`action_code = 'authz.scope_denied'` is written for each attempt.

---

## 9. Smoke test — Audit log read

As a Super Admin (or any user with `audit_logs.view`):

```sh
curl -H "Authorization: Bearer <jwt>" \
     "http://localhost:3000/api/v1/audit-logs?action=roles.created&pageSize=5"
```

Expected: `data` is an array of audit rows, `meta.nextCursor` is either a
string or `null`. Try `GET /api/v1/audit-logs/<id>` for a single row.

---

## 10. Smoke test — Rate limiting (FR-048)

```sh
# Smash the per-IP bucket on sync-profile (default 10/min)
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://localhost:3000/api/v1/auth/sync-profile \
       -H "Authorization: Bearer <jwt>"
done
```

Expected: the first 10 return `200/201`, the next two return `429` with the
standard envelope and a `Retry-After` header.

---

## 11. What "done" looks like

- `prisma migrate deploy` produces no pending migrations.
- `pnpm test --filter @platform/backend` passes (unit + integration).
- `pnpm test --filter @platform/dashboard` passes (component + middleware).
- `pnpm test --filter @platform/website` passes.
- Swagger at `/api/docs` lists every endpoint in the contracts files with
  the documented request/response schemas, security schemes, and
  rate-limit `x-` extensions.
- Manual checklists in §5 through §10 all pass.

When all of the above are true, Phase 2 is shippable to staging and the
team can move to `/speckit.tasks` for the next feature.
