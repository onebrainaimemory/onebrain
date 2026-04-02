-- BrainPulse Foundation: Briefing config, schedules, triggers, engagement
-- This migration is idempotent: all operations use IF NOT EXISTS

-- Per-user briefing configuration
CREATE TABLE IF NOT EXISTS briefing_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_enabled          BOOLEAN NOT NULL DEFAULT false,
  timezone            VARCHAR(50) NOT NULL DEFAULT 'Europe/Berlin',
  quiet_hours_start   VARCHAR(5) DEFAULT '22:00',
  quiet_hours_end     VARCHAR(5) DEFAULT '07:00',
  webhook_url         VARCHAR(500),
  webhook_secret      VARCHAR(255),
  content_preferences JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefing_configs_user
  ON briefing_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_briefing_configs_enabled
  ON briefing_configs(is_enabled) WHERE is_enabled = true;

-- Scheduled briefing definitions
CREATE TABLE IF NOT EXISTS briefing_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       UUID NOT NULL REFERENCES briefing_configs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL
                  CHECK (type IN ('morning', 'midday', 'evening', 'event_triggered', 'weekly_health')),
  cron_expression VARCHAR(100) NOT NULL,
  channels        TEXT[] NOT NULL DEFAULT '{email}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  next_fire_at    TIMESTAMPTZ,
  last_fired_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefing_schedules_user
  ON briefing_schedules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_briefing_schedules_next_fire
  ON briefing_schedules(next_fire_at)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_briefing_schedules_config
  ON briefing_schedules(config_id);

-- Event-driven briefing triggers
CREATE TABLE IF NOT EXISTS briefing_triggers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id         UUID NOT NULL REFERENCES briefing_configs(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type        VARCHAR(50) NOT NULL,
  threshold         INTEGER,
  channels          TEXT[] NOT NULL DEFAULT '{email}',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes  INTEGER NOT NULL DEFAULT 60,
  last_triggered_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefing_triggers_user
  ON briefing_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_briefing_triggers_event
  ON briefing_triggers(event_type);

-- Generated briefings
CREATE TABLE IF NOT EXISTS briefings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_id     UUID REFERENCES briefing_schedules(id) ON DELETE SET NULL,
  trigger_id      UUID REFERENCES briefing_triggers(id) ON DELETE SET NULL,
  type            VARCHAR(20) NOT NULL
                  CHECK (type IN ('morning', 'midday', 'evening', 'event_triggered', 'weekly_health')),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'generating', 'ready', 'delivered', 'failed')),
  title           VARCHAR(500) NOT NULL,
  content_text    TEXT NOT NULL,
  content_html    TEXT,
  content_json    JSONB,
  generation_meta JSONB DEFAULT '{}',
  delivered_via   TEXT[] NOT NULL DEFAULT '{}',
  error_message   VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefings_user_created
  ON briefings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefings_user_status
  ON briefings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_briefings_schedule
  ON briefings(schedule_id);

-- Briefing engagement tracking
CREATE TABLE IF NOT EXISTS briefing_engagements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      VARCHAR(50) NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefing_engagements_briefing
  ON briefing_engagements(briefing_id);
CREATE INDEX IF NOT EXISTS idx_briefing_engagements_user
  ON briefing_engagements(user_id, created_at DESC);
