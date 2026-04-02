# Scaling OneBrain

## Horizontal API Scaling

The API is stateless (session data in JWT + Redis). Multiple instances can run behind a load balancer.

### Setup

1. **Disable in-process retention** on secondary instances:

   ```env
   DISABLE_RETENTION_JOB=true
   ```

2. **Run the standalone retention worker** as a single instance:

   ```bash
   DATABASE_URL=... RETENTION_INTERVAL_HOURS=6 tsx src/workers/retention-worker.ts
   ```

3. **Add upstream pool in Caddy** (`infra/control-plane/Caddyfile`):

   ```
   reverse_proxy /api/eu/* {
     to api-eu-1:3001 api-eu-2:3001
     lb_policy round_robin
     health_uri /health
     health_interval 10s
   }
   ```

4. **Redis is required** for multi-instance deployments:
   - Session refresh tokens use Redis for invalidation
   - Brute-force lockout counters are stored in Redis
   - Without Redis, lockout state is per-process (in-memory fallback)

## Connection Pool

Pool parameters are set in `DATABASE_URL`:

```
postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10&statement_timeout=5000&connect_timeout=5
```

Rule of thumb: `connection_limit` = max DB connections / number of API instances.

## Region Routing

The web frontend needs to direct API calls to the correct region (EU or GLOBAL).

### Options

1. **User selection page** (current: `/region` page exists) — user picks region at first login, stored in JWT claims
2. **Geo-IP routing** — Caddy or upstream proxy routes based on client IP geolocation
3. **Cookie-based** — after first region selection, store in cookie for subsequent page loads

The API already embeds `region` in JWT tokens. The web frontend reads `NEXT_PUBLIC_API_URL` which is a single URL. For multi-region support, the frontend would need to dynamically switch between `/api/eu` and `/api/global` based on the authenticated user's region claim.

## Docker Compose Example (Multi-Instance EU)

```yaml
services:
  api-eu-1:
    <<: *api-base
    environment:
      - DISABLE_RETENTION_JOB=true
  api-eu-2:
    <<: *api-base
    environment:
      - DISABLE_RETENTION_JOB=true
  retention-worker:
    <<: *api-base
    command: ["node", "--max-old-space-size=256", "dist/workers/retention-worker.js"]
```
