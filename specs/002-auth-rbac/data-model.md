# Data Model — Authentication, Users, Roles & Permissions

**Feature**: `002-auth-rbac` | **Date**: 2026-05-07 | **Storage**: Supabase PostgreSQL via Prisma 5

This document specifies the schema delta from Phase 1 (`001-platform-bootstrap`). It lists every model added or changed, the resulting Prisma definitions, the migration plan, validation rules, and state transitions. It is the source of truth for the upcoming Prisma migration `002_auth_rbac`.

> **Naming note**: Phase 1 used `Role.code` and `Permission.code` as the stable string key. The spec writes "key" — these are the same field. We keep `code` in the schema (already migrated and in use) and surface it as `key` in the public API DTOs to match the spec wording.

---

## 1. Schema delta summary

| Action                                                  | Model / Type            |
|---------------------------------------------------------|-------------------------|
| **NEW enum**                                            | `UserStatus`            |
| **CHANGED**                                             | `User` (status, name split, drop `is_active`) |
| **CHANGED**                                             | `Role` (add `is_system` indexes — already present), expose `key` alias in API |
| **CHANGED**                                             | `Permission` (add `module`, `resource`, `action` columns derived from `code`) |
| **NEW**                                                 | `UserAccessScope`       |
| **NEW**                                                 | `StaffMembership`       |
| **NEW**                                                 | `WebhookEvent`          |
| **CHANGED**                                             | `AuditLog` (no schema change; new index `(action_code, occurred_at DESC)`) |

No existing column is removed without a backfill. The migration is forward-only; rollback is by point-in-time recovery.

---

## 2. Enums

### `UserStatus`

```prisma
enum UserStatus {
  active
  inactive
  suspended
  pending_verification
  deleted

  @@map("user_status")
}
```

Postgres-native enum. The `@@map` produces a Postgres type named `user_status`.

### `ScopeType`

```prisma
enum ScopeType {
  platform
  merchant
  store

  @@map("scope_type")
}
```

### `StaffMembershipStatus`

```prisma
enum StaffMembershipStatus {
  invited
  active
  suspended
  revoked

  @@map("staff_membership_status")
}
```

---

## 3. Changed model — `User`

**Goal**: replace `is_active`/`display_name` with the spec's full status enum and split name fields.

```prisma
model User {
  id              String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  supabaseUserId  String     @unique(map: "users_supabase_user_id_key") @map("supabase_user_id") @db.Uuid
  email           String
  phone           String?
  firstName       String?    @map("first_name")
  lastName        String?    @map("last_name")
  avatarUrl       String?    @map("avatar_url")
  preferredLanguage String   @default("en") @map("preferred_language")        // 'en' | 'ar'
  defaultCurrency String     @default("USD") @map("default_currency")          // ISO-4217; resolved against Currency at use-time
  status          UserStatus @default(active)
  lastSeenAt      DateTime?  @map("last_seen_at") @db.Timestamptz
  createdAt       DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime   @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime?  @map("deleted_at") @db.Timestamptz

  userRoles       UserRole[]            @relation("UserRolesUser")
  grantedByRoles  UserRole[]            @relation("GrantedBy")
  auditLogs       AuditLog[]            @relation("AuditActor")
  accessScopes    UserAccessScope[]
  staffMemberships StaffMembership[]

  @@unique([email], map: "users_email_active_key")
  @@index([status], map: "users_status_idx")
  @@map("users")
}
```

**Validation (DTO-level)**:

- `email`: RFC-5322 + maxLen 254. The DB-level uniqueness is preserved from Phase 1.
- `phone`: optional E.164 (regex `^\+[1-9]\d{1,14}$`).
- `firstName`, `lastName`: trimmed; maxLen 80; printable Unicode allowed (Arabic + Latin).
- `preferredLanguage`: must be in the platform's enabled locale set (`['en', 'ar']` initially).
- `defaultCurrency`: ISO-4217; must exist in `Currency` table; default falls back to `Setting.platform.defaultCurrency`.

**State transitions** (`status`):

