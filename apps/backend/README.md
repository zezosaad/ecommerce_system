# Backend

NestJS API for VendorHub.

## Phase 2 Environment Variables

The following keys are required by the auth/rbac foundation.

| Key | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project base URL used by auth clients. |
| `SUPABASE_ANON_KEY` | Public anon key used for token/introspection paths. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only admin key for privileged Supabase operations. Never expose to frontend apps. |
| `SUPABASE_JWKS_URL` | Supabase JWKS endpoint used to fetch JWT verification keys. |
| `SUPABASE_JWT_ISSUER` | Expected JWT issuer (`iss`) for Supabase access tokens. |
| `SUPABASE_JWT_AUDIENCE` | Expected JWT audience (`aud`) for Supabase access tokens. |
| `SUPABASE_JWT_CLOCK_SKEW_SECONDS` | Allowed clock tolerance when validating `exp`/`iat`. |
| `SUPABASE_WEBHOOK_SECRET` | HMAC secret for validating Supabase webhook signatures. |
| `AUTH_PERMISSIONS_CACHE_TTL_SECONDS` | Effective-permissions cache TTL in seconds. |
| `AUTH_PERMISSIONS_CACHE_MAX` | Max entries held by effective-permissions cache. |
| `RL_AUTH_SYNC_PER_MIN` | Per-IP limit for `POST /api/v1/auth/sync-profile`. |
| `RL_WEBHOOK_SUPABASE_PER_MIN` | Per-IP limit for Supabase auth webhooks. |
| `RL_WEBHOOK_PWD_RESET_PER_MIN` | Per-IP limit for password-reset webhook events. |
| `RL_ME_READ_PER_MIN` | Per-user limit for `GET /auth/me` and `/me/*` reads. |
| `RL_ADMIN_WRITE_PER_MIN` | Per-user limit for admin writes (roles/permissions/user status). |
| `SUPERADMIN_EMAIL` | Dev/staging bootstrap email for initial super admin creation. |
| `SUPERADMIN_SUPABASE_USER_ID` | Supabase user UUID for the bootstrap super admin account. |
