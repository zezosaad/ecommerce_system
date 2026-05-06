-- Foundation migration (Phase 0). Authored from prisma/schema.prisma.
-- Applies all 14 foundation tables, indexes, and partial uniques.
-- Idempotency-safe insofar as Prisma migrations are; do not edit after apply.

-- Required extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- users
-- ============================================================================
CREATE TABLE "users" (
    "id"                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "supabase_user_id"  UUID         NOT NULL,
    "email"             TEXT         NOT NULL,
    "display_name"      TEXT,
    "avatar_url"        TEXT,
    "locale"            TEXT         NOT NULL DEFAULT 'en',
    "phone"             TEXT,
    "is_active"         BOOLEAN      NOT NULL DEFAULT true,
    "last_seen_at"      TIMESTAMPTZ,
    "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ  NOT NULL,
    "deleted_at"        TIMESTAMPTZ
);
CREATE UNIQUE INDEX "users_supabase_user_id_key" ON "users"("supabase_user_id");
-- Partial unique: email is unique among non-deleted rows.
CREATE UNIQUE INDEX "users_email_active_key" ON "users"("email") WHERE "deleted_at" IS NULL;

-- ============================================================================
-- roles
-- ============================================================================
CREATE TABLE "roles" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "code"        TEXT         NOT NULL,
    "label"       JSONB        NOT NULL,
    "description" JSONB,
    "is_system"   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ  NOT NULL
);
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- ============================================================================
-- permissions
-- ============================================================================
CREATE TABLE "permissions" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "code"        TEXT         NOT NULL,
    "description" JSONB,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
-- Format check: <scope>.<resource>.<action> with optional `*` action wildcard.
ALTER TABLE "permissions"
  ADD CONSTRAINT "permissions_code_format_chk"
  CHECK (
    "code" ~ '^[a-z]+\.[a-z_]+\.[a-z_]+$'
    OR "code" ~ '^[a-z]+\.[a-z_]+\.\*$'
  );

-- ============================================================================
-- role_permissions
-- ============================================================================
CREATE TABLE "role_permissions" (
    "role_id"       UUID         NOT NULL,
    "permission_id" UUID         NOT NULL,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id"),
    CONSTRAINT "role_permissions_role_id_fkey"       FOREIGN KEY ("role_id")       REFERENCES "roles"("id")       ON DELETE CASCADE,
    CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT
);

