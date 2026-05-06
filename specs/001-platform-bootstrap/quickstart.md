# Quickstart — Platform Foundation Bootstrap

**Audience**: an engineer with no prior context who needs to bring up
the system locally and verify it works.

**Time budget**: ≤ 90 minutes from a clean machine (per SC-001).

---

## Prerequisites

Install once on your machine:

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20 LTS | runtime for backend and Next.js apps |
| pnpm | ≥ 9.x | monorepo package manager |
| Docker Desktop | latest | containers for stack bring-up |
| Git | recent | source control |
| (optional) PowerShell 7 | recent | Spec-Kit scripts (Windows uses `powershell.exe`; macOS/Linux use `pwsh`) |

You will also need a **Supabase project** for development. Create one
at https://supabase.com (free tier is fine). From the project dashboard
collect:

- Project URL (`SUPABASE_URL`)
- anon key (`SUPABASE_ANON_KEY`)
- service role key (`SUPABASE_SERVICE_ROLE_KEY`)
- JWT secret (`SUPABASE_JWT_SECRET`)
- Database connection string (Supavisor or direct, both)

> **Security**: never commit any of these. Treat the service role key
> as you would a database root password.

---

## 1. Clone and install

```bash
git clone <repo-url> ecommerce_system
cd ecommerce_system
pnpm install
```

The pnpm workspace links `apps/backend`, `apps/dashboard`,
`apps/website`, and `packages/*` together. First install pulls every
dependency.

---

## 2. Configure environment variables

Each app reads a `.env` file. Copy the templates:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/website/.env.example apps/website/.env
```

Fill in the **backend** `.env` from your Supabase project values:

```ini
# apps/backend/.env

DATABASE_URL=postgresql://...        # Supabase Supavisor (pooled) URL
DIRECT_URL=postgresql://...          # Supabase direct URL (for migrations)
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # backend-only; NEVER ship to frontend
SUPABASE_JWT_SECRET=...
JWT_AUDIENCE=authenticated
APP_ENV=development
APP_PORT=3000
API_PREFIX=/api/v1
CORS_ORIGINS=http://localhost:3001,http://localhost:3002
JWKS_TTL_SECONDS=3600
JWKS_REFRESH_SECONDS=900
```

The **dashboard** and **website** `.env` files take only public values:

```ini
# apps/dashboard/.env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

(Same three for `apps/website/.env`.)

If any variable is missing or malformed, the backend will fail-fast at
boot with a consolidated list of offenders (per FR-CFG-001).

---

## 3. Run database migrations

From the backend app:

```bash
pnpm --filter @vendorhub/backend prisma migrate dev
pnpm --filter @vendorhub/backend prisma db seed
```

This creates the foundation tables (per `data-model.md`) and seeds:
- 8 roles (`super_admin` … `shipping_agent`)
- foundation permission catalog
- role → permission grants
- 3 tax classes
- 8 currencies (with `SAR` as default)
- starter platform-level ledger accounts

You can inspect the database via `pnpm --filter @vendorhub/backend prisma studio`.

---

## 4. Start the stack

### Option A — without Docker (fastest dev loop)

In three terminals:

```bash
# terminal 1 — backend
pnpm --filter @vendorhub/backend dev

# terminal 2 — dashboard
pnpm --filter @vendorhub/dashboard dev   # http://localhost:3001

# terminal 3 — website
pnpm --filter @vendorhub/website dev     # http://localhost:3002
```

### Option B — with Docker (closer to production)

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up
```

This brings up the backend, dashboard, website, and Nginx behind a
single entrypoint at `http://localhost:8080`.

---

## 5. Verify the foundation is healthy

### Backend health

```bash
curl -i http://localhost:3000/api/v1/health
```

Expect `200 OK` with the envelope:

```json
{
  "data": {
    "status": "ok",
    "version": "0.1.0+...",
    "uptime_seconds": 12,
    "dependencies": {
      "db": "healthy",
      "auth": "healthy",
      "storage": "healthy",
      "search": "unknown",
      "cache": "unknown"
    }
  },
  "meta": { ... }
}
```