```
                 ┌────────────────────────────────────┐
                 ▼                                    │
        pending_verification ──email confirmed──► active
                 │                                    ▲
                 │                                    │
                 │             ┌──admin reactivate──  │
                 │             │                      │
                 ▼             │                      │
              inactive ◄──admin suspend pause──── active
                 │
                 │
              suspended ◄──admin suspend──── active
                 │
                 ▼
              deleted   ◄──admin or self soft-delete── any non-deleted state
```

Rules (enforced in `UsersService` + DB checks):

- `pending_verification` → `active` is allowed only via the Supabase webhook handler or the lazy reconciliation path (FR-005a/b). Admins cannot manually set it.
- `deleted` is terminal: a `deleted` profile stays soft-deleted (`deletedAt` set). Re-activation requires creating a new identity.
- `inactive` and `suspended` differ semantically: `inactive` = self/admin pause, `suspended` = enforcement action. Both block business endpoints.
- The transition `active` → `pending_verification` is forbidden (no demotion path).

---

## 4. Changed model — `Role`

```prisma
model Role {
  id          String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code        String           @unique                                     // exposed as `key` in API
  label       Json                                                          // { en: string, ar: string }
  description Json?                                                          // { en, ar } | null
  isSystem    Boolean          @default(true) @map("is_system")
  createdAt   DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime         @updatedAt @map("updated_at") @db.Timestamptz

  rolePermissions RolePermission[]
  userRoles       UserRole[]

  @@index([isSystem], map: "roles_is_system_idx")
  @@map("roles")
}
```

**Validation**:

- `code`: lowercase snake_case, regex `^[a-z][a-z0-9_]{1,63}$`.
- `label`: JSON object MUST contain both `en` and `ar` keys, both non-empty trimmed strings ≤ 80 chars.
- `description`: same shape as `label`, optional.
- `isSystem`: only the seed may set `true`. Custom roles created via API are always `false`.

**Invariants** (enforced in `RolesService`):

- Cannot delete a row where `isSystem = true` (FR-013).
- Cannot delete the row with `code = 'super_admin'` regardless of `isSystem` (defensive duplicate).
- Cannot rename `code` for a row where `isSystem = true`.

---

## 5. Changed model — `Permission`

Phase 1 stored only `code` and `description`. We add the parsed components so the grouped endpoint and admin filters don't have to string-split on every request.

```prisma
model Permission {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code        String   @unique                                              // exposed as `key` in API
  module      String                                                          // first segment of code
  resource    String                                                          // second segment
  action      String                                                          // third segment
  label       Json                                                             // { en, ar }
  description Json?                                                            // { en, ar }
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  rolePermissions RolePermission[]

  @@index([module], map: "permissions_module_idx")
  @@index([module, resource], map: "permissions_module_resource_idx")
  @@map("permissions")
}
```

**Validation**:

- `code`: regex `^[a-z][a-z0-9_]+\.[a-z][a-z0-9_]+\.[a-z][a-z0-9_]+$`.
- `module`, `resource`, `action`: derived from `code`; persisted for query speed and verified in a CHECK constraint that they recompose to `code`.

**Migration**: backfill `module`/`resource`/`action` from existing `code` values, then add the CHECK constraint.

---

## 6. Existing model — `UserRole` (no schema change)

Phase 1's `UserRole` already supports nullable `merchantId` and `storeId` and a `(userId, roleId, merchantId, storeId)` unique constraint. Phase 2 keeps it as-is, but `RolesService.assignRolesToUser` MUST run inside a transaction that also writes to `UserAccessScope` and the audit log.

---

## 7. New model — `UserAccessScope`

```prisma
model UserAccessScope {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  scopeType  ScopeType @map("scope_type")
  merchantId String?   @map("merchant_id") @db.Uuid
  storeId    String?   @map("store_id") @db.Uuid
  source     String                                                            // 'role' | 'staff_membership' | 'manual'
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, scopeType, merchantId, storeId, source], map: "user_access_scope_unique")
  @@index([userId], map: "user_access_scope_user_idx")
  @@index([merchantId], map: "user_access_scope_merchant_idx")
  @@index([storeId], map: "user_access_scope_store_idx")
  @@map("user_access_scope")
}
```

