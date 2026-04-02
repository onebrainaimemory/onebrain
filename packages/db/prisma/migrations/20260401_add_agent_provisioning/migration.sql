-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('human', 'agent');

-- AlterTable (additive only — no existing columns modified)
ALTER TABLE "users" ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'human';
ALTER TABLE "users" ADD COLUMN "agent_name" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "provisioned_by" UUID;

-- CreateIndex
CREATE INDEX "users_account_type_idx" ON "users"("account_type");