### Swagger

Open http://localhost:3000/api/docs — every foundation endpoint is
listed with its DTOs, response shapes, and required permissions.

### `/api/v1/me` while unauthenticated

```bash
curl -i http://localhost:3000/api/v1/me
# Expect 401 with code AUTH.JWT_MISSING
```

### Dashboard

Open http://localhost:3001 (or http://localhost:8080/dashboard via
Nginx). You should see:
- the locale switcher (en / ar)
- both locales render correctly, with RTL flipping in Arabic
- attempting to navigate to a role-gated route while logged out
  redirects to login

### Customer site

Open http://localhost:3002 (or http://localhost:8080 via Nginx).
You should see:
- the home page placeholder
- en / ar toggle with RTL
- `/stores/example-slug` returns the placeholder store page (the
  slug routing is wired even though no store data exists yet)

---

## 6. Run the tests

```bash
pnpm test                                  # all unit + integration suites
pnpm --filter @vendorhub/backend test:e2e  # backend integration
pnpm --filter @vendorhub/dashboard test:e2e
pnpm --filter @vendorhub/website test:e2e
pnpm --filter @vendorhub/dashboard test:a11y
pnpm --filter @vendorhub/website test:a11y
pnpm lint
pnpm typecheck
```

All of the above MUST pass before opening a PR. The CI workflow runs
the same set plus a k6 baseline-load run against staging
(per research R3).

---

## 7. Optional — create your first user

In the Supabase dashboard, create a new auth user (email + password).
Then in `apps/backend/prisma/seed/local.ts` (your local override —
ignored by git), grant that user a Super Admin binding by inserting a
row into `user_roles` with `role.code = 'super_admin'`.

Or, simpler: log in via the dashboard's login form — the foundation
auto-provisions a Customer profile, and you can promote yourself to
Super Admin via the seed script.

---

## What you should NOT see

- No business endpoints (products, orders, payments, etc.). Those
  arrive in features 002+ per `docs/bootstrap-and-build-sequencing.md`.
- No SMS, WhatsApp, push, or email actually sending — provider
  abstractions exist but there are no live integrations.
- No Meilisearch or Redis containers running. Their compose entries
  exist but are commented; they are activated in the features that
  need them.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend exits immediately on start | Missing or malformed env vars | Re-check `apps/backend/.env`; the error message lists every offender. |
| `prisma migrate dev` fails with `P1000` | Wrong `DIRECT_URL` | Use the **direct** connection string (NOT the pooler) for migrations. |
| Dashboard 401 on every request | Stale Supabase session cookie | Log out and log back in; check that `NEXT_PUBLIC_SUPABASE_URL` matches the project the JWT came from. |
| Arabic page renders LTR | i18n middleware not running | Confirm `next-intl` middleware is registered; check the locale cookie / URL prefix. |
| `JWKS unreachable` warning in logs | Network glitch or Supabase outage | Refer to research R5 / R6; cached keys keep auth working briefly. |
| Health endpoint returns `degraded` with `db: unhealthy` | Postgres unreachable | Check `DATABASE_URL`; if Supabase is rate-limiting, wait or contact support. |

---

## Next steps

After Phase 0 is green, the next Spec-Kit features land per
`docs/bootstrap-and-build-sequencing.md`:

1. `002-audit-logs-and-settings` — full read/write surface and admin UI.
2. `003-currencies-and-tax-config` — per-merchant tax registration.
3. `004-financial-ledger-skeleton` — wire the LedgerService into a
   sample flow.
4. `005-auth-and-users` — full sign-in / sign-up / OAuth flows.
5. `006-roles-and-permissions` — admin UI to manage role bindings.

Each follows `/speckit.specify` → `/speckit.clarify` → `/speckit.plan`
→ `/speckit.tasks` → `/speckit.implement`.
