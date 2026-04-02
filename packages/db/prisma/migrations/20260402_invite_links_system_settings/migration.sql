-- CreateTable: system_settings (key-value admin config)
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable: invite_links (agent self-registration)
CREATE TABLE "invite_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" VARCHAR(1000),
    "max_uses" INTEGER,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_links_pkey" PRIMARY KEY ("id")
);

-- AlterTable: users — add invite_code column
ALTER TABLE "users" ADD COLUMN "invite_code" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_code_key" ON "invite_links"("code");
CREATE INDEX "invite_links_code_idx" ON "invite_links"("code");
CREATE INDEX "invite_links_is_active_idx" ON "invite_links"("is_active");

-- Seed default system setting
INSERT INTO "system_settings" ("key", "value") VALUES ('invite_registration_enabled', 'true')
ON CONFLICT ("key") DO NOTHING;
