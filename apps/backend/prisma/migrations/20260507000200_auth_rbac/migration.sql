-- Auth RBAC migration (Phase 2). Authored per data-model.md §11.
-- Applies enum types, user schema rewrite, permission columns, new tables, and indexes.

-- ============================================================================
-- 1. Create enum types
-- ============================================================================
CREATE TYPE "user_status" AS ENUM ('active', 'inactive', 'suspended', 'pending_verification', 'deleted');
CREATE TYPE "scope_type" AS ENUM ('platform', 'merchant', 'store');
CREATE TYPE "staff_membership_status" AS ENUM ('invited', 'active', 'suspended', 'revoked');

-- ============================================================================
-- 2. Users table rewrite
-- ============================================================================

-- 2a. Add new columns with defaults
ALTER TABLE "users" ADD COLUMN "status" "user_status" NOT NULL DEFAULT 'active';
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN "preferred_language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "users" ADD COLUMN "default_currency" TEXT NOT NULL DEFAULT 'USD';

-- 2b. Backfill status from is_active and deleted_at
UPDATE "users" SET "status" = 'deleted'   WHERE "deleted_at" IS NOT NULL;
UPDATE "users" SET "status" = 'inactive'  WHERE "deleted_at" IS NULL AND "is_active" = false;
UPDATE "users" SET "status" = 'active'    WHERE "deleted_at" IS NULL AND "is_active" = true;

-- 2c. Backfill first_name / last_name from display_name
UPDATE "users" SET
  "first_name" = TRIM(SPLIT_PART("display_name", ' ', 1)),
  "last_name"  = CASE
    WHEN POSITION(' ' IN "display_name") > 0
    THEN TRIM(SUBSTRING("display_name" FROM POSITION(' ' IN "display_name") + 1))
    ELSE NULL
  END
WHERE "display_name" IS NOT NULL AND "display_name" != '';

-- 2d. Backfill preferred_language from locale
UPDATE "users" SET "preferred_language" = "locale";

-- 2e. Drop old columns
ALTER TABLE "users" DROP COLUMN "is_active";
ALTER TABLE "users" DROP COLUMN "display_name";
ALTER TABLE "users" DROP COLUMN "locale";

-- 2f. Add status index
CREATE INDEX "users_status_idx" ON "users"("status");

-- ============================================================================
-- 3. Permissions: add derived columns + label + CHECK + indexes
-- ============================================================================
ALTER TABLE "permissions" ADD COLUMN "module" TEXT NOT NULL DEFAULT '';
ALTER TABLE "permissions" ADD COLUMN "resource" TEXT NOT NULL DEFAULT '';
ALTER TABLE "permissions" ADD COLUMN "action" TEXT NOT NULL DEFAULT '';
ALTER TABLE "permissions" ADD COLUMN "label" JSONB;

-- Backfill module, resource, action from code (format: module.resource.action)
UPDATE "permissions" SET
  "module"   = SPLIT_PART("code", '.', 1),
  "resource" = SPLIT_PART("code", '.', 2),
  "action"   = SPLIT_PART("code", '.', 3);

-- Drop the old format check (Phase 1 had a different pattern)
ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_code_format_chk";

-- Add new CHECK: module.resource.action must recompose to code
ALTER TABLE "permissions"
  ADD CONSTRAINT "permissions_components_chk"
  CHECK ("code" = "module" || '.' || "resource" || '.' || "action");

-- Add indexes
CREATE INDEX "permissions_module_idx" ON "permissions"("module");
CREATE INDEX "permissions_module_resource_idx" ON "permissions"("module", "resource");

-- ============================================================================
-- 4. Roles: add is_system index
-- ============================================================================
CREATE INDEX "roles_is_system_idx" ON "roles"("is_system");

-- ============================================================================
-- 5. User access scope table
-- ============================================================================
CREATE TABLE "user_access_scope" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"     UUID         NOT NULL,
    "scope_type"  "scope_type" NOT NULL,
    "merchant_id" UUID,
    "store_id"    UUID,
    "source"      TEXT         NOT NULL,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "user_access_scope_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "user_access_scope_unique"
  ON "user_access_scope"("user_id", "scope_type", COALESCE("merchant_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("store_id", '00000000-0000-0000-0000-000000000000'::uuid), "source");
CREATE INDEX "user_access_scope_user_idx"     ON "user_access_scope"("user_id");
CREATE INDEX "user_access_scope_merchant_idx" ON "user_access_scope"("merchant_id");
CREATE INDEX "user_access_scope_store_idx"    ON "user_access_scope"("store_id");

-- ============================================================================
-- 6. Staff memberships table
-- ============================================================================
CREATE TABLE "staff_memberships" (
    "id"                UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"           UUID                        NOT NULL,
    "merchant_id"       UUID                        NOT NULL,
    "store_id"          UUID,
    "status"            "staff_membership_status"   NOT NULL DEFAULT 'invited',
    "invited_at"        TIMESTAMPTZ                 NOT NULL DEFAULT now(),
    "joined_at"         TIMESTAMPTZ,
    "invited_by_user_id" UUID,
    "created_at"        TIMESTAMPTZ                 NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ                 NOT NULL,
    CONSTRAINT "staff_memberships_user_fkey"      FOREIGN KEY ("user_id")       REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "staff_memberships_invited_by_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id")
);
CREATE UNIQUE INDEX "staff_membership_unique"
  ON "staff_memberships"("user_id", "merchant_id", COALESCE("store_id", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX "staff_membership_merchant_idx" ON "staff_memberships"("merchant_id");
CREATE INDEX "staff_membership_store_idx"    ON "staff_memberships"("store_id");

-- ============================================================================
-- 7. Webhook events table
-- ============================================================================
CREATE TABLE "webhook_events" (
    "id"                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "source"            TEXT         NOT NULL,
    "event_id"          TEXT         NOT NULL,
    "event_type"        TEXT         NOT NULL,
    "signature_valid"   BOOLEAN      NOT NULL,
    "payload"           JSONB        NOT NULL,
    "received_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "processed_at"      TIMESTAMPTZ,
    "processing_error"  TEXT
);
CREATE UNIQUE INDEX "webhook_events_source_event_unique"
  ON "webhook_events"("source", "event_id");
CREATE INDEX "webhook_events_type_received_idx"
  ON "webhook_events"("event_type", "received_at" DESC);

-- ============================================================================
-- 8. Audit logs: add composite index
-- ============================================================================
CREATE INDEX "audit_logs_action_occurred_idx"
  ON "audit_logs"("action_code", "occurred_at" DESC);
