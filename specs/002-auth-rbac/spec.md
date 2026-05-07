# Feature Specification: Authentication, Users, Roles & Permissions Foundation

**Feature Branch**: `002-auth-rbac`
**Created**: 2026-05-07
**Status**: Draft
**Input**: User description: "Phase 2 — authentication, users, roles, permissions, and access-control foundation for the multi-vendor marketplace platform."

## Overview

This feature establishes the identity and access-control backbone for the marketplace. It links the external identity provider (Supabase Auth) to an application-level user profile, defines the role and permission model that every later phase will rely on, and ships the guards, decorators, and APIs needed to protect business endpoints.

The marketplace is **not** a Shopify-style site builder. There is one customer-facing storefront where the platform itself and approved merchants both sell. Each merchant has a back-office dashboard scoped to their own data; customers browse all merchants in one catalog and can filter by store. The access-control model defined here must enforce that separation from day one, even though merchant onboarding, products, orders, payments, and shipping are out of scope for this phase.

## Clarifications

### Session 2026-05-07

- Q: Can a single identity hold both a `customer` role and one or more non-customer roles, and how is dashboard access decided when both are present? → A: One identity may hold any combination of roles. Dashboard access is granted when the user has at least one non-customer role; the customer-site account area is always accessible to any authenticated user who holds the `customer` role.
- Q: What flips a self-registered customer's status from `pending_verification` to `active`? → A: A Supabase Auth webhook (email-confirmed event) hits a backend endpoint that updates the profile and writes an audit entry. If the webhook is missed, the user's next authenticated request reconciles status by re-reading Supabase's `email_confirmed_at` field.
- Q: Does Phase 2 ship audit-log read APIs, and what shape? → A: Yes. Ship `GET /api/v1/audit-logs` (paginated, filterable by actor, action, entity type, entity id, and date range) and `GET /api/v1/audit-logs/:id`, both gated by the `audit_logs.view` permission. No update/delete endpoints.
- Q: What are the concrete rate-limit thresholds for auth-sensitive endpoints? → A: Standard split — per-IP 10/min on `sync-profile` and Supabase webhook handlers; per-user 30/min on `me` and self-introspection endpoints; per-user 20/min on role/permission/user-status write operations; per-IP 5/min on the password-reset webhook handler.
- Q: What is the audit-log retention commitment in Phase 2? → A: Minimum 1 year. Phase 2 retains every audit-log entry for at least 1 year; entries older than 1 year become eligible for a future purge/archival job (the job itself is out of scope for Phase 2).

## Goals

1. Provide a single, trusted source of truth for "who is this caller?" across every backend surface.
2. Separate the identity record (Supabase) from the application profile so the platform owns its own user data, status, and lifecycle.
3. Define a role/permission model that scales from the Super Admin down to individual merchant staff, with merchant- and store-level scoping ready before merchant onboarding ships.
4. Ship reusable guards, decorators, and APIs so every later module ("products", "orders", "payouts", etc.) only has to declare its access rules, not re-implement them.
5. Make the dashboard and customer website auth-ready in both Arabic and English (RTL/LTR), with role-driven navigation and protected routes.
6. Establish an immutable audit trail for sensitive identity and access-control actions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Authenticated profile sync and `me` endpoint (Priority: P1)

A user signs up or logs in through Supabase Auth on either the dashboard or the customer website. On their first authenticated call, the backend either finds the matching application profile or creates a new one in `pending_verification` (customer) or `active` (admin-provisioned) state, attaches their roles, permissions, and access scope, and returns the full identity envelope. Every subsequent protected request resolves the same envelope from the JWT.

**Why this priority**: Nothing else in the platform — products, orders, payouts, dashboards — can be built without a reliable, single way to answer "who is calling and what may they do?" This is the MVP slice that unblocks every later phase.

**Independent Test**: With Supabase Auth and the database in place, a user can register, obtain a JWT, call `GET /api/v1/auth/me`, and receive their profile + roles + permissions + scope. Suspended/deleted users calling the same endpoint are rejected. This can be validated end-to-end without any business module existing.

**Acceptance Scenarios**:

