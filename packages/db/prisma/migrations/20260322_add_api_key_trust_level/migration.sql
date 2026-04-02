-- Add trust_level column to api_keys table
-- Default 'review': new connect keys require manual approval
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "trust_level" VARCHAR(20) NOT NULL DEFAULT 'review';
