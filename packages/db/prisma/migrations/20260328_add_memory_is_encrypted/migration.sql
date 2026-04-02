-- Add is_encrypted column to memory_items for per-tenant encryption tracking
ALTER TABLE "memory_items" ADD COLUMN "is_encrypted" BOOLEAN NOT NULL DEFAULT false;
