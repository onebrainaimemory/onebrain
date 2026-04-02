-- Migration: Add missing tables, columns, enums, and FK constraints
-- Required for: Auth (password, 2FA, roles), GDPR (audit, consent, soft-delete),
--               Stripe (subscriptions), Tags, File uploads, Notifications

-- ─────────────────────────────────────────────
-- NEW ENUMS
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'canceled', 'incomplete', 'trialing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- ALTER users — add new columns
-- ─────────────────────────────────────────────

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_streak_date" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_key" ON "users"("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");

-- ─────────────────────────────────────────────
-- ALTER sessions — add device tracking columns
-- ─────────────────────────────────────────────

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "device_name" VARCHAR(255);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(100);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_agent" VARCHAR(500);

-- ─────────────────────────────────────────────
-- ALTER plans — add pricing & Stripe columns
-- ─────────────────────────────────────────────

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "trial_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "price_monthly" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "price_yearly" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_price_id_monthly" VARCHAR(255);
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_price_id_yearly" VARCHAR(255);
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_coupon_id" VARCHAR(255);

-- ─────────────────────────────────────────────
-- ALTER referrals — add reward tracking
-- ─────────────────────────────────────────────

ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "reward_granted" BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- brain_shares — add missing FK constraint
-- ─────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "brain_shares" ADD CONSTRAINT "brain_shares_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- NEW TABLE: audit_logs
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "details" JSONB,
    "ip_address" VARCHAR(100),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- ─────────────────────────────────────────────
-- NEW TABLE: consents
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "categories" JSONB NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "consents_user_id_idx" ON "consents"("user_id");
CREATE INDEX IF NOT EXISTS "consents_created_at_idx" ON "consents"("created_at");

-- ─────────────────────────────────────────────
-- NEW TABLE: subscriptions
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "stripe_subscription_id" VARCHAR(255) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "period_start" TIMESTAMPTZ,
    "period_end" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_end" TIMESTAMPTZ,
    "coupon_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_idx" ON "subscriptions"("stripe_subscription_id");

-- ─────────────────────────────────────────────
-- NEW TABLE: tags
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "tags_user_id_name_key" ON "tags"("user_id", "name");
CREATE INDEX IF NOT EXISTS "tags_user_id_idx" ON "tags"("user_id");

-- ─────────────────────────────────────────────
-- NEW TABLE: memory_tags (junction)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "memory_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "memory_item_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memory_tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memory_tags_memory_item_id_fkey" FOREIGN KEY ("memory_item_id") REFERENCES "memory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "memory_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "memory_tags_memory_item_id_tag_id_key" ON "memory_tags"("memory_item_id", "tag_id");
CREATE INDEX IF NOT EXISTS "memory_tags_memory_item_id_idx" ON "memory_tags"("memory_item_id");
CREATE INDEX IF NOT EXISTS "memory_tags_tag_id_idx" ON "memory_tags"("tag_id");

-- ─────────────────────────────────────────────
-- NEW TABLE: file_uploads
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "file_uploads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "file_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "file_uploads_user_id_idx" ON "file_uploads"("user_id");
CREATE INDEX IF NOT EXISTS "file_uploads_user_id_is_processed_idx" ON "file_uploads"("user_id", "is_processed");

-- ─────────────────────────────────────────────
-- NEW TABLE: notification_preferences
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email_daily" BOOLEAN NOT NULL DEFAULT false,
    "push_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_id_key" ON "notification_preferences"("user_id");