1. **Given** a Supabase-authenticated user with no application profile, **When** they call any protected endpoint or `POST /api/v1/auth/sync-profile`, **Then** the system creates an application profile linked to their Supabase user id and returns the new profile.
2. **Given** an active user with at least one role, **When** they call `GET /api/v1/auth/me`, **Then** they receive their profile, assigned roles, effective permissions, and merchant/store access scope in one response.
3. **Given** a user whose status is `suspended` or `deleted`, **When** they call any protected endpoint, **Then** the request is rejected with an authorization error and an audit log entry is recorded.
4. **Given** a request with a missing, malformed, or expired Supabase JWT, **When** it hits a protected endpoint, **Then** the request is rejected with a 401 and no profile lookup occurs.

---

### User Story 2 — Role and permission management by Super Admin (Priority: P1)

A Super Admin can list, create, update, and delete custom roles, browse the full permission catalog, and assign roles to users (optionally scoped to a merchant or store). System roles (Super Admin, Customer, Merchant, etc.) are protected from destructive edits.

**Why this priority**: Without it, the seeded roles are the only available access tier and there is no way to onboard real platform staff or recover from misconfiguration. Required before any human can be granted least-privilege access.

**Independent Test**: A Super Admin signs in, opens the Roles & Permissions screens, creates a "Catalog Reviewer" role, assigns it the `products.manage.view` permission, attaches it to a user, and that user immediately sees the right effective permissions on `GET /api/v1/me/permissions`. Attempting to delete the `super_admin` role is refused.

**Acceptance Scenarios**:

1. **Given** a Super Admin, **When** they create a role with a unique key and assign permissions, **Then** the role is persisted, audit-logged, and returned in `GET /api/v1/roles`.
2. **Given** any actor, **When** they attempt to delete a role marked `isSystem = true`, **Then** the request is rejected.
3. **Given** the only remaining Super Admin user, **When** an actor attempts to remove that user's last `super_admin` role assignment, **Then** the request is rejected to prevent platform lock-out.
4. **Given** a non-admin user, **When** they call any role/permission management endpoint, **Then** the request is rejected with 403.
5. **Given** a permission change to a role, **When** an affected user re-fetches `GET /api/v1/auth/me`, **Then** their effective permissions reflect the change without re-login.

---

### User Story 3 — Guard-protected endpoints with role, permission, and scope checks (Priority: P1)

Backend developers can mark any endpoint with `@Public`, `@Roles(...)`, `@Permissions(...)`, or `@StoreScope(...)` and trust that the guards will enforce JWT validity, active-user status, role membership, permission match, and merchant/store ownership in that order, returning consistent error envelopes.

**Why this priority**: This is the contract every later module depends on. Without a single, correct enforcement pipeline, each module would re-implement auth and the platform would leak data across merchants.

**Independent Test**: Sample protected, role-restricted, permission-restricted, and store-scoped endpoints can be hit by users with each role. Authorized callers succeed, unauthorized callers receive 401/403 with a consistent error shape, and blocked attempts are audit-logged where useful.

**Acceptance Scenarios**:

1. **Given** an endpoint annotated `@Public`, **When** an unauthenticated request arrives, **Then** it is processed normally.
2. **Given** an endpoint annotated `@Permissions('orders.manage.view')`, **When** an authenticated user without that permission calls it, **Then** the request is rejected with 403.
3. **Given** an endpoint annotated `@StoreScope`, **When** a Merchant Staff user from store A targets a resource in store B, **Then** the request is rejected with 403 and an audit entry is recorded.
4. **Given** an endpoint annotated `@Roles('super_admin')`, **When** a Platform Admin (without the `super_admin` role) calls it, **Then** the request is rejected with 403.
5. **Given** an `@OptionalAuth` endpoint, **When** an unauthenticated request arrives, **Then** it is processed and `currentUser` is `null`; when an authenticated request arrives, `currentUser` is populated.

---

### User Story 4 — Dashboard auth (login, role-based nav, protected routes) (Priority: P2)

Internal users (Super Admin, Platform Admin, Finance Admin, Support Agent, Shipping Agent, Merchant, Merchant Staff) sign in to the dashboard, see only the navigation, sections, and action buttons that match their effective permissions, and are redirected to an "Unauthorized" or "Suspended" page when the rules say no. The dashboard is fully usable in both Arabic (RTL) and English (LTR).

