# Contracts — Platform Foundation Bootstrap

These artifacts define the API contract surface that the foundation
phase commits to. Every later module's contracts MUST conform to the
envelopes and error-code registry defined here.

| File | Purpose |
|---|---|
| `envelopes.md` | Standard success and error response envelopes |
| `error-codes.md` | Canonical error code registry (foundation-level codes) |
| `health.openapi.yaml` | `GET /api/v1/health` |
| `me.openapi.yaml` | `GET /api/v1/me` |
| `settings.openapi.yaml` | `GET /api/v1/settings`, `GET /api/v1/settings/:key` |

Other Phase-0 endpoints (`/roles`, `/permissions`, `/currencies`,
`/tax-classes`, `/country-tax-rules`) follow the same patterns and
will be added as part of `/speckit.tasks` if the team prefers
explicit OpenAPI specs over inferred-from-code Swagger. They are
omitted here to keep the foundation contract surface tight.

The authoritative runtime contract is the Swagger UI generated from
the NestJS code at `/api/docs`. These OpenAPI files exist to anchor
the **contract tests** and to give external consumers a stable
reference. Drift between code and these files is a defect.
