-- Agent tracking: add apiKeyId to memory_items and usage_events
ALTER TABLE "memory_items" ADD COLUMN IF NOT EXISTS "api_key_id" UUID;
ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "api_key_id" UUID;

-- Agent config fields on api_keys
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "description" VARCHAR(500);
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "rate_limit_per_min" INTEGER;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMPTZ;

-- Agent activity log table
CREATE TABLE IF NOT EXISTS "agent_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "api_key_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "agent_activities_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "memory_items" DROP CONSTRAINT IF EXISTS "memory_items_api_key_id_fkey";
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_api_key_id_fkey"
    FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usage_events" DROP CONSTRAINT IF EXISTS "usage_events_api_key_id_fkey";
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_api_key_id_fkey"
    FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_activities" DROP CONSTRAINT IF EXISTS "agent_activities_api_key_id_fkey";
ALTER TABLE "agent_activities" ADD CONSTRAINT "agent_activities_api_key_id_fkey"
    FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_activities" DROP CONSTRAINT IF EXISTS "agent_activities_user_id_fkey";
ALTER TABLE "agent_activities" ADD CONSTRAINT "agent_activities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "memory_items_api_key_id_idx" ON "memory_items"("api_key_id");
CREATE INDEX IF NOT EXISTS "memory_items_user_id_updated_at_idx" ON "memory_items"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "usage_events_api_key_id_idx" ON "usage_events"("api_key_id");
CREATE INDEX IF NOT EXISTS "agent_activities_api_key_id_idx" ON "agent_activities"("api_key_id");
CREATE INDEX IF NOT EXISTS "agent_activities_user_id_idx" ON "agent_activities"("user_id");
CREATE INDEX IF NOT EXISTS "agent_activities_api_key_id_created_at_idx" ON "agent_activities"("api_key_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_activities_user_id_created_at_idx" ON "agent_activities"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_activities_created_at_idx" ON "agent_activities"("created_at");
