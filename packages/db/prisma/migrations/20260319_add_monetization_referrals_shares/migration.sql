-- Plans
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");
CREATE INDEX "plans_name_idx" ON "plans"("name");
CREATE INDEX "plans_is_active_idx" ON "plans"("is_active");

-- Plan Limits
CREATE TABLE "plan_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" INTEGER NOT NULL,
    "period" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plan_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "plan_limits_plan_id_key_key" ON "plan_limits"("plan_id", "key");
CREATE INDEX "plan_limits_plan_id_idx" ON "plan_limits"("plan_id");

-- Plan Features
CREATE TABLE "plan_features" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "plan_features_plan_id_key_key" ON "plan_features"("plan_id", "key");
CREATE INDEX "plan_features_plan_id_idx" ON "plan_features"("plan_id");

-- User Plans
CREATE TABLE "user_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE
);
CREATE INDEX "user_plans_user_id_idx" ON "user_plans"("user_id");
CREATE INDEX "user_plans_user_id_is_active_idx" ON "user_plans"("user_id", "is_active");
CREATE INDEX "user_plans_plan_id_idx" ON "user_plans"("plan_id");

-- Usage Events
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "usage_events_user_id_idx" ON "usage_events"("user_id");
CREATE INDEX "usage_events_user_id_type_idx" ON "usage_events"("user_id", "type");
CREATE INDEX "usage_events_user_id_created_at_idx" ON "usage_events"("user_id", "created_at");
CREATE INDEX "usage_events_created_at_idx" ON "usage_events"("created_at");

-- Referrals
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referrer_user_id" UUID NOT NULL,
    "referred_user_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "referrals_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");
CREATE INDEX "referrals_referrer_user_id_idx" ON "referrals"("referrer_user_id");
CREATE INDEX "referrals_referred_user_id_idx" ON "referrals"("referred_user_id");
CREATE INDEX "referrals_code_idx" ON "referrals"("code");

-- Brain Shares
CREATE TABLE "brain_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "share_token" VARCHAR(100) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "scope" VARCHAR(50) NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brain_shares_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "brain_shares_share_token_key" ON "brain_shares"("share_token");
CREATE INDEX "brain_shares_share_token_idx" ON "brain_shares"("share_token");
CREATE INDEX "brain_shares_user_id_idx" ON "brain_shares"("user_id");

-- Seed default free plan
INSERT INTO "plans" ("name", "display_name", "description", "is_active")
VALUES ('free', 'Free', 'Default free plan', true);

INSERT INTO "plan_limits" ("plan_id", "key", "value", "period")
SELECT id, 'context_calls_per_month', 100, 'monthly' FROM "plans" WHERE name = 'free'
UNION ALL
SELECT id, 'memory_writes_per_month', 50, 'monthly' FROM "plans" WHERE name = 'free'
UNION ALL
SELECT id, 'extract_calls_per_month', 20, 'monthly' FROM "plans" WHERE name = 'free';

INSERT INTO "plan_features" ("plan_id", "key", "value")
SELECT id, 'max_context_depth', 'assistant' FROM "plans" WHERE name = 'free'
UNION ALL
SELECT id, 'allow_deep_context', 'false' FROM "plans" WHERE name = 'free'
UNION ALL
SELECT id, 'max_entities_in_context', '5' FROM "plans" WHERE name = 'free'
UNION ALL
SELECT id, 'priority_processing', 'false' FROM "plans" WHERE name = 'free';