**Why this priority**: Once the backend can enforce access (Stories 1–3), the dashboard becomes the primary surface for human operators. It is needed before merchant onboarding (Phase 3) can begin.

**Independent Test**: Each role can sign in and see exactly the menu items and pages enabled for them; a Customer cannot reach the dashboard at all; a suspended account sees the suspended-state screen; toggling language flips the layout to RTL with translated copy.

**Acceptance Scenarios**:

1. **Given** a signed-in Merchant user, **When** the dashboard renders, **Then** only merchant-scoped sections appear in the sidebar.
2. **Given** a signed-in Customer who navigates to the dashboard URL, **When** the route resolves, **Then** they are redirected away from the dashboard with an "unauthorized" message.
3. **Given** a user whose permissions are missing for a button on a page they can otherwise see, **When** the page renders, **Then** the button is hidden or disabled, and the corresponding backend call (if forced) is rejected by the server.
4. **Given** the dashboard loads before the auth state resolves, **When** the page paints, **Then** a loading state is shown — never a flash of authorized content.
5. **Given** a user switches the UI language to Arabic, **When** the dashboard re-renders, **Then** layout is right-to-left and all auth-related copy is translated.

---

### User Story 5 — Customer website auth-ready flows (Priority: P2)

Marketplace visitors can browse public catalog pages without logging in. They can register, log in, log out, and reset their password. Once logged in, they can access an "account" area that is auth-protected, scoped strictly to their own data, and that blocks any attempt to reach dashboard URLs.

**Why this priority**: Phase 3+ (cart, checkout, orders) depends on this layer existing and being secure. The browsing experience itself must keep working anonymously.

**Independent Test**: An anonymous visitor can browse public pages; the same visitor can register, receive a session, see an account layout, log out, and reset their password. Attempting to load the dashboard from a customer session is denied.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor, **When** they browse public catalog pages, **Then** no authentication is required and no PII is requested.
2. **Given** a new visitor, **When** they register and confirm their account, **Then** an application profile in the appropriate state is created, the `customer` role is assigned, and they are signed in.
3. **Given** a logged-in customer, **When** they request password reset, **Then** Supabase Auth handles the reset flow and the application profile is unaffected except for an audit entry on next sync.
4. **Given** a logged-in customer, **When** they try to navigate to a dashboard URL, **Then** they are blocked.

---

### User Story 6 — Audit trail for sensitive identity actions (Priority: P3)

Every sensitive identity or access-control event (profile created, status changed, role created/updated/deleted, permission assigned/removed, role assigned/removed from user, login profile sync, blocked unauthorized attempt) is recorded in an immutable audit log capturing the actor, action, target entity, metadata, IP address, and user agent. A Super Admin can browse the log.

**Why this priority**: Required for compliance reviews and incident response, but not blocking for the first usable iteration of the platform.

**Independent Test**: Perform a representative set of sensitive actions and confirm one corresponding row per action exists with all required fields. A Super Admin can list and filter the entries via `GET /api/v1/audit-logs` and fetch a single one via `GET /api/v1/audit-logs/:id`. Confirm the audit log cannot be edited or deleted through the application APIs. Confirm no secrets or tokens appear in any log row.

**Acceptance Scenarios**:

1. **Given** a Super Admin assigns a role to a user, **When** the action completes, **Then** an audit entry exists with actor, action key, target user id, role id, IP, and user agent.
2. **Given** a blocked unauthorized access attempt at a sensitive endpoint, **When** it is rejected, **Then** an audit entry is created (no JWT contents recorded).
3. **Given** any actor, **When** they call any update or delete operation against the audit log, **Then** the request is rejected.

---

### Edge Cases

