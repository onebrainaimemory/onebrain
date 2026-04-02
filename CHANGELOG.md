# Changelog

All notable changes to this project will be documented in this file.

## [1.10.0] - 2026-04-02

### Added

- **Agent Invite System** — admin-managed invite links for controlled agent registration
  - Admin invite management page (`/dashboard/admin/invites`) with global toggle, create/edit/delete
  - Configurable access level per invite link: read-only (3 scopes) or read+write (8 scopes)
  - `GET /v1/invite/:code/info` — public invite code validation (30/min rate limit)
  - `POST /v1/invite/register` — agent registration via invite code (5/hr/IP rate limit)
  - `GET /v1/admin/invites` — list all invite links with status
  - `POST /v1/admin/invites` — create invite link with custom/auto code, access level, max uses, expiry
  - `PATCH /v1/admin/invites/:id` — update invite link (label, accessLevel, isActive, maxUses, expiresAt)
  - `DELETE /v1/admin/invites/:id` — delete invite link
  - `GET/PUT /v1/admin/settings/invite` — global invite registration toggle
  - Public invite pages (`/invite`, `/invite/[code]`) with auto-validation and registration form
  - Crypto-safe random invite code generator (no ambiguous characters)
  - API key with 90-day expiry issued on registration
  - Atomic uses count increment, expiration enforcement, exhaustion detection
- **OpenAPI spec** updated with agent registration and invite endpoints
- **ChatGPT Actions plugin** updated with agent registration endpoint
- **FAQ page** updated with agent invite questions
- i18n: 63 new invite keys in DE/EN/ES
- Database: InviteLink model, SystemSetting model, access_level column, inviteCode on User
- Sitemap: `/invite` added with priority 0.6
- Admin navigation: Invites tab added

### Changed

- Prisma pinned to `~6.19.x` (prevents accidental v7 upgrade)

## [1.9.0] - 2026-03-31

### Added

- **DeepRecall** — hybrid semantic search across memories (keyword + vector + fused)
  - `POST /v1/memory/search` with keyword (Dice coefficient), vector (cosine similarity), and hybrid modes
  - Configurable fusion weight (alpha parameter)
  - Embedding pipeline with BullMQ + pgvector storage
  - `GET /v1/memory/embeddings/status` — embedding coverage stats
  - `POST /v1/memory/embeddings/reindex` — batch re-embed failed/missing memories
  - DeepRecall dashboard page with mode selector, alpha slider, and results display
- **SkillForge** — self-learning skill extraction loop
  - `GET /v1/skills` — list learned skills with status/confidence filters
  - `POST /v1/skills/:id/feedback` — record applied/referenced/dismissed events
  - SkillForge dashboard page with status tabs, confidence bars, and trigger tags
- **BrainPulse** — proactive briefing system
  - `GET /v1/briefings/config` — briefing configuration (timezone, quiet hours, channels)
  - `GET /v1/briefings` — list briefings with type/status filters
  - BrainPulse dashboard page with config panel, analytics, and briefing list
- MCP server: 5 new tools (`deep_search`, `write_memory_batch`, `list_skills`, `skill_feedback`, `get_briefing_config`, `list_briefings`) — 11 tools total
- MCP package version synced to 0.9.0
- Navigation: DeepRecall, SkillForge, BrainPulse links in user menu
- Landing page: 3 new feature cards (10 total)
- i18n: 60+ new keys in DE/EN/ES for search, skills, briefings namespaces
- FEATURELIST.md: 54 new feature items (509 total)
- 9 new MCP API client tests, 8 new embedding admin tests

### Changed

- MCP server version bumped from 0.7.0 to 0.9.0
- MCP package.json version synced from 0.1.0 to 0.9.0

## [1.8.0] - 2026-03-22

### Added

