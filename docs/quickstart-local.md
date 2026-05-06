# Quickstart — Local Development

**Audience**: an engineer with no prior context who needs to bring up the system locally.
**Time budget**: ≤ 90 minutes from a clean machine (per SC-001).

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20 LTS | runtime for backend and Next.js apps |
| pnpm | ≥ 9.x | monorepo package manager |
| Docker Desktop | latest | containers for stack bring-up |
| Git | recent | source control |

You will also need a **Supabase project** for development. Create one at https://supabase.com (free tier). Collect:

- Project URL (`SUPABASE_URL`)
- anon key (`SUPABASE_ANON_KEY`)
- service role key (`SUPABASE_SERVICE_ROLE_KEY`)
- JWT secret (`SUPABASE_JWT_SECRET`)
- Database connection string (pooled + direct)

## 1. Clone and Install

```bash
git clone <repo-url> ecommerce_system
cd ecommerce_system
pnpm install
```

## 2. Configure Environment Variables

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/website/.env.example apps/website/.env
```

Fill in `apps/backend/.env` with your Supabase project values. The dashboard and website only need public env vars.

## 3. Run Database Migrations

```bash
pnpm --filter @vendorhub/backend prisma migrate dev
pnpm --filter @vendorhub/backend prisma db seed
```

## 4. Start the Stack

### Option A — without Docker

```bash
# terminal 1
pnpm --filter @vendorhub/backend dev

# terminal 2
pnpm --filter @vendorhub/dashboard dev

# terminal 3
pnpm --filter @vendorhub/website dev
```

### Option B — with Docker

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up
```

## 5. Verify

- `curl http://localhost:3000/api/v1/health` → 200 OK
- http://localhost:3000/api/docs → Swagger UI
- http://localhost:3001 → Dashboard with locale switcher
- http://localhost:3002 → Website with locale switcher
- Arabic pages render RTL correctly

## 6. Run Tests

```bash
pnpm test
pnpm lint
pnpm typecheck
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend exits immediately | Check `apps/backend/.env` for missing variables |
| `prisma migrate dev` fails (P1000) | Use the **direct** connection string for `DIRECT_URL` |
| Arabic renders LTR | Verify next-intl middleware is running |
| Dashboard 401 on every request | Clear Supabase session cookie and re-login |
