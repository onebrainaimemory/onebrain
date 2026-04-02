-- DeepRecall Foundation: HNSW index + embedding status tracking
-- This migration is idempotent: all operations use IF NOT EXISTS

-- HNSW index for fast approximate nearest-neighbor search (cosine distance)
-- m=16: number of bi-directional links per node
-- ef_construction=64: index quality during build
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
  ON embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Track embedding generation status per memory item
-- Values: none (default), pending, completed, failed
ALTER TABLE memory_items
  ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) NOT NULL DEFAULT 'none';

-- Index for batch re-embedding queries and status checks
CREATE INDEX IF NOT EXISTS idx_memory_items_embedding_status
  ON memory_items(user_id, embedding_status)
  WHERE deleted_at IS NULL;