**Semantics**:

- `scopeType = 'platform'` → row has `merchantId = null` and `storeId = null`. Used by Super Admin and Platform Admin.
- `scopeType = 'merchant'` → row has `merchantId` set; `storeId` may be set for store-scoped staff.
- `scopeType = 'store'` → both set.
- `source` records what emitted the row so we can reliably reconcile when a role is revoked or a staff membership ends.

**Maintenance**:

- Written transactionally by `RolesService.assignRolesToUser` and (later) `StaffMembershipsService`.
- A `ScopeProjector` service exposes a `rebuildForUser(userId)` method used by the seeder and any future repair script.

---

## 8. New model — `StaffMembership` (foundation)

```prisma
model StaffMembership {
  id         String                @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String                @map("user_id") @db.Uuid
  merchantId String                @map("merchant_id") @db.Uuid
  storeId    String?               @map("store_id") @db.Uuid
  status     StaffMembershipStatus @default(invited)
  invitedAt  DateTime              @default(now()) @map("invited_at") @db.Timestamptz
  joinedAt   DateTime?             @map("joined_at") @db.Timestamptz
  invitedByUserId String?          @map("invited_by_user_id") @db.Uuid
  createdAt  DateTime              @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime              @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, merchantId, storeId], map: "staff_membership_unique")
  @@index([merchantId], map: "staff_membership_merchant_idx")
  @@index([storeId], map: "staff_membership_store_idx")
  @@map("staff_memberships")
}
```

**Phase 2 scope**: schema + a thin `StaffMembershipsService` exposing `findActiveForUser(userId)` (consumed by `StoreScopeGuard`) and `seed(...)` for tests. The invitation/onboarding API ships in Phase 3. No `Merchant` or `Store` foreign keys are added yet because those tables don't exist; the columns are typed `Uuid` so FKs can be added later without data migration.

---

## 9. New model — `WebhookEvent` (idempotency for inbound webhooks)

```prisma
model WebhookEvent {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  source        String                                                              // 'supabase'
  eventId       String    @map("event_id")                                          // provider-given unique id
  eventType     String    @map("event_type")                                        // e.g. 'user.email_confirmed'
  signatureValid Boolean  @map("signature_valid")
  payload       Json
  receivedAt    DateTime  @default(now()) @map("received_at") @db.Timestamptz
  processedAt   DateTime? @map("processed_at") @db.Timestamptz
  processingError String? @map("processing_error")

  @@unique([source, eventId], map: "webhook_events_source_event_unique")
  @@index([eventType, receivedAt(sort: Desc)], map: "webhook_events_type_received_idx")
  @@map("webhook_events")
}
```

**Use**: Phase 2 ships only the `supabase` source (auth events). Adding payment/shipping providers later just inserts new `source` values.

---

## 10. Existing model — `AuditLog` (additive index)

No column changes. Add one composite index to scale per-action filtering on the read API:

```prisma
@@index([actionCode, occurredAt(sort: Desc)], map: "audit_logs_action_occurred_idx")
```

---

## 11. Migration plan (`002_auth_rbac`)

Forward-only. Each step is a single `prisma migrate` migration; running them in order is the supported path.

1. Create types: `user_status`, `scope_type`, `staff_membership_status`.
2. `users`: add `status` with default `active` + backfill from `is_active`/`deleted_at`; add `first_name`, `last_name`, `preferred_language`, `default_currency`; backfill `first_name`/`last_name` from `display_name` (`split_part(display_name, ' ', 1)` and the remainder); drop `is_active` and `display_name`; rename Phase 1's `locale` to `preferred_language`; add `users_status_idx`.
3. `permissions`: add `module`, `resource`, `action`, `label`; backfill from `code`; add CHECK constraint that they recompose; add the two indexes.
4. `roles`: add `roles_is_system_idx`.
5. `user_access_scope`: create.
6. `staff_memberships`: create.
7. `webhook_events`: create.
8. `audit_logs`: add the new composite index.

