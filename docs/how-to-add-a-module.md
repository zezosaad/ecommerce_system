# How To Add a Backend Module

This guide is the canonical flow for adding a new backend module that follows the foundation conventions.

## 1) Copy the template

- Copy `apps/backend/src/modules/_template/` to a new folder, e.g. `apps/backend/src/modules/products/`.
- Rename files and symbols:
  - `template.module.ts` -> `products.module.ts`
  - `template.controller.ts` -> `products.controller.ts`
  - `template.service.ts` -> `products.service.ts`
  - `template.repository.ts` -> `products.repository.ts`

## 2) Register the module

- Add the module import and registration in `apps/backend/src/app.module.ts`.
- Keep the layering: Controller -> Service -> Repository.

## 3) Add permissions and audit metadata

- Protect endpoints with `@Permissions('scope.resource.action')`.
- Add audit coverage with `@Audit({ action: 'scope.resource.action', severity: 'info' })`.
- Use `@StoreScope()` and tenant-aware repository helpers for tenant-scoped reads/writes.

## 4) Add DTOs with validation

- Create DTOs under your module folder and validate request payloads with class-validator.
- For localized fields, use `@IsTranslatable()` from `apps/backend/src/modules/common/i18n/translatable.ts`.

## 5) Add Prisma model and migration

- Add/extend entities in `apps/backend/prisma/schema.prisma`.
- Generate migration:

```bash
pnpm --filter @vendorhub/backend prisma migrate dev --name <migration_name>
```

## 6) Add tests

- Integration tests in `apps/backend/test/integration/` for endpoint behaviors.
- Unit tests in `apps/backend/test/unit/` for repository/service logic.
- Contract tests in `apps/backend/test/contract/` when the module introduces new API contracts.

## 7) Update docs/contracts

- Update OpenAPI files under `specs/001-platform-bootstrap/contracts/` (or the feature contract folder).
- Update architecture docs if new cross-cutting conventions are introduced.

## Checklist

- Endpoint returns standard envelopes.
- Auth + permissions are enforced.
- Tenant isolation rules are enforced in repositories.
- Audit metadata is declared and captured.
- DTO validation and error envelopes are consistent.
- Tests cover happy path + edge cases.
