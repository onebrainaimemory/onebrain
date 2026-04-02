# OneBrain v1.10.0 — Feature List

Last updated: 2026-04-02

## Legend

- [x] = Done and working
- [ ] = Planned / Not yet implemented
- [~] = In progress / Partial

---

## 1. Authentication & Authorization

### Magic Link Login

- [x] Request magic link via email (POST /v1/auth/magic-link)
- [x] Verify magic link token, one-time use (POST /v1/auth/verify)
- [x] Magic link expiration enforcement
- [x] Token hashing with SHA-256 before storage
- [x] Rate limiting on magic link requests (5/min)
- [x] i18n-aware success/error messages

### Session Management

- [x] JWT access tokens (15min, httpOnly cookie)
- [x] JWT refresh tokens (7d, httpOnly cookie, path-scoped to /v1/auth)
- [x] Token refresh endpoint (POST /v1/auth/refresh)
- [x] Logout current session (POST /v1/auth/logout)
- [x] Logout all sessions (POST /v1/auth/logout-all)
- [x] Cookie clearing on logout
- [x] CSRF protection via X-Requested-With header for cookie auth

### User & Region

- [x] Region selection after first login (POST /v1/auth/region)
- [x] Current user endpoint (GET /v1/auth/me)
- [x] Region enum: EU, GLOBAL
- [x] Locale enum: de, en, es

### Auth Middleware

- [x] Bearer JWT authentication
- [x] ApiKey header authentication (dual auth support)
- [x] httpOnly cookie fallback for browser sessions
- [x] Scope enforcement middleware (requireScope)
- [x] Admin role enforcement middleware (requireAdmin) with JWT fast-path + DB fallback

### Demo Login

- [x] Demo admin login (dev only, POST /v1/auth/demo-login)
- [x] Demo user login (dev only, POST /v1/auth/demo-user-login)
- [x] Production guard: demo routes not registered in production

### OAuth Login

- [x] OAuth 2.0 Google login (POST /v1/auth/oauth/google, ID token verification via JWKS)
- [x] OAuth 2.0 Apple login (POST /v1/auth/oauth/apple, ID token verification via JWKS)
- [x] Auto-create or link existing user by email
- [x] Conditional registration (disabled when env vars not configured)

### Email Verification

- [x] Email verification token generation on registration
- [x] Verify email endpoint (POST /v1/auth/verify-email)
- [x] Resend verification email endpoint
- [x] requireVerifiedEmail middleware

### Password-Based Login

- [x] User registration with email + password (POST /v1/auth/register)
- [x] Password login (POST /v1/auth/login) with bcrypt verification
- [x] Password hashing with bcrypt (cost factor 12)
- [x] 2FA integration: returns tempToken when TOTP enabled

### Two-Factor Authentication (2FA)

- [x] TOTP setup with QR code generation (POST /v1/auth/2fa/setup)
- [x] TOTP verification and enable (POST /v1/auth/2fa/verify)
- [x] TOTP disable (POST /v1/auth/2fa/disable)
- [x] TOTP login validation (POST /v1/auth/2fa/validate)
- [x] Pure RFC 6238 implementation using node:crypto (no external deps)
- [x] Constant-time comparison for security

### Session Management

- [x] Session device tracking (deviceName, ipAddress, userAgent)
- [x] List active sessions (GET /v1/auth/sessions)
- [x] Revoke individual session (DELETE /v1/auth/sessions/:id)
- [x] Session management page in web UI (/dashboard/sessions)

---

## 2. Brain Profile

- [x] Get brain profile (GET /v1/brain/profile)
- [x] Update brain profile (PUT /v1/brain/profile)
- [x] Brain context projection (GET /v1/brain/context) — profile + memories + entities + projects + stats
- [x] Profile summary (free text)
- [x] Traits (JSON key-value)
- [x] Preferences (JSON key-value)
- [x] Zod validation on profile updates
- [x] Scope enforcement (brain.read, brain.write)
- [x] Brain profile page in web UI with summary, traits, preferences editing
- [x] Context preview in UI (shows what AI tools see)
- [x] Brain stats display (memory/entity/project counts)

---

## 3. Memory System

### CRUD Operations

- [x] List memories with filters (GET /v1/memory) — type, status filters
- [x] Get single memory (GET /v1/memory/:id)
- [x] Create memory (POST /v1/memory)
- [x] Update memory (PATCH /v1/memory/:id)
- [x] Delete memory (DELETE /v1/memory/:id)
- [x] Cursor-based pagination (default 20, max 100)
- [x] Zod validation on create/update

### Memory Types

- [x] fact
- [x] preference
- [x] decision
- [x] goal
- [x] experience
- [x] skill

### Memory Statuses

- [x] active
- [x] candidate (AI-suggested, pending review)
- [x] archived
- [x] conflicted

### Source Types

- [x] user_input
- [x] system_inference
- [x] ai_extraction
- [x] user_confirmed

### Memory Extraction

- [x] Extract memory endpoint (POST /v1/memory/extract) — creates candidate + source event
- [x] Scope enforcement (memory.extract.write)
- [x] Confidence scoring on extracted memories

### Web UI

- [x] Memory list with type/status filter dropdowns
- [x] Pagination controls
- [x] Create/edit memory modal
- [x] Delete confirmation
- [x] Memory type color coding

### Full-Text Search

- [x] Search parameter on memory list API (case-insensitive title + body)
- [x] Search across all memory fields

### Tagging System