- Full agent activity tracking system (backend + frontend + tests)
- AgentActivity database model with 5 indexes for query performance
- Agent activity service: fire-and-forget logging, list, summary, delta sync, bulk candidate management
- 7 REST API endpoints: agent list, cross-agent summary, activity feed, per-agent summary/activity, bulk candidates, API key config
- Delta sync endpoint for agents (`GET /v1/connect/:key/delta` — what's new since last query)
- Activity logging on all connect read/write operations
- Agent dashboard page with summary cards (total calls, active agents, error rate, pending candidates)
- Agent detail page with configuration form, activity feed, and bulk approve/dismiss candidates
- Period selector (7/30/90 days) on agent dashboard
- Zod validation schemas: agentActivityQuery, updateApiKeyConfig, deltaSyncQuery, bulkMemoryAction
- i18n: 40+ keys in EN/DE/ES for agents namespace and help tooltips
- GitHub OAuth login (backend code exchange + frontend callback page)
- Apple OAuth login (frontend popup flow)
- Google OAuth login (Google Identity Services integration)
- OAuth buttons with brand SVG icons on login page
- 24 new agent activity integration tests (365 total passing)

### Fixed

- Health endpoint `getCache` import name (was `get`, caused Redis always degraded)
- enforcePlanLimit middleware fail-open pattern (prevents 500s when plan data unavailable)
- requireVerifiedEmail hook ordering (per-route preHandler after requireAuth)
- Duplicate `/v1/plans/public` route in billing routes removed
- Notification email link updated from removed `/dashboard/daily` to `/dashboard`
- 9 untranslated German locale values fixed (vs→gg., Scope→Umfang, etc.)

### Changed

- Navigation: added "Agents" item (visible in standard mode)
- Connect routes: pass apiKeyId to createMemory for source tracking
- memory.service.ts: accepts optional apiKeyId parameter
- Prisma schema: apiKeyId + indexes on MemoryItem and UsageEvent
- ApiKey model: added description, rateLimitPerMin, isActive, lastSyncedAt fields

## [1.7.1] - 2026-03-22

### Added

- OneBrain Sync Protocol v1: compact system prompt, ETag/304 caching, token-budgeted context scopes
- Batch memory write-back endpoint (`POST /v1/connect/:key/memories`, up to 10 items)
- Deduplication on connect write-back (skips duplicate memories)
- Trust levels on API keys: review (default, needs approval) vs trusted (auto-save)
- Delete button for connect keys with double-confirmation dialog
- Admin DSGVO dashboard and metrics pages
- Public plans endpoint (`GET /v1/plans/public`, always available without Stripe)
- AI plugin manifest route for ChatGPT Actions integration
- `security-utils.ts`: extracted and TDD-tested `sanitizeFilename` + `isPrivateIp`
- Migration `20260322_add_api_key_trust_level`

### Fixed

- Trust level toggles non-functional (Prisma client stale, CSS nearly invisible on dark mode)
- Copy button overlapping code block on integrations page
- DNS rebinding TOCTOU in SSRF protection (pinned lookup via `node:https` agent)
- HTTPS cert validation failure when fetching with IP-pinned URL (servername on TLS socket)
- Health endpoint exposing DB/Redis internals publicly (split into `/health` + `/health/details`)
- Stripe price IDs leaked in public plans endpoint
- `request.role` → `request.userRole` type mismatch on health details handler
- Blanket catch swallowing non-auth errors in `/health/details` preHandler
- Dead code `isValidTrustLevel()` removed
- Billing integration test expecting 404 for now-public `/v1/plans/public`
- Frontend missing HSTS header

### Security

- JWT audience claim `onebrain-api` on sign + verify (prevents token misuse across services)
- Upload filename sanitization: `basename()` + regex + 200-char limit (path traversal prevention)
- SSRF DNS pinning: custom `pinnedLookup` callback prevents rebinding between check and fetch
- Rate limiting on `POST /v1/consents` (10/min)
- `.claude/` added to `.gitignore`
- ETag hash upgraded from MD5 to SHA-256
- Connect prompt compacted from ~450 to ~120 tokens (reduced data exposure)

### Changed

- Nav item renamed: Integrationen → KI-Integration (DE), AI Integration (EN), IA-Integracion (ES)
- Connect routes rewritten: single context engine call, no duplicate brain export data
- Cache-Control on connect endpoint changed from `no-store` to `private, max-age=60`

### Documentation

- SECURITY-AUDIT.md updated with 7 new fixes (17 total)
- DSGVO-REPORT.md updated with security changelog and new TOMs

## [1.7.0] - 2026-03-21

### Added

- SSRF protection on URL ingestion (DNS resolution + private IP range blocking)
- Missing database migration for 7 tables + 10 columns + 2 enums (audit_logs, consents, subscriptions, tags, memory_tags, file_uploads, notification_preferences)
- Docker memory limits: postgres 1G, redis 512M, api 512M, web 256M
- Caddy healthcheck (wget to localhost:80)
- Comprehensive DSGVO-REPORT.md (13 sections, 71 TOM measures)
- Comprehensive README.md with full architecture documentation
- CHANGELOG.md updated through v1.7.0

### Fixed

- `ingest.service.ts` fetch() called without URL validation (SSRF vulnerability)
- Prisma schema ↔ migration drift: 7 tables and multiple columns defined in schema but missing from SQL migrations
- Docker containers missing memory limits (postgres, redis in region stacks)
- Control-plane caddy missing healthcheck

### Security

- SSRF: `assertPublicUrl()` validates protocol, resolves DNS, blocks RFC1918/loopback/link-local IPs
- Fetch redirects set to `manual` to prevent SSRF via redirect chains

## [1.6.0] - 2026-03-21

### Added

- Password authentication (register + login with bcrypt hashing)
- TOTP two-factor authentication (setup, verify, disable)
- Session management UI and API (list sessions, revoke by ID)
- OAuth 2.0 Google login (ID token verification via JWKS)
- Tag system (create tags, tag memories, remove tags)
- URL and file ingestion endpoints (PDF, text, with AI extraction)
- Notification preferences (email, push, per-category settings)
- Onboarding flow page
- Integrations page
- Usage analytics page with usage meter component
- Billing page with Stripe checkout/portal integration
- Plan badge component in dashboard header
- Keyboard shortcuts for power users
- Social sharing component
- OpenAPI specification endpoint (GET /v1/openapi.json)
- Legal API endpoints (GET /v1/legal/impressum, datenschutz, agb)
- Connect routes for external integrations
- Export routes (JSON, Markdown, AI prompt)
- Require-verified-email middleware
- PII masking utility for logs (maskEmail, maskIp)
- Webhook signature verification utility
- Cache utility layer
- Metrics/telemetry utility
- Prisma JSON helper utilities
- i18n pluralization support with tests
- 16 new test files (security, GDPR, Stripe, PII, i18n, integration tests)

### Changed

- Auth tokens moved from localStorage to httpOnly cookies (XSS mitigation)
- CSRF protection added via X-Requested-With header
- Web app upgraded to PWA with service worker and manifest
- 238 tests total (up from 149)

## [1.5.0] - 2026-03-20

### Added

- Helmet.js security headers (CSP, HSTS, X-Frame-Options DENY, noSniff)
- Admin role system (UserRole enum, requireAdmin middleware, JWT role claim)
- Persistent audit logging to database (AuditLog model, fire-and-forget writes)
- Cookie consent banner with 3 categories (necessary, statistics, marketing)
- Consent storage with timestamp, version, and IP hash for audit trail
- Legal pages: Impressum, Datenschutz, AGB (DE/EN/ES)
- GDPR data export endpoint (GET /v1/user/export, 14 data categories)
- Account deletion endpoint (DELETE /v1/user, soft delete with 30-day grace)
- Data retention automation (sessions 30d, magic links 24h, usage 24mo, audit 90d)
- Stripe billing integration (checkout, portal, subscription management, webhooks)
- Subscription model with status tracking (active, past_due, canceled, trialing)
- Conditional route registration (billing routes only when Stripe configured)
- Pricing page with plan comparison and monthly/yearly toggle
- Landing page updated for SaaS positioning
- Footer legal links on all pages
- Referrer policy and security header improvements
- Rate limiting per-user keying via userId
- Database tables: audit_logs, consents, subscriptions (5 new migrations)
- Stripe customer ID on User model
- Plan pricing fields (monthly, yearly, Stripe price IDs)
- 30 new tests for security, GDPR, and billing

### Changed

- Landing page messaging: "AI Memory Layer" (no longer "Self-hosted" only)
- Feature card: "Private & Secure" instead of "Self-Hosted & Private"
- Footer: "AI Memory Layer" instead of "Self-hosted AI memory layer"
- Global rate limit: 600/min authenticated, write endpoints 30/min

## [1.4.0] - 2026-03-20

### Added

- Shareable brain snapshots with expiring share tokens and view counting
- Brain export in JSON format (GET /v1/export/json)
- Brain export in Markdown format (GET /v1/export/markdown)
- AI export prompt generator (GET /v1/export/ai-prompt)
- Referral system: create codes (POST /v1/referrals), complete referrals, list referrals
- Public share viewer (GET /v1/shares/:token, no auth required)
- Sensitive field stripping for public snapshots (IDs, timestamps removed)
- Share expiration enforcement (expired shares return 404)
- 15 new viral & growth tests (149 total passing)

## [1.3.0] - 2026-03-20

### Added

- Monetization core: database-driven plans with limits and features
- Plan service: `getPeriodStart()`, `isWithinLimit()`, `resolveFeatureValue()`, `isFeatureEnabled()`, `getActivePlan()`
- Usage service: `trackUsage()`, `getUsageCount()`, `getUsageSummary()` with period-based aggregation
- Limit enforcement middleware: `enforcePlanLimit()` checks plan limits before route execution
- Admin routes for plan CRUD: GET/POST/PATCH `/v1/admin/plans`, limits, and features
- Admin usage endpoint: GET `/v1/admin/usage/:userId`
- Default free plan with limits (100 context/month, 50 writes/month, 20 extracts/month)
- Plan features: max_context_depth, allow_deep_context, max_entities_in_context, priority_processing
- Database tables: plans, plan_limits, plan_features, user_plans, usage_events
- 13 new monetization tests (134 total passing)

## [1.2.0] - 2026-03-19

### Added

- Identity-always-included rule: profile is never dropped during compression
- Token tracking: `tokensUsed` and `tokensEstimated` in context metadata
- Section priority trimming order: stats → projects → entities → memories (identity never trimmed)
- `identityIncluded` flag in context metadata
- `SECTION_PRIORITY` constant for explainable trimming order
- 3 new context engine tests (121 total passing)

## [1.1.0] - 2026-03-19

### Added

- Context Engine for optimized LLM context delivery
- 4 context scopes: brief (500 tokens), assistant (2K), project (3K), deep (8K)
- Deterministic relevance scoring (source priority + confidence + recency)
- Scope-based filtering with configurable item limits per scope
- Token-budget compression (progressive body truncation, description removal, item dropping)
- LLM-optimized text formatting (markdown-style, no IDs/timestamps)
- Structured JSON output with metadata (token estimate, truncation flag, item counts)
- Sensitive field redaction (IDs, timestamps stripped from output)
- API key scope enforcement on context endpoint (brain.read required)
- Content negotiation: Accept text/plain returns formatted text, default returns JSON envelope
- GET /v1/context/:scope endpoint with X-Token-Estimate and X-Truncated headers
- 37 new unit tests (118 total passing)

## [1.0.0] - 2026-03-19

### Added

- Docker multi-stage builds for API, Web, and MCP (non-root user, minimal images)
- Docker Compose: control-plane (Caddy + Web), EU region (API + PostgreSQL + Redis + MCP), GLOBAL region (isolated)
- Caddyfile with auto-HTTPS, security headers, compression, region-based API routing
- Region isolation: separate networks, databases, and compose files for EU and GLOBAL
- Environment templates (.env.example) for control-plane, EU, GLOBAL, and root
- Migration service for automatic Prisma migrate on deployment
- .dockerignore for optimized build context
- Updated root .env.example with all configuration options

## [0.9.0] - 2026-03-19

### Added

- Web app with 9 pages: login, region selection, dashboard, memory, entities, projects, API keys, daily question
- Auth flow: magic link email entry, token verification, region selection
- Dashboard overview with stats (memories, entities, projects) and recent memories
- Memory list with type/status filters and cursor-based pagination
- Entities and projects lists with pagination
- API key management (create, list, revoke with one-time secret display)
- Daily question UI (view question, submit answer)
- Language switcher (DE/EN/ES) with localStorage persistence
- i18n: all user-facing text via translation keys, updated DE/EN/ES locale files
- Responsive CSS modules (mobile breakpoint at 768px)
- Sidebar navigation with mobile hamburger toggle
- Version badge (v0.9.0) at bottom-right
- AuthContext with client-side translation support

## [0.8.0] - 2026-03-19

### Added

- Daily learning loop with deterministic question generation (no LLM)
- Question templates for all 6 memory types (fact, preference, goal, experience, decision, skill)
- Answer parsing with keyword-based memory type detection
- Answer → candidate memory conversion with source event tracking
- Today's question endpoint (GET /v1/daily-question/today)
- Answer submission endpoint (POST /v1/daily-question/:id/answer)
- Question history with cursor-based pagination (GET /v1/daily-question)
- 11 new unit tests (81 total passing)

## [0.7.0] - 2026-03-19

### Added

- MCP server with stdio transport (@modelcontextprotocol/sdk)
- 6 MCP tools: get_user_context, search_memory, write_memory, upsert_entity, get_project_context, get_daily_question
- HTTP API client (all MCP tools delegate to REST API, no duplicated logic)
- API key authentication for MCP-to-API communication
- Zod-validated tool parameters
- Error handling with structured error responses

## [0.6.0] - 2026-03-19

### Added

- API key creation with prefix-based identification (ob\_ prefix + SHA-256 hashed secret)
- API key listing with cursor-based pagination
- API key revocation (DELETE /v1/api-keys/:id)
- Scope enforcement middleware (brain.read, brain.write, memory.extract.write, entity.read, entity.write)
- Dual auth: Bearer JWT + ApiKey header supported in auth middleware
- requireScope() middleware factory for scope-protected routes
- Zod validation schema for API key creation
- 14 new unit tests (70 total passing)

## [0.5.0] - 2026-03-19

### Added

- Deterministic merge engine (no ML, no embeddings, fully explainable)
- Text normalization (trim, collapse whitespace, preserve casing)
- String similarity via Dice coefficient (bigram overlap)
- Duplicate detection (same type + similar title + similar body)
- Conflict detection (same type + similar topic + contradictory body)
- Confidence handling (base by source type, boost on agreement, decrease on conflict)
- Category priority (user_confirmed > user_input > system_inference > ai_extraction)
- Brain version snapshots after each merge (canonical state + merge log)
- Merge API endpoints (POST /v1/merge/run, GET /v1/merge/history)
- Merge explainability log (action, memoryIds, reason per merge action)
- 38 new unit tests (56 total passing)

## [0.4.0] - 2026-03-19

### Added

- Brain profile endpoints (GET/PUT /v1/brain/profile)
- Brain context endpoint (GET /v1/brain/context) — projection layer with profile, memories, entities, projects, stats
- Memory CRUD (GET/POST/PATCH/DELETE /v1/memory, GET /v1/memory/:id)
- Memory extraction endpoint (POST /v1/memory/extract) — creates candidate memory + source event
- Entities CRUD with entity links (GET/POST/PATCH/DELETE /v1/entities, POST /v1/entities/:id/links)
- Projects CRUD with memory links (GET/POST/PATCH/DELETE /v1/projects, POST /v1/projects/:id/memory-links)
- Cursor-based pagination on all list endpoints (default 20, max 100)
- Zod validation schemas for brain, entity, project inputs
- Audit logging for all CRUD operations
- 18 unit tests passing

## [0.3.0] - 2026-03-19

### Added

- Magic link authentication (request, verify, one-time use, expiration)
- JWT access tokens (15min) and refresh tokens (7d, httpOnly cookie)
- Session management (create, refresh, logout, logout-all)
- Region selection endpoint (POST /v1/auth/region)
- Current user endpoint (GET /v1/auth/me)
- Auth middleware (Bearer token verification)
- Rate limiting on auth endpoints (5 req/min for magic-link, 600/min global)
- CORS and cookie plugins for Fastify
- Mail service for sending magic link emails (nodemailer)
- Token utilities (SHA-256 hashing, jose JWT)
- Response helpers (success/error envelope)
- 14 unit tests for tokens and response helpers

## [0.2.0] - 2026-03-19

### Added

- Database package (`@onebrain/db`) with Prisma ORM
- Full PostgreSQL schema with 13 tables: users, brain_profiles, memory_items, entities, entity_links, projects, project_memory_links, brain_versions, source_events, magic_link_tokens, sessions, api_keys, daily_questions
- 6 PostgreSQL enums: Region, Locale, MemoryType, MemoryStatus, SourceType, ProjectStatus
- All foreign key constraints with CASCADE on delete
- Composite indexes for common query patterns
- Unique constraints (user email, entity per user, version per user)
- Initial migration SQL
- Seed script with demo data
- SourceEvent and DailyQuestion types in shared package

## [0.1.0] - 2026-03-19

### Added

- Monorepo structure with pnpm workspaces
- TypeScript configuration (strict mode, ES2022 target)
- ESLint + Prettier configuration
- Shared types package (`@onebrain/shared`) with all core type definitions
- Validation schemas package (`@onebrain/schemas`) with zod schemas
- i18n package (`@onebrain/i18n`) with DE/EN/ES translations
- API app stub with Fastify health check endpoint
- Web app stub with Next.js 15
- MCP server placeholder
- Infrastructure directory structure (control-plane, region-eu, region-global)