-- ============================================================================
-- user_roles
-- ============================================================================
CREATE TABLE "user_roles" (
    "id"                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"             UUID         NOT NULL,
    "role_id"             UUID         NOT NULL,
    "merchant_id"         UUID,
    "store_id"            UUID,
    "granted_by_user_id"  UUID,
    "granted_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "revoked_at"          TIMESTAMPTZ,
    "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "user_roles_user_id_fkey"            FOREIGN KEY ("user_id")            REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_roles_role_id_fkey"            FOREIGN KEY ("role_id")            REFERENCES "roles"("id") ON DELETE RESTRICT,
    CONSTRAINT "user_roles_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id")
);
-- Active binding uniqueness (revoked_at IS NULL).
CREATE UNIQUE INDEX "user_roles_active_unique"
  ON "user_roles"("user_id", "role_id", COALESCE("merchant_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("store_id", '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE "revoked_at" IS NULL;
CREATE INDEX "user_roles_merchant_id_idx" ON "user_roles"("merchant_id") WHERE "revoked_at" IS NULL;
CREATE INDEX "user_roles_user_id_idx"     ON "user_roles"("user_id")     WHERE "revoked_at" IS NULL;

-- ============================================================================
-- audit_logs (append-only)
-- ============================================================================
CREATE TABLE "audit_logs" (
    "id"                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "occurred_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "actor_user_id"     UUID,
    "actor_role_codes"  TEXT[]       NOT NULL DEFAULT '{}',
    "action_code"       TEXT         NOT NULL,
    "target_type"       TEXT,
    "target_id"         TEXT,
    "merchant_id"       UUID,
    "store_id"          UUID,
    "correlation_id"    TEXT         NOT NULL,
    "ip_address"        INET,
    "user_agent"        TEXT,
    "before"            JSONB,
    "after"             JSONB,
    "metadata"          JSONB,
    "severity"          TEXT         NOT NULL DEFAULT 'info',
    CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id"),
    CONSTRAINT "audit_logs_severity_chk" CHECK ("severity" IN ('info','warning','critical'))
);
CREATE INDEX "audit_logs_occurred_at_idx"          ON "audit_logs"("occurred_at" DESC);
CREATE INDEX "audit_logs_actor_occurred_at_idx"    ON "audit_logs"("actor_user_id", "occurred_at" DESC);
CREATE INDEX "audit_logs_merchant_occurred_at_idx" ON "audit_logs"("merchant_id", "occurred_at" DESC);
CREATE INDEX "audit_logs_target_idx"               ON "audit_logs"("target_type", "target_id");
CREATE INDEX "audit_logs_action_code_idx"          ON "audit_logs"("action_code");

-- ============================================================================
-- settings
-- ============================================================================
CREATE TABLE "settings" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "key"         TEXT         NOT NULL,
    "merchant_id" UUID,
    "value"       JSONB        NOT NULL,
    "is_secret"   BOOLEAN      NOT NULL DEFAULT false,
    "description" JSONB,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ  NOT NULL,
    "deleted_at"  TIMESTAMPTZ
);
-- Uniqueness within scope. NULL merchant_id means global scope.
CREATE UNIQUE INDEX "settings_key_merchant_unique"
  ON "settings"("key", COALESCE("merchant_id", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX "settings_merchant_id_idx" ON "settings"("merchant_id");

-- ============================================================================
-- currencies
-- ============================================================================
CREATE TABLE "currencies" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "code"           TEXT         NOT NULL,
    "name"           JSONB        NOT NULL,
    "symbol"         TEXT         NOT NULL,
    "decimal_digits" SMALLINT     NOT NULL DEFAULT 2,
    "is_default"     BOOLEAN      NOT NULL DEFAULT false,
    "is_active"      BOOLEAN      NOT NULL DEFAULT true,
    "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ  NOT NULL
);
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");
-- Exactly one default currency.
CREATE UNIQUE INDEX "currencies_one_default_idx" ON "currencies"(("is_default")) WHERE "is_default" = true;

-- ============================================================================
-- exchange_rates
-- ============================================================================
CREATE TABLE "exchange_rates" (
    "id"                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "from_currency_code"  TEXT         NOT NULL,
    "to_currency_code"    TEXT         NOT NULL,
    "rate"                NUMERIC(20,10) NOT NULL,
    "source"              TEXT         NOT NULL,
    "effective_at"        TIMESTAMPTZ  NOT NULL,
    "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "exchange_rates_from_fkey" FOREIGN KEY ("from_currency_code") REFERENCES "currencies"("code"),
    CONSTRAINT "exchange_rates_to_fkey"   FOREIGN KEY ("to_currency_code")   REFERENCES "currencies"("code")
);
CREATE INDEX "exchange_rates_currency_pair_idx"
  ON "exchange_rates"("from_currency_code", "to_currency_code", "effective_at" DESC);

-- ============================================================================
-- tax_classes
-- ============================================================================
CREATE TABLE "tax_classes" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "code"        TEXT         NOT NULL,
    "name"        JSONB        NOT NULL,
    "description" JSONB,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ  NOT NULL
);
CREATE UNIQUE INDEX "tax_classes_code_key" ON "tax_classes"("code");

-- ============================================================================
-- country_tax_rules
-- ============================================================================
CREATE TABLE "country_tax_rules" (
    "id"             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    "country_code"   TEXT          NOT NULL,
    "tax_class_id"   UUID          NOT NULL,
    "rate_percent"   NUMERIC(6,3)  NOT NULL,
    "is_inclusive"   BOOLEAN       NOT NULL DEFAULT false,
    "effective_from" TIMESTAMPTZ   NOT NULL,
    "effective_to"   TIMESTAMPTZ,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ   NOT NULL,
    CONSTRAINT "country_tax_rules_tax_class_id_fkey" FOREIGN KEY ("tax_class_id") REFERENCES "tax_classes"("id")
);
CREATE UNIQUE INDEX "country_tax_rules_unique"
  ON "country_tax_rules"("country_code", "tax_class_id", "effective_from");

-- ============================================================================
-- ledger_accounts
-- ============================================================================
CREATE TABLE "ledger_accounts" (
    "id"                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "code"               TEXT         NOT NULL,
    "name"               JSONB        NOT NULL,
    "type"               TEXT         NOT NULL,
    "owner_kind"         TEXT         NOT NULL,
    "owner_merchant_id"  UUID,
    "currency_code"      TEXT         NOT NULL,
    "is_active"          BOOLEAN      NOT NULL DEFAULT true,
    "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "ledger_accounts_currency_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code"),
    CONSTRAINT "ledger_accounts_type_chk"       CHECK ("type" IN ('asset','liability','revenue','expense','equity')),
    CONSTRAINT "ledger_accounts_owner_kind_chk" CHECK ("owner_kind" IN ('platform','merchant')),
    CONSTRAINT "ledger_accounts_merchant_chk"
      CHECK (("owner_kind" = 'platform' AND "owner_merchant_id" IS NULL)
          OR ("owner_kind" = 'merchant' AND "owner_merchant_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- ============================================================================
-- ledger_entries (append-only)
-- ============================================================================
CREATE TABLE "ledger_entries" (
    "id"             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    "transaction_id" UUID          NOT NULL,
    "account_id"     UUID          NOT NULL,
    "direction"      TEXT          NOT NULL,
    "amount"         NUMERIC(20,4) NOT NULL,
    "currency_code"  TEXT          NOT NULL,
    "description"    TEXT,
    "correlation_id" TEXT          NOT NULL,
    "metadata"       JSONB,
    "occurred_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT "ledger_entries_account_fkey"  FOREIGN KEY ("account_id")    REFERENCES "ledger_accounts"("id"),
    CONSTRAINT "ledger_entries_currency_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code"),
    CONSTRAINT "ledger_entries_direction_chk" CHECK ("direction" IN ('debit','credit')),
    CONSTRAINT "ledger_entries_amount_chk"    CHECK ("amount" > 0)
);
CREATE INDEX "ledger_entries_transaction_id_idx"        ON "ledger_entries"("transaction_id");
CREATE INDEX "ledger_entries_account_occurred_at_idx"   ON "ledger_entries"("account_id", "occurred_at" DESC);
CREATE INDEX "ledger_entries_occurred_at_idx"           ON "ledger_entries"("occurred_at" DESC);

-- ============================================================================
-- idempotency_records
-- ============================================================================
CREATE TABLE "idempotency_records" (
    "id"               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "actor_user_id"    UUID,
    "route"            TEXT         NOT NULL,
    "idempotency_key"  TEXT         NOT NULL,
    "body_hash"        TEXT         NOT NULL,
    "response_status"  INT          NOT NULL,
    "response_headers" JSONB        NOT NULL,
    "response_body"    JSONB        NOT NULL,
    "expires_at"       TIMESTAMPTZ  NOT NULL,
    "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "idempotency_records_unique"
  ON "idempotency_records"(COALESCE("actor_user_id", '00000000-0000-0000-0000-000000000000'::uuid), "route", "idempotency_key");
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");