- [x] Tag CRUD endpoints (GET/POST /v1/tags, DELETE /v1/tags/:id)
- [x] Add/remove tags on memories (POST/DELETE /v1/memory/:id/tags)
- [x] Tag model with userId + name + color, unique per user
- [x] MemoryTag junction table with unique constraint

### Import & Export

- [x] Memory import from file (POST /v1/memory/import) — CSV, JSON batch import
- [x] File upload ingestion (POST /v1/memory/upload) — TXT, CSV, JSON, PDF, DOCX
- [x] Zod-validated import schema (max 500 items)

### Deduplication

- [x] Duplicate scanning endpoint (GET /v1/memory/duplicates)
- [x] Memory deduplication UI (manual review of duplicates)
- [x] Similarity scoring via Dice coefficient

### Timeline

- [x] Memory timeline/history view in web UI
- [x] Date-based grouping with visual timeline
- [x] Card and timeline view modes

---

## 4. Knowledge Management (Ingest)

- [x] Knowledge overview dashboard (type distribution chart, recent activity)
- [x] Quick add memory form (title, body, type selection)
- [x] Bulk import from text (paste text, segment into cards)
- [x] Memory card editor (title, body, type per card, include/exclude toggle)
- [x] Select all / deselect all cards
- [x] Add empty card manually
- [x] Remove individual cards
- [x] Batch save selected cards
- [x] Candidate review section (approve/dismiss AI-suggested memories)
- [x] Confidence bar display on candidates
- [x] Source type badges (AI Suggested, User Added)
- [x] Toast notifications for success/error

### Advanced Ingestion

- [x] AI-powered extraction from pasted text (POST /v1/memory/ai-extract) — LLM-based via Gemini/OpenAI
- [x] File upload ingestion (POST /v1/memory/upload) — TXT, CSV, JSON, PDF, DOCX with 10MB limit
- [x] URL/webpage ingestion (POST /v1/memory/ingest-url) — fetches and parses webpage content
- [x] Chat transcript parsing (POST /v1/memory/parse-chat) — auto, user-assistant, timestamp formats

---

## 5. Entity Management

### CRUD Operations

- [x] List entities with type filter (GET /v1/entities)
- [x] Get single entity (GET /v1/entities/:id)
- [x] Create entity (POST /v1/entities)
- [x] Update entity (PATCH /v1/entities/:id)
- [x] Delete entity (DELETE /v1/entities/:id)
- [x] Cursor-based pagination

### Entity Links

- [x] Add entity-memory link (POST /v1/entities/:id/links)
- [x] Remove entity-memory link (DELETE /v1/entities/:entityId/links/:linkId)
- [x] Link types (custom string)
- [x] Unique constraint on entity-memory-linkType combo

### Entity Types

- [x] Free-form type string (person, place, concept, tool, etc.)
- [x] Unique constraint per user (name + type)

### Web UI

- [x] Entities list page with pagination
- [x] Create/edit entity modal
- [x] Delete confirmation
- [x] Linked memories display

### Advanced Features

- [x] Entity relationship graph visualization (EntityGraph component in dashboard)
- [x] Auto-entity extraction from memories (heuristic NLP: proper nouns, labeled patterns, URLs)
- [x] Entity merge/dedup (POST /v1/entities/merge — moves links, deduplicates)

---

## 6. Project Management

### CRUD Operations

- [x] List projects with status filter (GET /v1/projects)
- [x] Get single project (GET /v1/projects/:id)
- [x] Create project (POST /v1/projects)
- [x] Update project (PATCH /v1/projects/:id)
- [x] Delete project (DELETE /v1/projects/:id)
- [x] Cursor-based pagination

### Project-Memory Links

- [x] Add project-memory link (POST /v1/projects/:id/memory-links)
- [x] Remove project-memory link (DELETE /v1/projects/:projectId/memory-links/:linkId)
- [x] Link types (custom string)
- [x] Unique constraint on project-memory-linkType combo

### Project Statuses

- [x] active
- [x] archived
- [x] completed

### Web UI

- [x] Projects list page with pagination
- [x] Create/edit project modal
- [x] Delete confirmation
- [x] Linked memories display

---

## 7. Context Engine

### Core Pipeline

- [x] Context Builder (orchestrates score -> filter -> compress -> format)
- [x] Deterministic relevance scoring (source priority + confidence + recency)
- [x] Scope-based filtering with configurable item limits

### Context Scopes

- [x] brief (500 tokens) — quick lookups
- [x] assistant (2K tokens) — general AI assistant
- [x] project (3K tokens) — project-focused context
- [x] deep (8K tokens) — deep analysis

### Compression

- [x] Token-budget enforcement per scope
- [x] Progressive body truncation
- [x] Description removal under budget pressure
- [x] Item dropping by priority
- [x] Section priority trimming (stats -> projects -> entities -> memories)
- [x] Identity-always-included rule (profile never dropped)

### Output

- [x] LLM-optimized markdown formatting (no IDs/timestamps)
- [x] Structured JSON output with metadata
- [x] Token estimate in response metadata
- [x] Truncation flag in response metadata
- [x] identityIncluded metadata flag
- [x] Content negotiation (Accept: text/plain for raw text, JSON envelope default)
- [x] X-Token-Estimate and X-Truncated response headers

### API

- [x] GET /v1/context/:scope endpoint
- [x] Scope enforcement (brain.read required)
- [x] Audit logging on context reads

---

## 8. Connect URL (AI Integration)

### Connect URL Endpoint

