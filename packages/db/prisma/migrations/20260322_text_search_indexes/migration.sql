-- Enable pg_trgm extension for trigram-based text search indexes.
-- Requires the extension to be available on the PostgreSQL server.
-- If the DB user lacks CREATE EXTENSION privileges, run this manually
-- as a superuser: CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on memory_items for fast ILIKE text search.
-- Without these, search queries do full table scans via sequential ILIKE.
CREATE INDEX IF NOT EXISTS memory_items_title_trgm_idx
  ON memory_items USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS memory_items_body_trgm_idx
  ON memory_items USING GIN (body gin_trgm_ops);

-- Remove redundant index on users.email — the UNIQUE constraint
-- already creates a B-tree index. The explicit @@index duplicates it.
DROP INDEX IF EXISTS users_email_idx;