After the migration, the `prisma/seed.ts` script (extended) is run idempotently to:
- Upsert all 8 system roles.
- Upsert ~80 system permissions.
- Reconcile default `role_permissions` for non-Super-Admin system roles (`super_admin` is computed at runtime).
- Bootstrap one Super Admin user from `SUPERADMIN_EMAIL`/`SUPERADMIN_SUPABASE_USER_ID` env vars when present (only in non-prod), creating the `UserRole` and the `platform`-scoped `UserAccessScope` row.

---

## 12. Seed catalog

### 12.1 Roles (8 system roles)

| `code`           | `label.en`         | `label.ar`             | Default permission set                                                                 |
|------------------|--------------------|------------------------|----------------------------------------------------------------------------------------|
| `super_admin`    | Super Admin        | المسؤول الأعلى          | (computed: full access; no rows seeded)                                                |
| `platform_admin` | Platform Admin     | مسؤول المنصة            | All `*.view` permissions; users.manage.*; roles.manage.view; settings.manage.view      |
| `merchant`       | Merchant           | تاجر                    | Merchant-owner-safe set: products.*, inventory.*, orders.*, payouts.view, coupons.*    |
| `merchant_staff` | Merchant Staff     | موظف التاجر             | (none by default; assigned per-merchant by the merchant owner)                         |
| `customer`       | Customer           | عميل                    | `users.profile.view`, `users.profile.update`, customer-self order/wishlist (Phase 5+)  |
| `support_agent`  | Support Agent      | وكيل الدعم              | users.manage.view, orders.manage.view, audit_logs.view (read-only support set)         |
| `finance_admin`  | Finance Admin      | مسؤول المالية            | payments.*, payouts.*, reports.finance.view, audit_logs.view                           |
| `shipping_agent` | Shipping Agent     | وكيل الشحن              | shipping.*, orders.shipping.view                                                       |

The exact default permission sets per role are enumerated in `seed.ts` as a constant map and asserted by a unit test (`seed.spec.ts`) so drift from the seed is detectable.

### 12.2 Permissions (canonical catalog by module)

For each module below, the seed inserts the actions listed. The full catalog is ~80 rows; the controllers in later phases will reference them by `code`.

| Module           | Resources × actions seeded                                                                                       |
|------------------|------------------------------------------------------------------------------------------------------------------|
| `users`          | `profile.{view,update}`, `manage.{view,create,update,suspend,delete}`                                            |
| `roles`          | `manage.{view,create,update,delete}`                                                                             |
| `permissions`    | `manage.{view}`                                                                                                  |
| `merchants`      | `manage.{view,create,update,approve,suspend,delete}`                                                             |
| `stores`         | `manage.{view,create,update,suspend,delete}`                                                                     |
| `products`       | `manage.{view,create,update,delete,publish}`                                                                     |
| `inventory`      | `manage.{view,update,adjust,transfer}`                                                                           |
| `orders`         | `manage.{view,update,cancel}`, `shipping.{view}`                                                                 |
| `payments`       | `manage.{view,refund}`                                                                                           |
| `payouts`        | `manage.{view,approve,reject}`                                                                                   |
| `shipping`       | `manage.{view,create,update,delete}`                                                                             |
| `coupons`        | `manage.{view,create,update,delete}`                                                                             |
| `promotions`     | `manage.{view,create,update,delete}`                                                                             |
| `notifications`  | `manage.{view,send,template_update}`                                                                             |
| `reports`        | `finance.{view}`, `sales.{view}`, `operations.{view}`                                                            |
| `settings`       | `manage.{view,update}`                                                                                           |
| `audit_logs`     | `view`                                                                                                           |

---

## 13. DTO types (shared via `packages/types`)

The frontend and backend share these types so the API contract is type-checked end-to-end. The actual TypeScript source goes in `packages/types/src/auth.ts` (new) and is exported from `packages/types/src/index.ts`.