- [x] GET /v1/connect/:apiKey — universal AI context endpoint (plain text + JSON)
- [x] API key validated via timing-safe hash comparison
- [x] Requires connect.read scope
- [x] Rate limited: 30/min per key prefix
- [x] Builds system prompt combining brain profile + context engine output
- [x] Security headers (Cache-Control: no-store, Referrer-Policy: no-referrer)
- [x] Audit logging on connect reads

### Connect Write-Back

- [x] POST /v1/connect/:apiKey/memory — AI write-back endpoint
- [x] Requires connect.write scope
- [x] Creates memory as candidate (user must review/approve)
- [x] Rate limited: 10/min per key prefix
- [x] Zod validation on request body

### MCP Protocol Server

- [x] MCP server with stdio transport (@modelcontextprotocol/sdk)
- [x] get_user_context tool (full brain context via REST API)
- [x] search_memory tool (filter by type/status, paginated)
- [x] write_memory tool (extract memory via REST API)
- [x] upsert_entity tool (find-or-create entity)
- [x] get_project_context tool (single project or active list)
- [x] get_daily_question tool (daily learning question)
- [x] API key authentication for MCP-to-API communication
- [x] Zod-validated tool parameters
- [x] Docker container (Dockerfile.mcp)

### Integrations UI

- [x] Connect URL page with one-click URL generation
- [x] Connect URL copy + setup instructions (ChatGPT, Claude, Gemini)
- [x] MCP Protocol setup instructions with config snippet
- [x] REST API usage examples with curl commands
- [x] System Prompt export (generate + copy)
- [x] Code blocks with copy buttons
- [x] Existing connect keys display

### OpenAPI Specification

- [x] GET /v1/openapi.json — public OpenAPI 3.1 spec
- [x] Documented: connect, context, memory endpoints
- [x] ChatGPT Actions / function-calling AI discovery support
- [x] Cache-Control: public, max-age=3600

---

## 9. API Key Management

- [x] Create API key (POST /v1/api-keys) with named key + scope selection
- [x] Key format: ob_PREFIX_SECRET (prefix-based identification)
- [x] Secret hashed with SHA-256 before storage
- [x] One-time secret display (never shown again)
- [x] List API keys (GET /v1/api-keys) with cursor-based pagination
- [x] Revoke API key (DELETE /v1/api-keys/:id)
- [x] Key expiration support (expiresAt field)
- [x] Last used tracking (lastUsedAt field)
- [x] Scopes: connect.read, connect.write, brain.read, brain.write, memory.extract.write, entity.read, entity.write
- [x] Web UI: API keys page (create, list, revoke, scope checkboxes)
- [x] Zod validation on key creation

---

## 10. Merge Engine

### Core Algorithm

- [x] Text normalization (trim, collapse whitespace)
- [x] String similarity via Dice coefficient (bigram overlap)
- [x] Duplicate detection (same type + similar title >= 0.6 + similar body >= 0.5)
- [x] Conflict detection (same type + similar topic + contradictory body)
- [x] Confidence handling (base by source type, boost on agreement, decrease on conflict)
- [x] Category priority sorting (user_confirmed > user_input > ai_extraction > system_inference)

### Merge Actions

- [x] Archive lower-confidence duplicate
- [x] Boost confidence for kept duplicate (agreement count)
- [x] Mark conflicting memories as conflicted
- [x] Activate clean candidates (no duplicates, no conflicts)

### Versioning

- [x] Brain version snapshots after each merge (brain_versions table)
- [x] Version number auto-increment per user
- [x] Snapshot includes active memories + merge log

### API

- [x] Trigger merge (POST /v1/merge/run)
- [x] Merge history with pagination (GET /v1/merge/history)
- [x] Explainability log per merge (action, memoryIds, reason, timestamp)
- [x] Audit logging on merge operations

### Advanced Merge Features

- [x] Auto-merge on new candidate creation (autoMergeCandidate runs on extraction)
- [x] Conflict resolution UI (side-by-side comparison, keep left/right/both)
- [x] Merge undo / version rollback (POST /v1/merge/rollback/:version, brain version snapshots)

---

## 11. Admin Dashboard

### Plan Management

- [x] List all plans (GET /v1/admin/plans)
- [x] Create plan (POST /v1/admin/plans)
- [x] Update plan (PATCH /v1/admin/plans/:id)
- [x] Plan limits CRUD (GET/POST /v1/admin/plans/:id/limits, PATCH /v1/admin/plan-limits/:id)
- [x] Plan features CRUD (GET/POST /v1/admin/plans/:id/features, PATCH /v1/admin/plan-features/:id)
- [x] Admin plans list page with user counts
- [x] Plan detail page with settings, limits, and features tabs

### User Management

- [x] List all users with plan info (GET /v1/admin/users)
- [x] Update user (PATCH /v1/admin/users/:id) — activate/deactivate, change plan, change role
- [x] Admin users page with user table
- [x] User counts: memories, entities, projects, usage events per user

### Usage Monitoring

- [x] Usage summary per user (GET /v1/admin/usage/:userId)
- [x] Period-based aggregation (monthly, weekly, daily)

### Audit Logs

- [x] Persisted audit logs in database (audit_logs table)
- [x] Admin audit log viewer (GET /v1/admin/audit-logs)
- [x] Filter by userId
- [x] Cursor-based pagination
- [x] Admin audit page in web UI

### Access Control

- [x] requireAuth + requireAdmin hooks on all admin routes
- [x] Admin-only navigation item (hidden for non-admins)

---

## 12. Billing & Monetization

### Plans