- **Auth token problems**: missing, malformed, or expired Supabase JWT → 401 before any DB lookup.
- **Identity vs profile mismatch**: Supabase user exists but no application profile yet → `sync-profile` creates one; protected business endpoints (other than the sync endpoint itself) reject until profile exists.
- **Profile but no role**: application profile exists with zero role assignments → access limited to `me`-style endpoints; all permission-gated endpoints reject.
- **Multiple roles per user**: effective permission set is the union; conflicting "deny" semantics are not supported in this phase. A single identity may legitimately hold both `customer` and non-customer roles (e.g., a buyer who later applies as a merchant).
- **Status changes mid-session**: user is suspended, deleted, has a role removed, or a permission revoked while a session is active → next request re-evaluates from current DB state; cached envelopes must not outlive the change beyond a documented short window.
- **Merchant scope gaps**: merchant user with no `merchant_id`, or store-scoped user with no `store_id` → access to merchant/store-scoped endpoints is denied with a clear error code.
- **Merchant Staff with no permissions**: cannot reach any protected merchant feature; sees an empty dashboard with a "no permissions assigned" message.
- **Cross-merchant access attempt**: Merchant Staff from store A targeting store B → 403 + audit entry.
- **Dashboard misuse**: customer attempts to reach dashboard URL → blocked by middleware on the dashboard app and rejected by the backend regardless.
- **Privilege escalation attempt**: Platform Admin tries a Super-Admin-only action → 403 + audit entry.
- **Self-service role assignment**: any non-admin attempts role assignment → 403.
- **Super Admin protection**: attempt to delete the `super_admin` role → rejected; attempt to remove the last `super_admin` role from the last Super Admin user → rejected.
- **Duplicates**: duplicate role key on create → 409; duplicate permission key during seed → seed treats as no-op (idempotent).
- **Race on first paint**: frontend route loads before auth state resolves → render loading state; never render protected content optimistically.
- **CORS**: requests from origins not on the allow list → blocked at the network layer with no auth processing.
- **Email/phone collisions**: two Supabase identities ending up linked to the same application profile must be impossible (1-to-1 enforced by unique constraint on `supabaseUserId`).

## Requirements *(mandatory)*

### Functional Requirements

**Identity & Profile**

