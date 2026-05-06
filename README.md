# VendorHub

Multi-vendor e-commerce platform.

## Quick Links

- [Local Quickstart](docs/quickstart-local.md)
- [Docker Quickstart](docs/quickstart-docker.md)
- [Architecture Overview](docs/architecture-overview.md)
- [How to Add a Module](docs/how-to-add-a-module.md)
- [Deployment Runbook](docs/deployment-runbook.md)
- [Folder Structure](docs/folder-structure.md)
- [API Docs](http://localhost:3000/api/docs) (when running locally)

## Monorepo Structure

```
apps/
  backend/        NestJS API
  dashboard/      Next.js admin/merchant dashboard
  website/        Next.js customer marketplace
  mobile/         Flutter (placeholder)
packages/
  config/         Shared configs (tsconfig, eslint, prettier, tailwind)
  types/          Cross-app TypeScript types
  shared/         Shared helpers and constants
  i18n/           Shared message catalogs (en/ar)
  api-client/     Typed fetch wrapper
```

## Getting Started

```bash
pnpm install
pnpm dev
```

See [docs/quickstart-local.md](docs/quickstart-local.md) for the full guide.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all unit/integration tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:a11y` | Run accessibility tests |