- [x] Database-driven plans (plans table with limits + features)
- [x] Plan limits with period support (monthly, weekly, daily)
- [x] Plan features as key-value pairs
- [x] User plan assignment (user_plans with activation/expiration)
- [x] Default free plan with limits (100 context/month, 50 writes/month, 20 extracts/month)
- [x] Public plans endpoint (GET /v1/plans/public, no auth)
- [x] Feature flags via plan (resolveFeatureValue, isFeatureEnabled)

### Usage Tracking

- [x] Usage event tracking (usage_events table)
- [x] Token usage counting
- [x] Usage summary endpoint (GET /v1/user/usage-summary)
- [x] Usage meter component in sidebar with progress bars
- [x] Plan badge component showing current plan

### Limit Enforcement

- [x] enforcePlanLimit middleware (checks plan limits before route execution)
- [x] Returns 429 with plan-specific error message on limit exceeded
- [x] Period-aware limit checking (monthly/weekly/daily)

### Stripe Integration

- [x] Stripe customer creation (getOrCreateStripeCustomer)
- [x] Checkout session creation (POST /v1/billing/checkout)
- [x] Customer portal session (GET /v1/billing/portal)
- [x] Subscription status endpoint (GET /v1/billing/subscription)
- [x] Plan upgrade/downgrade (POST /v1/billing/change-plan) with proration
- [x] Webhook handler (POST /v1/webhooks/stripe) with signature verification
- [x] Webhook events: checkout.session.completed, subscription.updated/deleted, invoice.payment_succeeded/failed
- [x] Idempotent webhook processing (DB-based via AuditLog)
- [x] Subscription sync (syncSubscription service)
- [x] Lazy-loaded Stripe instance (only when configured)

### Pricing UI

- [x] Pricing page with plan cards
- [x] Monthly/yearly toggle with savings display
- [x] Plan feature list display
- [x] Checkout flow (redirect to Stripe)
- [x] Self-hosted option card

### Trial & Promotions

- [x] Trial period support (trialing status, trialDays on Plan, trial_period_days in Stripe checkout)
- [x] Coupon/promo code support (POST /v1/billing/apply-coupon, Stripe coupon validation)

### Invoice & Analytics

- [x] Invoice history (GET /v1/billing/invoices, Stripe invoice list with PDF links)
- [x] Invoice history UI in billing dashboard page
- [x] Usage analytics dashboard (/dashboard/usage) with period-based aggregation

---

## 13. DSGVO/GDPR Compliance

### Data Subject Rights

- [x] Account deletion with 30-day grace period (DELETE /v1/user, Art. 17)
- [x] Account restoration during grace period (POST /v1/user/restore)
- [x] Full data export (GET /v1/user/export, Art. 15/20) — all data categories (user, profile, memories, entities, projects, usageEvents, consents, dailyQuestions, referrals, auditLogs, brainVersions, sourceEvents, brainShares, subscriptions)
- [x] Rate limiting on export (1 per hour)

### Data Retention

- [x] Retention service with defined periods:
  - Sessions: 30 days after expiry
  - MagicLinkTokens: expired tokens cleaned immediately (by expiresAt)
  - UsageEvents: 24 months
  - AuditLogs: 90 days
  - SourceEvents: 12 months (processed)
  - BrainShares: 90 days after expiry
  - Soft-deleted users: 30 days -> hard delete
- [x] Hard delete via retention cleanup job (cascading)

### Consent Management

- [x] Cookie consent banner with 3 categories (necessary, statistics, marketing)
- [x] Consent storage endpoint (POST /v1/consents, works pre-login)
- [x] Consent record with timestamp, version, hashed IP
- [x] Consent categories as JSON (auditable)
- [x] Accept All / Accept Selected / Necessary Only buttons
- [x] LocalStorage persistence for consent state

### Legal Pages

- [x] Impressum page (/impressum)
- [x] Datenschutzerklaerung / Privacy Policy page (/datenschutz)
- [x] AGB / Terms of Service page (/agb)
- [x] All legal content i18n-ready (DE/EN/ES)

### Privacy by Design

- [x] Soft deletes for user data (deletedAt field)
- [x] PII masking in logs (email, IP address, API keys)
- [x] IP address hashing for consent records (HMAC-SHA256)
- [x] Sensitive field stripping from public exports/shares
- [x] Data minimization (select only needed columns)

### Data Cascade

- [x] BrainShare → User onDelete: Cascade (no orphaned data after deletion)
- [x] All user-related models cascade on user deletion

### Encryption & Retention

- [x] Database encryption at rest documentation (docs/encryption-at-rest.md, TLS in transit, volume encryption)
- [x] Automated retention job scheduling (setInterval every 6h in app.ts onReady hook)

### DSGVO Audit & DPA

- [x] DSGVO audit report generation (GET /v1/admin/dsgvo-report, generateDsgvoReport service)
- [x] Data processing agreement endpoint (GET /v1/legal/dpa) — full DPA in DE/EN/ES

---

## 14. Security

### Authentication Security

- [x] JWT with short-lived access tokens (15min)
- [x] httpOnly, Secure, SameSite=Strict cookies
- [x] CSRF protection via X-Requested-With header
- [x] Timing-safe API key comparison (SHA-256 hash)
- [x] Session-based token invalidation on logout

### Rate Limiting

- [x] Auth endpoints: 5 req/min (magic link), 10 req/15min (verify), 20 req/15min (refresh)
- [x] Write endpoints: 30 req/min
- [x] Connect read: 30 req/min per key
- [x] Connect write: 10 req/min per key
- [x] Billing endpoints: 30 req/min
- [x] Data export: 1 req/hour
- [x] Global rate limiting via Fastify plugin

