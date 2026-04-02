-- SkillForge Foundation: Skill metadata, analysis jobs, usage tracking
-- This migration is idempotent: all operations use IF NOT EXISTS

-- Skill metadata extends memory items of type 'skill'
CREATE TABLE IF NOT EXISTS skill_metadata (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id         UUID NOT NULL UNIQUE REFERENCES memory_items(id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'candidate'
                    CHECK (status IN ('candidate', 'active', 'archived', 'dismissed')),
  trigger_conditions JSONB NOT NULL DEFAULT '[]',
  verification_steps JSONB NOT NULL DEFAULT '[]',
  source_memory_ids UUID[] NOT NULL DEFAULT '{}',
  extraction_prompt TEXT,
  confidence_score  DECIMAL(3,2) NOT NULL DEFAULT 0.50
                    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count       INTEGER NOT NULL DEFAULT 0,
  last_used_at      TIMESTAMPTZ,
  last_boosted_at   TIMESTAMPTZ,
  decay_score       DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_metadata_memory_id
  ON skill_metadata(memory_id);
CREATE INDEX IF NOT EXISTS idx_skill_metadata_status
  ON skill_metadata(status);
CREATE INDEX IF NOT EXISTS idx_skill_metadata_confidence
  ON skill_metadata(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_skill_metadata_usage
  ON skill_metadata(usage_count DESC);

-- Track skill analysis job runs per user
CREATE TABLE IF NOT EXISTS skill_analysis_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  memories_analyzed   INTEGER NOT NULL DEFAULT 0,
  skills_extracted    INTEGER NOT NULL DEFAULT 0,
  skills_deduplicated INTEGER NOT NULL DEFAULT 0,
  error_message       TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_analysis_jobs_user_status
  ON skill_analysis_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_skill_analysis_jobs_created
  ON skill_analysis_jobs(created_at DESC);

-- Track skill usage events for feedback loop
CREATE TABLE IF NOT EXISTS skill_usage_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_metadata_id UUID NOT NULL REFERENCES skill_metadata(id) ON DELETE CASCADE,
  agent_id          UUID NOT NULL,
  event_type        VARCHAR(20) NOT NULL
                    CHECK (event_type IN ('served', 'referenced', 'applied', 'dismissed')),
  context           JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_usage_events_skill
  ON skill_usage_events(skill_metadata_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_usage_events_agent
  ON skill_usage_events(agent_id, created_at DESC);