- **FR-001**: System MUST validate every incoming Supabase JWT (signature, expiry, issuer, audience) before granting access to any protected endpoint.
- **FR-002**: System MUST extract the Supabase user id from the JWT and resolve it to exactly one application profile when one exists.
- **FR-003**: System MUST allow an authenticated Supabase user without an application profile to create one via a dedicated `sync-profile` operation; protected business endpoints (other than `sync-profile` and `me`) MUST reject such users until a profile exists.
- **FR-004**: System MUST persist application profiles with: id, supabase user id (unique), email, phone, first name, last name, avatar url, preferred language, default currency, status, created/updated/deleted timestamps.
- **FR-005**: System MUST support the user statuses `active`, `inactive`, `suspended`, `pending_verification`, `deleted`, and MUST block users with status `suspended`, `deleted`, or `inactive` from reaching protected business endpoints. Users with status `pending_verification` MUST be limited to the `me` and `sync-profile` endpoints.
- **FR-005a**: System MUST expose a webhook endpoint that consumes Supabase Auth identity events; on a verified email-confirmation event for a `pending_verification` profile, the system MUST flip status to `active` and write an audit entry. Webhook requests MUST be authenticated (signed by Supabase's webhook secret) and rejected otherwise.
- **FR-005b**: As a fallback to a missed or delayed webhook, on every authenticated request from a user whose profile is still `pending_verification`, the system MUST re-read Supabase's `email_confirmed_at` and, if confirmed, flip the profile to `active` and write an audit entry before authorizing the request.
- **FR-006**: System MUST support soft-deletion of application profiles (status `deleted` + `deleted_at` timestamp) without physically removing the row.
- **FR-007**: Users MUST be able to update their own profile fields permitted by self-edit policy (e.g., name, phone, avatar, language, currency); status and roles MUST NOT be editable by self-service.

**Roles & Permissions Model**

- **FR-008**: System MUST persist roles with: id, name, key (unique), description, `isSystem` flag, created/updated timestamps.
- **FR-009**: System MUST persist permissions with: id, name, key (unique), module, resource, action, description, created/updated timestamps; permission keys MUST follow the `module.resource.action` convention.
- **FR-010**: System MUST support many-to-many associations between users and roles, and between roles and permissions; a user's effective permission set is the union across their assigned roles.
- **FR-011**: System MUST allow a single role assignment to optionally carry a `merchant_id` and/or `store_id`, indicating the scope under which the role applies.
- **FR-012**: System MUST treat the Super Admin role as having effective access to every permission, regardless of explicit role-permission rows.
- **FR-013**: System MUST refuse to delete or rename any role flagged `isSystem = true` and MUST refuse to delete the `super_admin` role under any circumstances.
- **FR-014**: System MUST refuse to remove the last `super_admin` role assignment from the last remaining Super Admin user.

**Roles & Users Defined**

- **FR-015**: System MUST seed the following system roles with stable keys: `super_admin`, `platform_admin`, `merchant`, `merchant_staff`, `customer`, `support_agent`, `finance_admin`, `shipping_agent`.
- **FR-016**: System MUST seed permissions for the modules: users, roles, permissions, merchants, stores, products, inventory, orders, payments, payouts, shipping, coupons, promotions, notifications, reports, settings, audit_logs.
- **FR-017**: System MUST attach a Super-Admin-aware default permission set to each seeded role: Super Admin → all permissions; Customer → customer-safe permissions only; Merchant → merchant-owner-safe permissions; Merchant Staff → none by default; Platform Admin / Finance Admin / Support Agent / Shipping Agent → role-appropriate defaults.
- **FR-018**: Seed scripts MUST be idempotent: re-running them creates no duplicates and never destroys existing custom roles, custom permissions, or assignments.

**Access Control Enforcement**

- **FR-019**: System MUST provide guards that, in order, validate the JWT, load the application profile, enforce active-user status, enforce role membership, enforce required permissions, and enforce merchant/store scope; failures MUST return consistent error envelopes.
- **FR-020**: System MUST provide endpoint annotations that declare auth requirements: public, optional-auth, role-required, permission-required, and store-scoped; absence of any annotation MUST default to "authentication + active profile required".
- **FR-021**: System MUST evaluate effective permissions and access scope from the current database state on every request (no stale enforcement decisions persisting beyond an authoritative cache window of at most 60 seconds, and invalidation MUST occur on role/permission/status changes).
- **FR-022**: System MUST expose the current caller's identity envelope (profile + roles + permissions + scope) to handlers via a single decorator/utility.

**Merchant & Store Scope Foundation**

- **FR-023**: System MUST allow user role assignments and access-scope records to reference a `merchant_id` and/or `store_id` (both nullable), and store-scoped guards MUST verify the targeted resource's merchant/store matches the caller's scope.
- **FR-024**: System MUST treat a Merchant user without an associated merchant id as restricted from merchant-scoped business endpoints.
- **FR-025**: System MUST treat Merchant Staff as scoped to a specific merchant (and optionally a specific store) via a staff membership record; staff with zero permissions are blocked from all merchant feature endpoints.
- **FR-026**: System MUST allow Super Admin to bypass merchant/store scope checks where bypass is explicitly intended (read-only inspection, support, recovery).

**APIs**

- **FR-027**: System MUST expose authenticated profile endpoints: `GET /api/v1/auth/me`, `POST /api/v1/auth/sync-profile`, `PATCH /api/v1/auth/profile`, `POST /api/v1/auth/logout`.
- **FR-028**: System MUST expose user administration endpoints (Super Admin / Platform Admin with permission): `GET /api/v1/users` (paginated, filterable), `GET /api/v1/users/:id`, `PATCH /api/v1/users/:id/status`, `PATCH /api/v1/users/:id/roles`.
- **FR-029**: System MUST expose role management endpoints: `GET /api/v1/roles`, `POST /api/v1/roles`, `GET /api/v1/roles/:id`, `PATCH /api/v1/roles/:id`, `DELETE /api/v1/roles/:id`.
- **FR-030**: System MUST expose permission catalog endpoints: `GET /api/v1/permissions`, `GET /api/v1/permissions/grouped` (grouped by module).
- **FR-031**: System MUST expose self-introspection endpoints: `GET /api/v1/me/permissions`, `GET /api/v1/me/roles`, `GET /api/v1/me/access-scope`.
- **FR-031a**: System MUST expose audit-log read endpoints: `GET /api/v1/audit-logs` (paginated; filterable by `actorUserId`, `action`, `entityType`, `entityId`, and date range) and `GET /api/v1/audit-logs/:id`. Both MUST be gated by the `audit_logs.view` permission. No create/update/delete endpoints are exposed; audit-log entries are written internally by other services only.
- **FR-032**: All APIs MUST be documented in OpenAPI (Swagger) with request/response schemas, error envelopes, and required permissions listed per endpoint.
- **FR-033**: All write endpoints MUST validate input via DTOs and reject with structured 4xx errors on validation failure; list endpoints MUST be paginated with consistent paging parameters and metadata.
- **FR-034**: All endpoints MUST return a consistent success/error envelope; error responses MUST NOT leak stack traces, secrets, or internal identifiers.

**Frontend (Dashboard)**

- **FR-035**: Dashboard MUST provide login, logout, and session-handling flows backed by Supabase Auth, and MUST never embed Supabase service role keys in client code.
- **FR-036**: Dashboard MUST guard every non-public route by checking authenticated state and effective permissions against the route's declared requirements; unauthorized navigation MUST land on an "Unauthorized" page.
- **FR-037**: Dashboard MUST render navigation and action buttons conditionally on effective permissions, while treating frontend hiding as UX-only and never as the security boundary.
- **FR-038**: Dashboard MUST render a "Suspended account" page when the backend reports a non-active status, and a loading state until auth resolves.
- **FR-039**: Dashboard MUST support both Arabic (RTL) and English (LTR), with all auth/identity copy translated.
- **FR-040**: Dashboard MUST forbid users whose *only* role is `customer` from reaching dashboard pages. A user who holds `customer` together with any non-customer role (e.g., `merchant`, `support_agent`) MUST be allowed to access the dashboard sections their non-customer roles permit.

**Frontend (Customer Website)**

- **FR-041**: Customer website MUST provide registration, login, logout, and password reset flows via Supabase Auth.
- **FR-042**: Customer website MUST allow anonymous browsing of public marketplace pages; account, profile, and (in future phases) cart-persistence/checkout/order pages MUST be auth-required.
- **FR-043**: Customer website MUST forbid navigation to dashboard URLs from a customer session.

**Audit Logging**

- **FR-044**: System MUST write an immutable audit-log entry for: profile created/updated, status changed, role created/updated/deleted, permission assigned/removed from a role, role assigned/removed from a user, login profile sync, and notable blocked unauthorized access attempts.
- **FR-045**: Audit-log entries MUST capture actor user id, action key, entity type, entity id, structured metadata, IP address, and user agent where available; they MUST NOT capture passwords, JWTs, or other secrets.
- **FR-046**: System MUST refuse update or delete operations against audit-log entries through application APIs.
- **FR-046a**: System MUST retain every audit-log entry for at least 1 year from its `created_at` timestamp. No automatic purge or archival is performed in Phase 2; older entries simply remain queryable. The future purge/archival job is out of scope.

**Security**

- **FR-047**: Supabase service role keys MUST exist only in backend secret storage; they MUST never reach a browser or mobile bundle.
- **FR-048**: System MUST apply rate limiting to authentication-sensitive endpoints with the following thresholds (returning HTTP 429 with a standard error envelope when exceeded):
  - Per-IP **10 requests/minute** on `POST /api/v1/auth/sync-profile` and on every Supabase Auth webhook handler.
  - Per-IP **5 requests/minute** on the password-reset webhook handler specifically.
  - Per-authenticated-user **30 requests/minute** on `GET /api/v1/auth/me`, `GET /api/v1/me/permissions`, `GET /api/v1/me/roles`, `GET /api/v1/me/access-scope`.
  - Per-authenticated-user **20 requests/minute** on every write operation against users, roles, permissions, and user-status endpoints (FR-028, FR-029, and the role-permission assignment endpoints).
  - Thresholds MUST be configurable via environment variables so production tuning does not require a code change.
- **FR-049**: System MUST validate and sanitize all user-supplied input on the backend; reliance on client-side validation alone is forbidden.
- **FR-050**: CORS MUST allow only configured origins for the dashboard and customer website; all others are rejected.

### Key Entities

- **UserProfile**: The application's representation of a person who can act in the system. Linked one-to-one with a Supabase Auth identity. Carries display data (names, avatar), preferences (language, currency), and lifecycle state (status, soft-delete timestamp).
- **Role**: A named bundle of permissions (e.g., `merchant`, `support_agent`). May be system-defined (immutable key) or custom. Holds metadata for display and a flag distinguishing system from custom roles.
- **Permission**: A single, granular capability identified by a `module.resource.action` key (e.g., `orders.manage.view`). Permissions are catalogued centrally and grouped by module for UI selection.
- **UserRole**: An assignment of a role to a user, optionally scoped to a merchant and/or store. Multiple assignments per user are supported; the effective permission set is the union across assignments.
- **RolePermission**: An assignment of a permission to a role. The relationship is many-to-many. Super Admin's access is computed, not stored as exhaustive rows.
- **UserAccessScope**: Records which merchants and/or stores a user is permitted to act within, independent of role assignments. Used by store-scope guards to enforce isolation efficiently.
- **StaffMembership** (foundation): Lightweight record indicating that a user belongs to a specific merchant (and optionally a specific store) as staff, enabling future multi-store support and staff-permission management. Full lifecycle is owned by the Phase 3 merchant-onboarding feature.
- **AuditLog**: Append-only record of sensitive identity/access-control events: actor, action, entity type, entity id, metadata, IP, user agent, timestamp. Immutable through application APIs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user can call the `me` endpoint and receive their full identity envelope (profile + roles + permissions + scope) in a single round-trip with end-to-end latency under 300 ms at the 95th percentile.
- **SC-002**: 100% of protected endpoints in the codebase are guarded — no protected endpoint can be hit successfully without a valid token, an active profile, the required role(s), and the required permission(s); a static check or test sweep verifies this.
- **SC-003**: Cross-merchant data leakage is impossible: a black-box test in which Merchant A's user attempts every store-scoped endpoint against Merchant B's resources returns 403 in 100% of attempts, with audit entries logged.
- **SC-004**: Suspended or deleted users are blocked from every protected endpoint within 60 seconds of the status change taking effect.
- **SC-005**: Seed scripts are idempotent: running them N times leaves the database identical to running them once, with no duplicate roles or permissions and no destruction of custom assignments.
- **SC-006**: A new internal role (e.g., "Catalog Reviewer") can be created and assigned to a user via the dashboard in under 2 minutes, end-to-end, by a Super Admin.
- **SC-007**: Dashboard renders correctly in Arabic (RTL) and English (LTR) for every auth screen (login, logout confirmation, unauthorized, suspended, loading) with no layout regressions.
- **SC-008**: A user whose only role is `customer` attempting to reach any dashboard URL is redirected away in 100% of attempts (both authenticated and unauthenticated sessions). A user holding `customer` plus any non-customer role is admitted to the dashboard sections their non-customer roles permit.
- **SC-009**: Every sensitive identity/access-control action listed in FR-044 produces exactly one matching audit-log entry; audit logs cannot be modified or deleted through application APIs in 100% of attempts.
- **SC-010**: OpenAPI documentation lists every Phase-2 endpoint, its required role(s), required permission(s), and request/response schema; coverage is verified by an automated check.
- **SC-011**: No secrets (Supabase service role key, JWT contents, passwords) appear in any audit log, application log, or API response in a sampled review.
- **SC-012**: Every authenticated endpoint is reachable using a valid Supabase JWT issued through the standard customer or dashboard sign-in flow without any manual token manipulation.

## Assumptions

- Phase 1 (platform bootstrap) has already provisioned: the NestJS modular-monolith skeleton, the Prisma client wired to Supabase PostgreSQL, the Next.js dashboard shell, the Next.js customer website shell, the i18n framework with Arabic/English support, the standard success/error response envelope, the centralized exception filter, and the deployment target.
- Supabase Auth is the sole identity provider; alternative identity providers (SSO, enterprise IdPs) are out of scope for this phase.
- Supabase JWTs carry the user id (and optionally email) and are validated server-side using Supabase's published JWKS; no shared HMAC secret is assumed.
- Email and phone uniqueness is enforced by Supabase Auth; the application profile inherits but does not duplicate that enforcement beyond the unique link to `supabase_user_id`.
- Effective permission decisions may be cached for at most 60 seconds per user, with explicit invalidation on role/permission/status changes; this is the documented "near-real-time" enforcement window.
- Self-registration through the customer website creates accounts in `pending_verification` status. The status is flipped to `active` by a Supabase Auth webhook on email confirmation; if the webhook is missed, the user's next authenticated request reconciles status by re-reading `email_confirmed_at` from Supabase. Admin-provisioned users may be created directly in `active`.
- Default values: `preferred_language` defaults to the request's `Accept-Language` (Arabic or English) or `en`; `default_currency` defaults to a single platform default currency (configurable in platform settings, out of scope here).
- Multi-store per merchant is anticipated and the data model accommodates `store_id` as nullable, but the merchant onboarding flow that activates multiple stores is in Phase 3.
- Audit logs are stored in the same Postgres database for this phase. Minimum retention is 1 year; long-term archival and the purge job are deferred to a later phase.
- "Logout" on the backend is primarily a client-driven Supabase signOut; the backend `POST /api/v1/auth/logout` endpoint is a lightweight server-side hook for audit logging and any future revocation list, not a JWT invalidation mechanism (Supabase JWTs remain valid until expiry).

## Dependencies on Phase 1 (Platform Bootstrap)

- NestJS application skeleton with global pipes, filters, interceptors, and the standard response envelope already configured.
- Prisma + Supabase PostgreSQL connection, migration tooling, and seed-runner already operational.
- Configuration system that loads Supabase URL, anon key, service role key, and JWKS endpoint from environment variables only.
- Logging and request-context plumbing (request id, IP, user agent capture) already available for the audit-log writer to consume.
- i18n framework (Arabic + English) already wired into both Next.js apps with a working RTL layout switch.
- Shared TypeScript types package (e.g., `@platform/types`) with the standard success/error envelopes already defined.
- CI/CD pipeline that runs migrations, seeds, lint, type-check, and tests on every commit.

## Future Phase Integration Notes

- **Phase 3 — Merchant onboarding & store approval**: Will fully populate `Merchant`, `Store`, and `StaffMembership` entities and bind users to them. The `merchant_id` / `store_id` columns and guards specified here must accept those records without schema changes.
- **Phase 4 — Catalog & inventory**: Will declare new permissions (`products.manage.create`, `inventory.manage.update`, etc.). The seed system must be extensible so new modules add permissions idempotently.
- **Phase 5 — Cart, checkout & orders**: Will introduce Customer-required endpoints; Customer role's permission set may need expansion (`orders.self.view`, `orders.self.create`). Staff and merchant order-management permissions hook into the same `StoreScopeGuard`.
- **Phase 6 — Payments & payouts**: Finance Admin role's seeded permissions are the foundation for payments/payouts/refunds endpoints; Merchant payout-acceptance permissions will be assigned to Merchant by default.
- **Phase 7 — Shipping**: Shipping Agent role and its permission seeds anchor the shipping module's authorization.
- **Mobile (Flutter) app**: Will reuse the same `GET /api/v1/auth/me` envelope and the same Supabase JWT flow; no backend changes expected.
- **Future RLS / row-level security in Postgres**: The merchant/store scope columns introduced here are designed so an optional Postgres RLS layer can be enabled later without schema migration.
- **Future SSO / enterprise IdPs**: Application profiles are decoupled from Supabase by design; adding a new identity provider would only change which JWT validator runs in front of the same profile resolution.

## Out of Scope

- Full merchant onboarding workflow and merchant CRUD
- Store creation, approval, and configuration
- Product catalog, categories, attributes, media management
- Inventory tracking and stock adjustments
- Cart, wishlist, and checkout
- Orders lifecycle and order management dashboards
- Payments, payment provider integrations, refunds, settlements
- Payouts to merchants, commission calculation, accounting
- Shipping carriers, rates, label generation, tracking
- Coupons, promotions, discount engines
- Notifications delivery infrastructure (email/SMS/push)
- Reports and analytics
- Flutter mobile app implementation
- Full UI design system and component library beyond what is needed for auth screens
- Row-level security (RLS) policies in Postgres (data-layer scope enforcement in this phase is application-side)
- Multi-tenant Supabase project isolation
- Account deletion / GDPR-grade erasure flows beyond soft-delete
