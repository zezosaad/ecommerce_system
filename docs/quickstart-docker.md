# Quickstart — Docker

## Prerequisites
- Docker Desktop / Docker Engine
- Valid `.env` files in `apps/backend`, `apps/dashboard`, `apps/website`

## Start

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d
```

## Verify
- Backend health: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/api/docs`
- Dashboard: `http://localhost:3001`
- Website: `http://localhost:3002`
- Nginx entrypoint: `http://localhost:8080`

## Stop

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml down
```