### HTTP Security Headers

- [x] @fastify/helmet: CSP, HSTS, X-Frame-Options DENY, noSniff, Referrer-Policy
- [x] CSP directives: defaultSrc, scriptSrc, styleSrc, imgSrc, connectSrc, fontSrc, objectSrc, frameAncestors, formAction, upgradeInsecureRequests
- [x] Caddy: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- [x] Caddy: Referrer-Policy strict-origin-when-cross-origin
- [x] Caddy: HSTS with preload (max-age=63072000)
- [x] Caddy: Server header removed
- [x] Connect endpoints: Cache-Control no-store, Referrer-Policy no-referrer

### Input Validation

- [x] Zod schemas on all API inputs (auth, brain, memory, entity, project, API keys)
- [x] Zod schemas on all admin PATCH routes (.strict() — no mass assignment)
- [x] Zod schemas on billing routes (priceId validated against DB plans)
- [x] Consistent error envelope: { error: { code, message, details } }
- [x] Parameterized DB queries (Prisma ORM, no raw SQL interpolation)

### PII Protection

- [x] Email masking in logs (u***@e***.com)
- [x] IP masking in logs (192.168.x.x)
- [x] API key masking in URL logs (/v1/connect/ob_abc\*\*\*)
- [x] Fastify request serializer with PII masking

### Infrastructure Security

- [x] Docker containers run as non-root user (uid 1001)
- [x] Multi-stage Docker builds (minimal production images)
- [x] SSH hardening (key-only, no root login, MaxAuthTries 3)
- [x] UFW firewall (ports 22, 80, 443 only)
- [x] Automatic security updates on VPS
- [x] Install script lock file (prevents re-run)

### Audit Trail

- [x] Audit logging on all CRUD operations
- [x] Audit logging on auth events
- [x] Audit logging on billing events
- [x] Audit logging on export/share actions
- [x] In-memory + DB-persisted audit logs
- [x] Webhook idempotency via audit log

### Additional Security

- [x] CORS explicit origins in production (parseCorsOrigins rejects wildcard in prod)
- [x] Dependency audit automation (pnpm audit in CI, security-audit job in GitHub Actions)
- [x] Webhook signature verification for non-Stripe services (verifyGitHubSignature, verifyGenericHmac in webhook-verify.ts)

---

## 15. Internationalization (i18n)

### Languages Supported

- [x] Deutsch (de) — default
- [x] English (en)
- [x] Espanol (es)

### Implementation

- [x] Central language files (JSON) in packages/i18n/locales/
- [x] Key format: namespace.section.key (e.g., auth.login.title)
- [x] All user-facing text in translation files (no hardcoded strings)
- [x] Language switcher component (DE/EN/ES dropdown)
- [x] Locale persistence in localStorage
- [x] Server-side translation support (getTranslations, t function)
- [x] New languages addable by copying JSON file
- [x] i18n package as shared monorepo dependency (@onebrain/i18n)

### Coverage

- [x] Auth (login, verify, logout)
- [x] Onboarding (region selection)
- [x] Navigation
- [x] Dashboard
- [x] Memory management
- [x] Entity management
- [x] Project management
- [x] API keys
- [x] Brain profile
- [x] Knowledge ingest
- [x] Integrations
- [x] Admin dashboard
- [x] Pricing/Billing
- [x] Legal pages (Impressum, Privacy, Terms)
- [x] Cookie consent
- [x] Landing page
- [x] Invite links (admin + public pages)
- [x] Common actions (save, cancel, delete, etc.)
- [x] Pagination
- [x] Error messages

### Advanced i18n

- [x] RTL support (RtlProvider component, dir attribute on html, ready for ar/he/fa locales)
- [x] Locale-aware date/time/number formatting (Intl.DateTimeFormat, locale-aware formatters)
- [x] Pluralization rules (tPlural function with zero/one/other keys, i18n keys for counts)

---

## 16. Infrastructure & Deployment

### Docker

- [x] Multi-stage Dockerfile for API (deps -> build -> runner, non-root)
- [x] Multi-stage Dockerfile for Web (deps -> build -> runner, non-root)
- [x] Multi-stage Dockerfile for MCP (deps -> build -> runner, non-root)
- [x] .dockerignore for optimized build context
- [x] Docker Compose: control-plane (Caddy + Web)
- [x] Docker Compose: region-eu (API + PostgreSQL + Redis + MCP + migrate)
- [x] Docker Compose: region-global (isolated, identical stack)
- [x] Docker memory limits (512M for API)
- [x] Health checks on all services

### Reverse Proxy

