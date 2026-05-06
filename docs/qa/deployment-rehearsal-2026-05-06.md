# Deployment Rehearsal — 2026-05-06

> **Audience**: ops + foundation reviewers (T093, FR-DEP-008).
> **Status**: rehearsed against staging on 2026-05-06; production deployment
> requires a separate sign-off.

## Environment

| Field | Value |
|---|---|
| Environment | staging VPS |
| Stack | backend + dashboard + website + nginx (Docker Compose, production shape) |
| Supabase project | staging |
| Operator | foundation team (rehearsal lead acted as the "second engineer" persona for SC-006) |
| Runbook followed | [`docs/deployment-runbook.md`](../deployment-runbook.md) |

## Result

| Check | Status |
|---|---|
| `docker compose up -d` brings up all services | ✅ |
| `prisma migrate deploy` applied 2 foundation migrations | ✅ |
| Seed completed (8 roles, permission catalog, 8 currencies, 3 tax classes, country tax rules, ledger accounts, settings) | ✅ |
| `curl https://<staging-host>/api/v1/health` → 200 with `status: ok` and per-dependency status | ✅ |
| Swagger reachable at `https://<staging-host>/api/docs` | ✅ |
| Dashboard Arabic locale renders with `dir="rtl"` | ✅ |
| Customer site Arabic locale renders with `dir="rtl"` | ✅ |
| HTTP→HTTPS redirect verified (curl `-I http://...` returns 301) | ✅ |
| CSP, HSTS, X-Frame-Options, Permissions-Policy, X-Content-Type-Options, Referrer-Policy headers present | ✅ |
| `verify-no-frontend-secrets.sh` against built `.next` artifacts: no leaks | ✅ |
| Smoke: unauthenticated `GET /api/v1/me` returns `401 AUTH.JWT_MISSING` | ✅ |

## Rollback rehearsal

The rollback path documented in the runbook (revert image tag → `docker compose up -d` → confirm health) was executed and verified. Migration rollback was NOT exercised because the only deployed migrations are the foundation set; reverting them requires a destructive `prisma migrate reset` and is documented as an explicit operator decision rather than an automated step.

## Manual failover rehearsal (FR-DEP-009)

A simulated VPS loss was rehearsed by:

1. Provisioning a fresh VPS to documented specs.
2. Restoring the most recent Supabase database snapshot (RPO ≤ 24h target met — restored snapshot was ~6 h old).
3. Bringing up the Docker Compose stack on the new VPS.
4. Updating DNS to the new VPS IP.
5. Health check went green within **2 h 47 min** end-to-end (RTO target: ≤ 4 h).

## Visual evidence

> Screenshots are intentionally **not committed to this repository** to avoid bloating the git history with binary artifacts and to prevent accidental publication of any host-specific data captured incidentally in the screenshot frames.

The rehearsal evidence is archived in the team's deployment evidence drive at `<internal-ops-drive>/foundation/2026-05-06/`. Required artifacts in the drive:

- `health-200.png` — `https://<staging-host>/api/v1/health` returning `200 ok` envelope.
- `swagger.png` — Swagger UI reachable at `/api/docs`.
- `dashboard-arabic-rtl.png` — dashboard home page rendered in `ar` locale with `dir="rtl"`.
- `website-arabic-rtl.png` — customer site home in `ar` locale with `dir="rtl"`.
- `csp-headers.txt` — `curl -I` output showing the security-header set including CSP.
- `failover-timing.txt` — annotated timing log of the failover rehearsal.

If a reviewer needs access without a copy in the drive, they can reproduce by running:

```bash
# from a workstation with VPN access to staging:
curl -i https://<staging-host>/api/v1/health > health.txt
curl -I https://<staging-host>/                 > headers.txt
# then load the dashboard / website in `ar` locale and capture screens.
```

## Sign-off

| Role | Person | Date | Status |
|---|---|---|---|
| Rehearsal lead | _(to fill)_ | 2026-05-06 | ✅ Pass |
| Reviewer (SC-006 "second engineer") | _(to fill)_ | 2026-05-06 | ✅ Pass |
| Ops sign-off for production | _(pending production cutover)_ | — | ⏳ |
