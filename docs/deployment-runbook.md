# Deployment Runbook

## Prerequisites
- Linux VPS with Docker and Docker Compose
- DNS configured for your domain
- Supabase project configured
- TLS certificates provisioned (Let's Encrypt or pre-issued)

## Secrets and Environment
- Inject secrets via environment files or your secret manager.
- Do not bake secrets into images.
- Frontend env vars must be `NEXT_PUBLIC_*` only.

## Bring-up Sequence
1. Pull repository and checkout release tag.
2. Set env files for backend/dashboard/website.
3. Start services:

```bash
docker compose -f docker/docker-compose.yml up -d
```

4. Run migrations:

```bash
pnpm --filter @vendorhub/backend prisma migrate deploy
```

## Smoke Tests
- `curl -i https://<domain>/api/v1/health`
- Open `https://<domain>/api/docs`
- Open dashboard and website in `en` and `ar` locales

## Rollback
- Revert to previous image tag and restart services.
- Roll back DB migration only when migration is backward-compatible.

## Manual Failover Procedure
- Restore latest backup on standby VPS.
- Re-point DNS to standby.
- Validate health endpoint and core pages.
- Target RTO <= 4h and RPO <= 24h.