- [x] Caddy with automatic HTTPS (Let's Encrypt)
- [x] Security headers in Caddyfile
- [x] Gzip + Zstd compression
- [x] Region-based API routing (/api/eu/, /api/global/)
- [x] Console logging

### Region Isolation

- [x] Separate Docker networks per region (onebrain-eu, onebrain-control)
- [x] Separate PostgreSQL databases per region
- [x] Separate Redis instances per region
- [x] No shared data between regions

### Database

- [x] PostgreSQL 16 (Alpine)
- [x] Prisma ORM with migrations
- [x] Migration service in Docker Compose (runs before API starts)
- [x] Connection pooling via Prisma connection params (connection_limit=20, pool_timeout=10)
- [x] Query timeouts (statement_timeout=5000ms)
- [x] Comprehensive indexes (FK columns, WHERE/ORDER BY columns, composite)
- [x] Seed script with demo data

### CI/CD

- [x] GitHub Actions CI: lint, typecheck, test, build (3 parallel jobs)
- [x] GitHub Actions Deploy: wait-for-CI gate, deploy control-plane, deploy region-eu
- [x] Concurrency control (CI cancels in-progress, deploy queues)
- [x] SSH-based deployment to Hetzner VPS
- [x] Health check verification after deploy
- [x] Deployment summary notification

### Scripts

- [x] autoinstaller.sh — full VPS setup (SSH hardening, firewall, Docker, user, clone, .env, compose up, lock)
- [x] deploy-hetzner.sh — manual SSH deploy with rollback support, dry-run mode
- [x] Environment templates (.env.example for each component)

### Monorepo

- [x] pnpm workspaces
- [x] Turborepo for parallel builds
- [x] Shared packages: @onebrain/shared, @onebrain/schemas, @onebrain/i18n, @onebrain/db
- [x] TypeScript strict mode (ES2022 target)
- [x] ESLint + Prettier configuration

### Caching & Performance

- [x] Redis caching (cache.ts with get/set/del, lazy-loaded Redis with in-memory fallback)
- [x] Read replicas documentation (infra config, managed service recommended)

### Deployment & Operations

- [x] Blue-green deployment strategy (--blue-green flag in deploy-hetzner.sh)
- [x] Monitoring/alerting (GET /v1/admin/metrics — request count, error count, P50/P95/P99 response times)
- [x] Log aggregation (docker-compose.logging.yml with Loki)
- [x] Backup automation (scripts/backup-postgres.sh, pg_dump + gzip, 30-day retention)
- [x] Region-global deployment in CI (deploy-region-global job in deploy.yml)

---

## 17. Export & Sharing

### Brain Export

- [x] Export as JSON (GET /v1/export/json)
- [x] Export as Markdown (GET /v1/export/markdown)
- [x] AI system prompt generation (GET /v1/export/ai-prompt)
- [x] Full data export for GDPR (GET /v1/user/export)
- [x] Sensitive field stripping from exports (IDs, timestamps)

### Brain Shares

- [x] Create shareable brain snapshot (POST /v1/shares)
- [x] View shared brain (GET /v1/shares/:token, no auth)
- [x] Share token generation (ob-share- prefix)
- [x] Configurable expiration (expiresInHours)
- [x] View count tracking
- [x] Expired share enforcement (returns 404)

### Referral System

- [x] Create referral code (POST /v1/referrals, ob-ref- prefix)
- [x] Complete referral (POST /v1/referrals/:code/complete)
- [x] List user referrals (GET /v1/referrals) with cursor pagination
- [x] Self-referral prevention
- [x] Referral status tracking (pending, completed)

### Sharing & Referrals UI

- [x] Brain share UI (/dashboard/shares — create, manage, revoke shares)
- [x] Referral UI (/dashboard/referrals — view codes, share links, track completions)
- [x] Referral rewards (grantReferralReward extends referrer plan by 30 days)
- [x] Social sharing integration (SocialShare component — Twitter, LinkedIn sharing)

### Export

- [x] Export as PDF (GET /v1/export/pdf — printable HTML with Content-Disposition attachment)

---

## 18. UI/UX

### Landing Page

- [x] Hero section with headline and CTAs
- [x] Feature showcase (6 features: Structured Memory, AI-Agnostic, Privacy, Context Engine, MCP, Merge)
- [x] How it works (4-step flow)
- [x] Developer-friendly API section
- [x] Header with login/signup links
- [x] Responsive design

### Dashboard

- [x] Stats cards (total memories, entities, projects)
- [x] Recent memories list
- [x] Quick actions (add knowledge, edit profile, connect AI)
- [x] Getting started 3-step guide

### Navigation

- [x] Sidebar navigation with all sections
- [x] Mobile hamburger toggle
- [x] Responsive sidebar (overlay on mobile)
- [x] Active link highlighting
- [x] Admin-only navigation items (hidden for non-admins)
- [x] User email display + logout button in sidebar footer
- [x] Plan badge in sidebar header
- [x] Usage meter in sidebar footer

### Components

- [x] Language switcher (DE/EN/ES)
- [x] Cookie consent banner
- [x] Pagination component (cursor-based)
- [x] Plan badge component
- [x] Usage meter component (progress bars with color coding)
- [x] Icon set (Brain, AI, Lock, Bolt, Globe, Chart)
- [x] Auth context provider (token, user, locale, translation)
- [x] API client wrapper

### Pages (24 total)

- [x] Landing page (/)
- [x] Login page (/login)
- [x] Magic link verification (/auth/verify)
- [x] Region selection (/region)
- [x] Dashboard (/dashboard)
- [x] Brain profile (/dashboard/brain)
- [x] Memories (/dashboard/memory)
- [x] Knowledge ingest (/dashboard/ingest)
- [x] Entities (/dashboard/entities)
- [x] Projects (/dashboard/projects)
- [x] Integrations (/dashboard/integrations)
- [x] API keys (/dashboard/api-keys)
- [x] Admin overview (/dashboard/admin)
- [x] Admin users (/dashboard/admin/users)
- [x] Admin plans (/dashboard/admin/plans)
- [x] Admin plan detail (/dashboard/admin/plans/[id])
- [x] Admin audit log (/dashboard/admin/audit)
- [x] Admin invites (/dashboard/admin/invites)
- [x] Invite page (/invite)
- [x] Invite code page (/invite/[code])
- [x] Pricing (/pricing)
- [x] Impressum (/impressum)
- [x] Datenschutz / Privacy (/datenschutz)
- [x] AGB / Terms (/agb)

### Preview Files

- [x] Frontend preview (preview/frontend.html)
- [x] Dashboard preview (preview/dashboard.html)
- [x] Admin preview (preview/admin.html)

### Design

- [x] Dark theme (consistent dark color palette)
- [x] CSS Modules for scoped styling
- [x] Responsive breakpoint at 768px
- [x] Mobile-friendly layout

### Modern UI Features

- [x] Version badge in UI (APP_VERSION in layout.tsx, bottom-right position)
- [x] Dark/light theme toggle (ThemeProvider with localStorage persistence)
- [x] Keyboard shortcuts (Ctrl+K search, Ctrl+N new memory, Ctrl+/ shortcuts panel, Escape close)
- [x] Onboarding wizard/tour (/dashboard/onboarding — 4-step wizard with skip)
- [x] Toast notification system (global Toast + ToastProvider with auto-dismiss)
- [x] Loading skeleton screens (SkeletonCard, SkeletonList, SkeletonText components)
- [x] Accessibility (ARIA attributes, role/aria-label/aria-modal, keyboard navigation, skip-to-content, focus-visible)
- [x] PWA support (manifest.json, service worker with cache-first static / network-first API)

---

## 19. Daily Learning Loop

- [x] Deterministic question generation (no LLM, template-based)
- [x] Question templates for all 6 memory types
- [x] Gap-based rotation (asks about types with fewest memories)
- [x] Get today's question (GET /v1/daily-question/today) — creates if needed
- [x] Answer submission (POST /v1/daily-question/:id/answer)
- [x] Keyword-based memory type detection from answers
- [x] Answer-to-candidate memory conversion with source event tracking
- [x] Question history with cursor-based pagination (GET /v1/daily-question)
- [x] MCP tool: get_daily_question

### Advanced Features

- [ ] ~~Daily question UI (/dashboard/daily — removed in v1.7.1)~~
- [x] Push/email notifications (sendDailyQuestionEmail, NotificationPreference model)
- [x] LLM-powered question generation (generateLlmQuestion via Gemini/OpenAI with template fallback)
- [x] Streak tracking / gamification (streakCount, lastStreakDate on User, updateStreak on answer, GET /v1/user/streak)

---

## 20. Testing

- [x] Unit test suite (15 test files, 188 passing tests)
- [x] Tests: tokens, response helpers, audit, text normalization, similarity
- [x] Tests: merge engine (38 tests)
- [x] Tests: daily question service (11 tests)
- [x] Tests: context engine (37 tests)
- [x] Tests: monetization (13 tests)
- [x] Tests: viral & growth (15 tests)
- [x] Tests: GDPR service
- [x] Tests: Stripe service
- [x] Tests: security
- [x] Tests: API key service
- [x] Tests: PII masking
- [x] CI: tests run on every push/PR
- [x] CI: test results uploaded as artifacts

### Advanced Testing

- [x] Integration tests (app.inject() with mocked DB — auth, billing, memory integration suites)
- [x] E2E tests (Playwright — login.spec.ts, dashboard.spec.ts in apps/web/e2e/)
- [x] Test coverage reporting in CI (--coverage flag, artifacts upload)
- [x] Web component tests (Toast.test.tsx, Skeleton.test.tsx, Pagination.test.tsx, format.test.ts)
- [x] Load/performance tests (k6 load test script in tests/load/k6-script.js)

---

## 25. Agent Invite System

### Invite Links (Admin)

- [x] Create invite links with custom or auto-generated codes (POST /v1/admin/invites)
- [x] Configurable access level per invite link (read-only or read+write)
- [x] Optional max uses limit per invite link
- [x] Optional expiration (in days) per invite link
- [x] Custom or auto-generated invite code (crypto-safe)
- [x] Global enable/disable toggle for invite registration (system_settings)
- [x] List all invite links with status (GET /v1/admin/invites)
- [x] Update invite link (PATCH /v1/admin/invites/:id) — label, description, accessLevel, isActive, maxUses, expiresAt
- [x] Delete invite link (DELETE /v1/admin/invites/:id)
- [x] Admin invite management page (/dashboard/admin/invites)
- [x] Invite link status badges (active, inactive, expired, exhausted)
- [x] Copy invite URL button
- [x] Activate/deactivate individual links

### Invite Registration (Public)

- [x] Validate invite code (GET /v1/invite/:code/info) — returns access level, remaining uses, expiration
- [x] Register agent via invite (POST /v1/invite/register) — name, description, contactUrl
- [x] Scope resolution based on invite link access level (read → 3 scopes, readwrite → 8 scopes)
- [x] Atomic uses count increment on registration
- [x] API key with 90-day expiry on invite registration
- [x] Rate limiting: 30/min on info, 5/hr/IP on registration
- [x] Invite landing page (/invite) with manual code entry
- [x] Dynamic invite page (/invite/[code]) with auto-validation
- [x] Success page with API key display and copy button
- [x] Audit logging on invite registration

### Database

- [x] InviteLink model with access_level field (read/readwrite)
- [x] SystemSetting model for global invite toggle
- [x] inviteCode field on User model (tracks which invite code was used)
- [x] Migrations: invite_links + system_settings tables, access_level column

### i18n

- [x] 63 invite keys in DE/EN/ES (admin, public pages, form labels, status badges)

---

## Summary

| Category                       | Done    | Partial | Planned |
| ------------------------------ | ------- | ------- | ------- |
| Authentication & Authorization | 44      | 0       | 0       |
| Brain Profile                  | 10      | 0       | 0       |
| Memory System                  | 37      | 0       | 0       |
| Knowledge Management (Ingest)  | 16      | 0       | 0       |
| Entity Management              | 16      | 0       | 0       |
| Project Management             | 11      | 0       | 0       |
| Context Engine                 | 18      | 0       | 0       |
| Connect URL (AI Integration)   | 22      | 0       | 0       |
| API Key Management             | 11      | 0       | 0       |
| Merge Engine                   | 18      | 0       | 0       |
| Admin Dashboard                | 14      | 0       | 0       |
| Billing & Monetization         | 27      | 0       | 0       |
| DSGVO/GDPR Compliance          | 26      | 0       | 0       |
| Security                       | 33      | 0       | 0       |
| Internationalization (i18n)    | 24      | 0       | 0       |
| Infrastructure & Deployment    | 35      | 0       | 0       |
| Export & Sharing               | 18      | 0       | 0       |
| UI/UX                          | 44      | 0       | 0       |
| Daily Learning Loop            | 12      | 0       | 0       |
| Testing                        | 19      | 0       | 0       |
| DeepRecall (Hybrid Search)     | 18      | 0       | 0       |
| SkillForge (Self-Learning)     | 16      | 0       | 0       |
| BrainPulse (Briefings)         | 20      | 0       | 0       |
| Agent Invite System            | 27      | 0       | 0       |
| **Total**                      | **536** | **0**   | **0**   |

---

## 22. DeepRecall (Hybrid Search)

- [x] pgvector embedding storage (ON CONFLICT upsert)
- [x] Keyword search (Dice coefficient scoring, title 60% + body 40%)
- [x] Vector search (cosine similarity via pgvector)
- [x] Hybrid search (alpha-weighted fusion: vector + keyword)
- [x] Configurable alpha weight (0=keyword, 1=vector, default 0.6)
- [x] Plan gating: deep_recall feature flag (auto-downgrade to keyword)
- [x] BullMQ async embedding pipeline (fire-and-forget from CRUD)
- [x] Embedding worker: concurrency=3, limiter 50/min, 3 retries exponential backoff
- [x] Encryption-aware embedding: decrypt → compose → embed → store
- [x] Title-weighted embedding text (title repeated for emphasis)
- [x] Embedding status tracking (none/pending/completed/failed)
- [x] GET /v1/memory/embeddings/status (coverage stats)
- [x] POST /v1/memory/embeddings/reindex (batch re-embedding)
- [x] MCP deep_search tool (mode/top_k/alpha params)
- [x] Dashboard search page with mode selector and alpha slider
- [x] Zod validation on all search inputs
- [x] 30+ unit tests (embedding queue, search modes, reindex)
- [x] i18n translations (DE/EN/ES)

## 23. SkillForge (Self-Learning Loop)

- [x] LLM skill extraction (Gemini > OpenAI > fallback clustering)
- [x] Skill deduplication via Dice coefficient (>0.7 = duplicate)
- [x] Skill CRUD: GET/POST/PATCH/DELETE /v1/skills
- [x] Skill feedback: POST /v1/skills/:id/feedback (applied/referenced/dismissed)
- [x] Composite scoring: 30% confidence + 30% usage + 25% recency + 15% decay
- [x] Daily lifecycle: decay (-0.05/7d), archive (stale), promote (high-performing)
- [x] Context engine injection (assistant=5, project=3, deep=10 skills)
- [x] Skills formatted as "## Learned Skills" with trigger conditions
- [x] Token pressure: skill body truncation + progressive dropping
- [x] Plan gating: skill_forge feature flag (Pro/Team only)
- [x] MCP list_skills and skill_feedback tools
- [x] Dashboard skills page with filter tabs and confidence bars
- [x] Zod schemas (createSkill, updateSkill, skillFeedback, skillListQuery)
- [x] BullMQ skill analysis worker (concurrency=1, limiter 10/min)
- [x] 30+ unit tests (extraction, lifecycle, queue, context engine)
- [x] i18n translations (DE/EN/ES)

## 24. BrainPulse (Proactive Briefings)

- [x] Briefing config: timezone, quiet hours, webhook, content preferences
- [x] Cron-based scheduling with timezone-aware next-fire computation
- [x] Event-triggered briefings (candidate_threshold, conflicts, high_importance)
- [x] Content assembly: morning, evening, weekly_health, generic briefings
- [x] Email delivery via Resend API
- [x] Webhook delivery with HMAC-SHA256 signature verification
- [x] In-app delivery channel
- [x] Quiet hours enforcement (handles midnight wraparound)
- [x] Engagement tracking: opened, clicked, dismissed, acted_on
- [x] GET /v1/briefings/analytics (engagement rate, by type/channel, top actions)
- [x] Cursor-based pagination on briefing list
- [x] Plan gating: brain_pulse feature flag (weekly_email | full)
- [x] BullMQ briefing worker + 60s scheduler tick
- [x] MCP get_briefing_config and list_briefings tools
- [x] Dashboard briefings page with config panel and analytics
- [x] Zod schemas (config, schedule, trigger, engagement, listQuery)
- [x] Graceful shutdown of all workers on app close
- [x] 30+ unit tests (queue, scheduler, analytics, delivery)
- [x] i18n translations (DE/EN/ES)
- [x] 3 Prisma migrations (10 new models, 3 new enums)
