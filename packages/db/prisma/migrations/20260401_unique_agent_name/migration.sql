-- Unique constraint on agent_name (NULL values are excluded by PostgreSQL)
-- This ensures each agent has a unique name while allowing multiple human users (agent_name IS NULL)
CREATE UNIQUE INDEX "users_agent_name_unique" ON "users"("agent_name") WHERE "agent_name" IS NOT NULL;
