-- Add soft-delete support to memory_items.
-- Memories are now archived (deletedAt set) instead of hard-deleted.
-- Retention service will hard-delete items 30 days after soft-delete.
ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS memory_items_user_deleted_idx
  ON memory_items (user_id, deleted_at);