```ts
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deleted';
export type ScopeType  = 'platform' | 'merchant' | 'store';
export type Locale     = 'en' | 'ar';
export type Localized<T = string> = { en: T; ar: T };

export interface UserProfileDto {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  preferredLanguage: Locale;
  defaultCurrency: string;          // ISO-4217
  status: UserStatus;
  createdAt: string;                // ISO-8601
  updatedAt: string;
}

export interface RoleDto {
  id: string;
  key: string;                      // == DB `code`
  label: Localized;
  description: Localized | null;
  isSystem: boolean;
}

export interface PermissionDto {
  id: string;
  key: string;
  module: string;
  resource: string;
  action: string;
  label: Localized;
  description: Localized | null;
}

export interface AccessScopeDto {
  scopeType: ScopeType;
  merchantId: string | null;
  storeId: string | null;
}

export interface AuthEnvelopeDto {
  user: UserProfileDto;
  roles: RoleDto[];                 // user's currently-assigned roles
  permissions: string[];            // effective permission keys (deduped, computed)
  accessScopes: AccessScopeDto[];
  isSuperAdmin: boolean;            // convenience: roles includes 'super_admin'
}

export interface AuditLogDto {
  id: string;
  occurredAt: string;
  actor: { id: string; email: string } | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  merchantId: string | null;
  storeId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: 'info' | 'notice' | 'warning' | 'critical';
}
```

---

## 14. Index summary (Phase 2 contribution)

| Table              | Index                                                              | Purpose                                     |
|--------------------|--------------------------------------------------------------------|---------------------------------------------|
| `users`            | `users_status_idx (status)`                                        | Suspended/deleted scans, admin filters      |
| `roles`            | `roles_is_system_idx (is_system)`                                  | Distinguish system vs custom in admin UI    |
| `permissions`      | `permissions_module_idx (module)`                                  | `/permissions/grouped` query                |
| `permissions`      | `permissions_module_resource_idx (module, resource)`               | UI permission selectors                     |
| `user_access_scope`| `user_access_scope_user_idx (user_id)`                             | Guard read path                             |
| `user_access_scope`| `user_access_scope_merchant_idx (merchant_id)`                     | Reverse lookup (who can act on M)           |
| `user_access_scope`| `user_access_scope_store_idx (store_id)`                           | Reverse lookup (who can act on S)           |
| `staff_memberships`| `staff_membership_merchant_idx (merchant_id)`                      | List a merchant's staff (Phase 3)           |
| `staff_memberships`| `staff_membership_store_idx (store_id)`                            | List a store's staff (Phase 3)              |
| `webhook_events`   | `webhook_events_type_received_idx (event_type, received_at desc)`  | Replay/forensics                            |
| `audit_logs`       | `audit_logs_action_occurred_idx (action_code, occurred_at desc)`   | Per-action timeline filter                  |

---

## 15. Validation & invariants checklist (cross-reference to FRs)

- FR-001..002 → JWT verification before any DB hit (no schema impact).
- FR-003..006 → `User.status`, `User.deletedAt`, status transitions (§3).
- FR-005a → `WebhookEvent` table + `webhooks/supabase` controller (research §R4).
- FR-008..010 → `Role`, `Permission`, `RolePermission`, `UserRole` (Phase 1 + §4–5).
- FR-011 → `UserRole.merchantId`, `UserRole.storeId` (Phase 1 carries this).
- FR-012..014 → `RolesService` invariants on `super_admin` + `isSystem` (§4).
- FR-015..017 → seed catalog (§12).
- FR-018 → seed reconcile-without-delete (research §R12).
- FR-019..022 → guards + `EffectivePermissionsService` (research §R2).
- FR-023..026 → `UserAccessScope`, `StaffMembership`, `StoreScopeGuard` (§7–8).
- FR-027..031a → controllers + DTOs in `packages/types` (§13 + contracts).
- FR-032..034 → Swagger generation + standard envelopes (Phase 1 plumbing).
- FR-044..046a → `AuditLog` immutability + 1-year retention (no purge job in Phase 2).
- FR-047..050 → secrets in env, rate-limit buckets (research §R5), CORS (existing config).
