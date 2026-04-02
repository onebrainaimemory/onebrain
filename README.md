# OneBrain

**Your AI Memory Layer.** OneBrain stores your identity, preferences, knowledge, decisions, and projects in a structured system — and delivers optimized context to any AI assistant via REST API or MCP protocol.

Available as **hosted SaaS** (zero setup) or **self-hosted** on your own infrastructure. Both modes are 100% GDPR/DSGVO-compliant with EU data residency.

---

## What is OneBrain?

OneBrain is a persistent, structured memory for humans and AI agents alike. Instead of repeating yourself in every conversation, OneBrain maintains a living profile of who you are, what you know, and what you're working on. Any AI tool — or any AI agent — can query OneBrain to get personalized, relevant context.

**For humans:** Sync all your AI tools so you never have to explain yourself from scratch again. Tell Claude once, and ChatGPT, Gemini, and every other tool already knows.

**For agents:** AI agents use OneBrain the same way. An agent stores its knowledge once, and it's available everywhere — across sessions, tools, and platforms.

**Key principles:**

- **For humans & agents** — both store and share knowledge through the same system
- **Privacy-first** — your data stays yours. EU/GLOBAL region isolation, httpOnly cookies, encrypted at rest
- **Deterministic** — no ML, no embeddings, fully explainable merge logic
- **Multi-language** — DE/EN/ES out of the box, extensible to any language
- **AI-agnostic** — works with any LLM via REST API or MCP protocol
- **GDPR-compliant** — privacy by design, data minimization, consent management, full data portability
- **SaaS or Self-Hosted** — `DEPLOYMENT_MODE=saas|selfhosted` controls features

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │              Control Plane                │
                    │  ┌────────┐    ┌────────────────────┐    │
                    │  │ Caddy  │───▶│  Web App (Next.js) │    │
                    │  │ :443   │    │  28 pages, PWA     │    │
                    │  └───┬────┘    └────────────────────┘    │
                    └──────┼───────────────────────────────────┘
                           │
              ┌────────────┼────────────────┐
              │ /api/eu    │                │ /api/global
              ▼            │                ▼
  ┌───────────────────┐    │    ┌───────────────────┐
  │    EU Region      │    │    │   GLOBAL Region   │
  │                   │    │    │                   │
  │  ┌─────────────┐  │    │    │  ┌─────────────┐  │
  │  │ Fastify API │  │    │    │  │ Fastify API │  │
  │  │   :3001     │  │    │    │  │   :3001     │  │
  │  └──┬──────┬───┘  │    │    │  └──┬──────┬───┘  │
  │     │      │      │    │    │     │      │      │
  │  ┌──▼──┐ ┌─▼───┐  │    │    │  ┌──▼──┐ ┌─▼───┐  │
  │  │ PG  │ │Redis│  │    │    │  │ PG  │ │Redis│  │
  │  │ 16  │ │  7  │  │    │    │  │ 16  │ │  7  │  │
  │  └─────┘ └─────┘  │    │    │  └─────┘ └─────┘  │
  │                   │    │    │                   │
  │  ┌─────────────┐  │    │    │  ┌─────────────┐  │
  │  │ MCP Server  │  │    │    │  │ MCP Server  │  │
  │  │  (stdio)    │  │    │    │  │  (stdio)    │  │
  │  └─────────────┘  │    │    │  └─────────────┘  │
  └───────────────────┘    │    └───────────────────┘
                           │
              Strict network isolation
              No shared DB between regions
```

Region isolation ensures EU and GLOBAL data never mix — separate PostgreSQL databases, Redis instances, Docker networks, and compose stacks.

---

## Tech Stack

| Layer         | Technology                      | Version     |
| ------------- | ------------------------------- | ----------- |
| API Server    | Fastify                         | 5.2         |
| Frontend      | Next.js + React                 | 15.1 / 19.0 |
| Database      | PostgreSQL + Prisma             | 16 / 6.x    |
| Cache         | Redis                           | 7           |
| Auth          | Magic Link + JWT + OAuth + TOTP | jose 6.0    |
| Payments      | Stripe (built-in, not active)   | 20.4        |
| MCP           | Model Context Protocol SDK      | 1.27        |
| Validation    | Zod                             | 3.23        |
| i18n          | JSON-based (DE/EN/ES)           | —           |
| Security      | Helmet, HSTS, CSP, CSRF         | —           |
| Reverse Proxy | Caddy (auto-HTTPS)              | 2           |
| Containers    | Docker (multi-stage, non-root)  | —           |
| Build         | Turborepo + pnpm                | 2.3 / 9.15  |
| Testing       | Vitest                          | 3.0         |
| CI/CD         | GitHub Actions                  | —           |

---

## Monorepo Structure

```
onebrain/
├── apps/
│   ├── api/                  # REST API (Fastify 5.2, port 3001)
│   │   ├── src/
│   │   │   ├── routes/       # 26 route modules (~150 endpoints)
│   │   │   ├── services/     # 27 business logic services
│   │   │   ├── middleware/    # 3 middleware (auth, limits, email verify)
│   │   │   ├── lib/          # 18 utilities (audit, cache, tokens, PII mask...)
│   │   │   │   └── context-engine/  # Relevance scoring + token compression
│   │   │   └── __tests__/    # 23 test files (365 tests)
│   │   └── package.json
│   ├── web/                  # Web UI (Next.js 15, port 3000)
│   │   ├── src/
│   │   │   ├── app/          # 28 pages (App Router)
│   │   │   └── components/   # 27 components (CSS Modules)
│   │   ├── public/           # PWA manifest, service worker, icons
│   │   └── package.json
│   └── mcp/                  # MCP server for AI tools (stdio)
│       └── package.json
├── packages/
│   ├── db/                   # Prisma schema (31 models, 8 enums)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/   # 5 migrations
│   ├── shared/               # TypeScript types
│   ├── schemas/              # 14 Zod validation schemas
│   └── i18n/                 # Translations (DE/EN/ES)
├── infra/
│   ├── control-plane/        # Caddy + Web (docker-compose)
│   ├── region-eu/            # EU-isolated stack (docker-compose)
│   ├── region-global/        # Global-isolated stack (docker-compose)
│   └── docker/               # Multi-stage Dockerfiles (API, Web, MCP)
├── .github/workflows/        # CI/CD (ci.yml, deploy.yml)
├── .env.example              # Environment template
├── CHANGELOG.md              # Version history
├── FEATURELIST.md            # 455 features (20 categories)
└── DSGVO-REPORT.md           # GDPR compliance report
```

---

## 🧩 Integrations & SDKs

OneBrain works with your favorite tools and frameworks out of the box:

| Integration                               | Language   | Install                                                                    |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| **MCP Server** (Claude, Cursor, Windsurf) | TypeScript | `npx onebrain-mcp`                                                         |
| **Python SDK**                            | Python     | `pip install onebrain-sdk`                                                 |
| **LangChain**                             | Python     | `pip install onebrain-langchain`                                           |
| **LlamaIndex**                            | Python     | `pip install onebrain-llama-index`                                         |
| **Vercel AI SDK**                         | TypeScript | `npm install onebrain-ai-sdk`                                              |
| **OpenClaw**                              | TypeScript | [onebrain-openclaw](https://github.com/onebrainaimemory/onebrain-openclaw) |
| **Node.js SDK**                           | TypeScript | `npm install onebrain`                                                     |
| **Laravel SDK**                           | PHP        | `composer require onebrain/laravel`                                        |

All integrations are open-source (MIT) and self-hosted compatible.

---

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 16
- Redis 7 (optional for dev, required for production)

### Installation

```bash
# Clone and install
git clone <repo-url> onebrain
cd onebrain
pnpm install

# Create database
createdb onebrain

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET (min 32 chars)

# Run migrations & generate Prisma client
DATABASE_URL="postgresql://user@localhost:5432/onebrain" \
  pnpm --filter @onebrain/db exec prisma migrate deploy

pnpm --filter @onebrain/db exec prisma generate
```

### Start Development

```bash
# All apps at once (via Turborepo)
pnpm dev

# Or individually:

# Terminal 1: API (port 4002)
DATABASE_URL="postgresql://user@localhost:5432/onebrain" \
  API_PORT=4002 \
  pnpm --filter @onebrain/api exec tsx src/index.ts

# Terminal 2: Web (port 3000)
NEXT_PUBLIC_API_URL=http://localhost:4002 \
  pnpm --filter @onebrain/web exec next dev
```

### Demo Login

In development mode (`NODE_ENV !== 'production'`), demo logins are available:

1. Open http://localhost:3000/login
2. Click **"Demo Login (Development)"** for admin access
3. Or use **"Demo User Login"** for regular user access

Demo admin: `admin@onebrain.demo` — Demo user: `user@onebrain.demo`

---

## SDK — `npm install onebrain`

The official OneBrain SDK gives you typed access to the entire API from Node.js, Deno, or any JavaScript/TypeScript runtime.

```bash
npm install onebrain
```

### Quick Example

```typescript
import { OneBrain } from 'onebrain';

const brain = new OneBrain({
  apiKey: 'ob_your_key_here',
  baseUrl: 'https://onebrain.rocks/api/eu', // default
});

// Read your brain context
const context = await brain.context.get('assistant');
console.log(context.text);

// Write a memory
await brain.memory.create({
  type: 'fact',
  title: 'Likes TypeScript',
  body: 'Prefers TS over JS for all projects',
});

// Search memories
const results = await brain.memory.search({ query: 'TypeScript' });

// Agent Sync — read full context
const sync = await brain.connect.read();

// Agent Sync — write batch memories
await brain.connect.writeMemories([
  { type: 'preference', title: 'Dark mode', body: 'Prefers dark themes' },
  { type: 'skill', title: 'React', body: 'Advanced React developer' },
]);
```

### SDK Features

| Module          | Methods                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `brain.memory`  | `create`, `get`, `update`, `delete`, `list`, `search`, `extract`, `import`, `consolidate` |
| `brain.entity`  | `create`, `get`, `update`, `delete`, `list`, `addLink`, `graph`, `merge`, `autoExtract`   |
| `brain.project` | `create`, `get`, `update`, `delete`, `list`, `addMemoryLink`                              |
| `brain.brain`   | `profile`, `updateProfile`, `context`                                                     |
| `brain.context` | `get` (scopes: `brief`, `assistant`, `project`, `deep`)                                   |
| `brain.connect` | `read`, `writeMemory`, `writeMemories` (Agent Sync Protocol)                              |
| `brain.billing` | `usage`, `plan`                                                                           |
| `brain.apiKeys` | `list`, `create`, `updateTrustLevel`, `revoke`                                            |

### Configuration

```typescript
const brain = new OneBrain({
  apiKey: 'ob_your_key', // Required — get from dashboard
  baseUrl: 'https://...', // Default: https://onebrain.rocks/api/eu
  timeout: 10000, // Default: 10s
  headers: { 'X-Custom': 'val' }, // Optional extra headers
});
```

### Error Handling

```typescript
import { OneBrainError, OneBrainTimeoutError } from 'onebrain';

try {
  await brain.memory.create({ type: 'fact', title: 'Test', body: 'test' });
} catch (err) {
  if (err instanceof OneBrainTimeoutError) {
    console.error('Request timed out');
  } else if (err instanceof OneBrainError) {
    console.error(err.code, err.message, err.requestId);
  }
}
```

- Zero runtime dependencies
- Dual ESM/CJS builds
- Full TypeScript types
- Node.js >= 18
- MIT License

**Links:**

- npm: [onebrain](https://www.npmjs.com/package/onebrain)
- GitHub: [onebrainaimemory/onebrainagentsdk](https://github.com/onebrainaimemory/onebrainagentsdk)

---

## Authentication

OneBrain supports multiple authentication methods:

| Method         | Use Case               | Flow                               |
| -------------- | ---------------------- | ---------------------------------- |
| **Magic Link** | Primary login          | Email → verify token → JWT         |
| **Password**   | Optional               | Email + password → JWT             |
| **OAuth 2.0**  | Google (Apple planned) | ID token → JWT                     |
| **TOTP**       | Two-factor auth        | Password/magic link + 6-digit code |
| **API Key**    | External tools, MCP    | `Authorization: ApiKey ob_xxx`     |

### Token Strategy

- **Access token**: 15min, httpOnly cookie (`accessToken`, secure, sameSite strict)
- **Refresh token**: 7d, httpOnly cookie (path-scoped to `/v1/auth`)
- **CSRF protection**: `X-Requested-With` header required for cookie-based auth
- **API keys**: SHA-256 hashed, prefix-based (`ob_`), scoped permissions

### Available API Key Scopes

| Scope                  | Access                                  |
| ---------------------- | --------------------------------------- |
| `brain.read`           | Read brain profile, context, and memory |
| `brain.write`          | Update brain profile                    |
| `memory.extract.write` | Create memories via text extraction     |
| `entity.read`          | Read entities and entity links          |
| `entity.write`         | Create, update, and delete entities     |
| `connect.read`         | Read brain context via Connect protocol |
| `connect.write`        | Write memories via Connect protocol     |

### API Keys and 2FA

API keys are machine-to-machine credentials. They **bypass 2FA/TOTP completely** — this is by design. Two-factor authentication is only enforced for interactive human login (password, magic link, OAuth). API keys authenticate via timing-safe hash comparison and are scoped to specific permissions, making them safe for automated agents and CI/CD pipelines.

Admin routes always require an interactive session and reject API key auth.

### Privacy by Design — Zero-Knowledge Identity

OneBrain's authentication system is intentionally built to decouple your identity from your knowledge.

**What we store:** Your email address and your 2FA secret — nothing else. No name, no phone number, no profile picture, no billing address. Your email is the key to the door, and your authenticator app is the lock.

**What this means:** The memories, skills, entities, and projects inside your OneBrain are never tied to a real-world identity. There is no username, no display name, no social profile linking back to you. Your knowledge exists in OneBrain — but OneBrain doesn't know _who_ you are.

This is by design, not by accident:

| Principle                | Implementation                                                       |
| ------------------------ | -------------------------------------------------------------------- |
| **Minimal identity**     | Only email + TOTP secret stored — no name, phone, or address         |
| **No profile linking**   | No social graphs, no friend lists, no public profiles                |
| **Pseudonymous usage**   | API keys and sessions reference a UUID, never a person               |
| **Knowledge ≠ Identity** | Your brain's content cannot be traced back to you without your email |
| **2FA as gatekeeper**    | Mandatory TOTP ensures that even email access alone isn't enough     |

The result: even if someone accessed the database directly, they would find encrypted memories linked to anonymous UUIDs — with no way to connect them to a real person without the corresponding email and 2FA credentials.

---

## API Reference

**Base URL**: `/v1` — All endpoints return `{ data, error, meta }` envelope.

### Auth (7 endpoints)

| Method | Endpoint              | Auth   | Description                   |
| ------ | --------------------- | ------ | ----------------------------- |
| POST   | `/v1/auth/magic-link` | —      | Request magic link email      |
| POST   | `/v1/auth/verify`     | —      | Verify token, set JWT cookies |
| POST   | `/v1/auth/refresh`    | Cookie | Refresh access token          |
| POST   | `/v1/auth/logout`     | JWT    | End current session           |
| POST   | `/v1/auth/logout-all` | JWT    | End all sessions              |
| POST   | `/v1/auth/region`     | JWT    | Set data region (EU/GLOBAL)   |
| GET    | `/v1/auth/me`         | JWT    | Current user profile          |

### Password Auth (2 endpoints)

| Method | Endpoint            | Auth | Description                    |
| ------ | ------------------- | ---- | ------------------------------ |
| POST   | `/v1/auth/register` | —    | Register with email + password |
| POST   | `/v1/auth/login`    | —    | Login with email + password    |

### OAuth (3 endpoints)

| Method | Endpoint                | Auth | Description                        |
| ------ | ----------------------- | ---- | ---------------------------------- |
| POST   | `/v1/auth/oauth/google` | —    | Google OAuth login (ID token)      |
| POST   | `/v1/auth/oauth/apple`  | —    | Apple OAuth login (ID token)       |
| POST   | `/v1/auth/oauth/github` | —    | GitHub OAuth login (code exchange) |

### TOTP (3 endpoints)

| Method | Endpoint                | Auth | Description                   |
| ------ | ----------------------- | ---- | ----------------------------- |
| POST   | `/v1/auth/totp/setup`   | JWT  | Generate TOTP secret + QR URI |
| POST   | `/v1/auth/totp/verify`  | JWT  | Verify and enable TOTP        |
| POST   | `/v1/auth/totp/disable` | JWT  | Disable TOTP                  |

### Sessions (2 endpoints)

| Method | Endpoint           | Auth | Description             |
| ------ | ------------------ | ---- | ----------------------- |
| GET    | `/v1/sessions`     | JWT  | List active sessions    |
| DELETE | `/v1/sessions/:id` | JWT  | Revoke specific session |

### Brain & Memory (8 endpoints)

| Method | Endpoint            | Auth    | Description               |
| ------ | ------------------- | ------- | ------------------------- |
| GET    | `/v1/brain/profile` | JWT/Key | User identity profile     |
| PUT    | `/v1/brain/profile` | JWT/Key | Update identity profile   |
| GET    | `/v1/brain/context` | JWT/Key | Full brain projection     |
| GET    | `/v1/memory`        | JWT/Key | List memories (paginated) |
| POST   | `/v1/memory`        | JWT/Key | Create memory             |
| GET    | `/v1/memory/:id`    | JWT/Key | Single memory             |
| PATCH  | `/v1/memory/:id`    | JWT/Key | Update memory             |
| DELETE | `/v1/memory/:id`    | JWT/Key | Delete memory             |

### Memory Extraction & Ingestion (3 endpoints)

| Method | Endpoint             | Auth    | Description                              |
| ------ | -------------------- | ------- | ---------------------------------------- |
| POST   | `/v1/memory/extract` | JWT/Key | AI memory extraction from text           |
| POST   | `/v1/ingest/url`     | JWT     | Ingest content from URL (SSRF-protected) |
| POST   | `/v1/ingest/file`    | JWT     | Ingest uploaded file (PDF, text)         |

### Context Engine (1 endpoint)

| Method | Endpoint             | Auth    | Description           |
| ------ | -------------------- | ------- | --------------------- |
| GET    | `/v1/context/:scope` | JWT/Key | Optimized LLM context |

**Scopes**: `brief` (500 tokens), `assistant` (2K), `project` (3K), `deep` (8K)

Content negotiation: `Accept: text/plain` returns formatted text for direct LLM injection.

### Entities (5 endpoints)

| Method | Endpoint                 | Auth    | Description                |
| ------ | ------------------------ | ------- | -------------------------- |
| GET    | `/v1/entities`           | JWT/Key | List entities (paginated)  |
| POST   | `/v1/entities`           | JWT/Key | Create entity              |
| PATCH  | `/v1/entities/:id`       | JWT/Key | Update entity              |
| DELETE | `/v1/entities/:id`       | JWT/Key | Delete entity              |
| POST   | `/v1/entities/:id/links` | JWT/Key | Create entity relationship |

### Projects (5 endpoints)

| Method | Endpoint                        | Auth | Description               |
| ------ | ------------------------------- | ---- | ------------------------- |
| GET    | `/v1/projects`                  | JWT  | List projects (paginated) |
| POST   | `/v1/projects`                  | JWT  | Create project            |
| PATCH  | `/v1/projects/:id`              | JWT  | Update project            |
| DELETE | `/v1/projects/:id`              | JWT  | Delete project            |
| POST   | `/v1/projects/:id/memory-links` | JWT  | Link memory to project    |

### Tags (4 endpoints)

| Method | Endpoint                     | Auth | Description            |
| ------ | ---------------------------- | ---- | ---------------------- |
| GET    | `/v1/tags`                   | JWT  | List tags              |
| POST   | `/v1/tags`                   | JWT  | Create tag             |
| POST   | `/v1/memory/:id/tags`        | JWT  | Tag a memory           |
| DELETE | `/v1/memory/:id/tags/:tagId` | JWT  | Remove tag from memory |

### Merge Engine (2 endpoints)

| Method | Endpoint            | Auth | Description                   |
| ------ | ------------------- | ---- | ----------------------------- |
| POST   | `/v1/merge/run`     | JWT  | Run deterministic merge cycle |
| GET    | `/v1/merge/history` | JWT  | View merge logs               |

### Daily Learning (3 endpoints)

| Method | Endpoint                        | Auth | Description                  |
| ------ | ------------------------------- | ---- | ---------------------------- |
| GET    | `/v1/daily-question/today`      | JWT  | Today's learning question    |
| POST   | `/v1/daily-question/:id/answer` | JWT  | Submit answer                |
| GET    | `/v1/daily-question`            | JWT  | Question history (paginated) |

### API Keys (4 endpoints)

| Method | Endpoint           | Auth | Description                                           |
| ------ | ------------------ | ---- | ----------------------------------------------------- |
| GET    | `/v1/api-keys`     | JWT  | List API keys                                         |
| POST   | `/v1/api-keys`     | JWT  | Create API key                                        |
| DELETE | `/v1/api-keys/:id` | JWT  | Revoke API key                                        |
| PATCH  | `/v1/api-keys/:id` | JWT  | Update agent config (name, trust, scopes, rate limit) |

### Connected Agents (7 endpoints)

| Method | Endpoint                    | Auth   | Description                                     |
| ------ | --------------------------- | ------ | ----------------------------------------------- |
| GET    | `/v1/agents`                | JWT    | List agents with sync stats                     |
| GET    | `/v1/agents/summary`        | JWT    | Cross-agent summary (calls, errors, candidates) |
| GET    | `/v1/agents/activity`       | JWT    | All-agent activity feed (paginated)             |
| GET    | `/v1/agents/:id/summary`    | JWT    | Single-agent summary                            |
| GET    | `/v1/agents/:id/activity`   | JWT    | Single-agent activity feed                      |
| POST   | `/v1/agents/:id/candidates` | JWT    | Bulk approve/dismiss candidates                 |
| GET    | `/v1/connect/:key/delta`    | ApiKey | Delta sync — memories updated since last query  |

### Sharing & Export (6 endpoints)

| Method | Endpoint               | Auth | Description                  |
| ------ | ---------------------- | ---- | ---------------------------- |
| POST   | `/v1/shares`           | JWT  | Create brain snapshot        |
| GET    | `/v1/shares/:token`    | —    | View snapshot (public)       |
| GET    | `/v1/export/json`      | JWT  | Full brain export (JSON)     |
| GET    | `/v1/export/markdown`  | JWT  | Full brain export (Markdown) |
| GET    | `/v1/export/ai-prompt` | JWT  | AI system prompt from brain  |
| POST   | `/v1/referrals`        | JWT  | Create referral code         |

### User & GDPR (5 endpoints)

| Method | Endpoint                 | Auth | Description                               |
| ------ | ------------------------ | ---- | ----------------------------------------- |
| GET    | `/v1/user/profile`       | JWT  | User profile                              |
| PATCH  | `/v1/user/profile`       | JWT  | Update profile                            |
| GET    | `/v1/user/export`        | JWT  | GDPR data export (14 categories)          |
| DELETE | `/v1/user`               | JWT  | Account deletion (soft delete, 30d grace) |
| GET    | `/v1/user/usage-summary` | JWT  | Current usage stats                       |

### Billing (4 endpoints, conditional)

Registered only when `STRIPE_SECRET_KEY` is set.

| Method | Endpoint                   | Auth | Description                    |
| ------ | -------------------------- | ---- | ------------------------------ |
| POST   | `/v1/billing/checkout`     | JWT  | Create Stripe checkout session |
| GET    | `/v1/billing/portal`       | JWT  | Stripe customer portal URL     |
| GET    | `/v1/billing/subscription` | JWT  | Current subscription status    |
| POST   | `/v1/billing/change-plan`  | JWT  | Upgrade/downgrade plan         |

### Webhooks (1 endpoint, conditional)

| Method | Endpoint              | Auth       | Description          |
| ------ | --------------------- | ---------- | -------------------- |
| POST   | `/v1/webhooks/stripe` | Stripe sig | Stripe event handler |

### Admin (8+ endpoints)

All require `admin` role.

| Method         | Endpoint                       | Description            |
| -------------- | ------------------------------ | ---------------------- |
| GET/POST/PATCH | `/v1/admin/plans`              | Plan CRUD              |
| GET/POST       | `/v1/admin/plans/:id/limits`   | Plan limits            |
| GET/POST       | `/v1/admin/plans/:id/features` | Plan features          |
| GET/PATCH      | `/v1/admin/users`              | User management        |
| GET            | `/v1/admin/usage/:userId`      | Usage statistics       |
| GET            | `/v1/admin/audit-logs`         | Audit logs (paginated) |

### Legal & OpenAPI (4 endpoints)

| Method | Endpoint                | Auth | Description             |
| ------ | ----------------------- | ---- | ----------------------- |
| GET    | `/v1/legal/impressum`   | —    | Legal notice (JSON)     |
| GET    | `/v1/legal/datenschutz` | —    | Privacy policy (JSON)   |
| GET    | `/v1/legal/agb`         | —    | Terms of service (JSON) |
| GET    | `/v1/openapi.json`      | —    | OpenAPI specification   |

### Health (1 endpoint)

| Method | Endpoint  | Description                          |
| ------ | --------- | ------------------------------------ |
| GET    | `/health` | DB connectivity check, system status |

---

## MCP Server

Connect OneBrain to any MCP-compatible AI tool (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "onebrain": {
      "command": "node",
      "args": ["apps/mcp/dist/index.js"],
      "env": {
        "ONEBRAIN_API_URL": "http://localhost:4002",
        "ONEBRAIN_API_KEY": "ob_your_api_key_here"
      }
    }
  }
}
```

**6 MCP tools available:**

| Tool                  | Description                               |
| --------------------- | ----------------------------------------- |
| `get_user_context`    | Full brain context for AI personalization |
| `search_memory`       | Filter memories by type, status, keyword  |
| `write_memory`        | Extract and store new memories from text  |
| `upsert_entity`       | Find or create people, places, concepts   |
| `get_project_context` | Project details with linked memories      |
| `get_daily_question`  | Today's learning question                 |

All MCP tools delegate to the REST API — no duplicated business logic.

---

## Context Engine

The context engine delivers optimized, token-budgeted context to AI tools. It scores items by relevance (source priority 35% + confidence 35% + recency 30%), filters by scope, and compresses to fit the token budget.

| Scope       | Token Budget | Use Case                   |
| ----------- | ------------ | -------------------------- |
| `brief`     | 500          | Quick lookups, chat titles |
| `assistant` | 2,000        | Standard AI conversations  |
| `project`   | 3,000        | Project-focused work       |
| `deep`      | 8,000        | Comprehensive analysis     |

```bash
# JSON response (default)
curl http://localhost:4002/v1/context/assistant \
  -H "Authorization: ApiKey ob_your_key"

# Plain text (for direct LLM system prompt injection)
curl http://localhost:4002/v1/context/assistant \
  -H "Authorization: ApiKey ob_your_key" \
  -H "Accept: text/plain"
```

Identity (user profile) is **never dropped** during compression — it is always included regardless of budget constraints.

---

## AI Integration (Sync Protocol)

### Overview

OneBrain keeps all your AI assistants in sync. Give any AI a single Connect URL once — it reads your context and writes back new learnings automatically. No plugins to install, no platform-specific configuration, no manual copy-pasting between tools.

The Sync Protocol v1 is a two-endpoint contract:

1. **Read** — AI fetches a system prompt containing the user's full brain context
2. **Write-back** — AI sends new learnings to OneBrain as structured memories

Any AI that can make HTTP requests can participate. The protocol is embedded directly in the system prompt, so the AI knows how and when to sync without additional instruction.

### Sync Protocol v1

#### How It Works

1. You generate a Connect URL in the OneBrain dashboard (Settings > Integrations)
2. You give that URL to an AI assistant (paste it as a system prompt, add it as an MCP server, or configure it as a plugin)
3. The AI reads your context via `GET /v1/connect/:apiKey` — it receives a system prompt containing your identity, preferences, knowledge, and active projects
4. During conversation, the AI detects new information worth remembering
5. The AI writes it back via `POST /v1/connect/:apiKey/memory` — silently, in the background
6. All your other connected AIs pick up the new memory on their next read

#### User Commands

| Command      | Behavior                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **OBIgnore** | Pauses write-back. The AI still uses existing context but stops saving new information until `OBSync` or a new conversation. |
| **OBSync**   | Resumes normal sync behavior after an `OBIgnore`.                                                                            |
| **OBStatus** | AI reports whether sync is active or paused, and how many items were synced in the current conversation.                     |

#### What Gets Synced

- New project decisions or status updates
- Preferences the user expresses (tools, languages, workflows)
- Facts about the user (role changes, new skills, expertise)
- Goals the user mentions
- Important experiences or lessons learned

#### What Does NOT Get Synced

- Trivial conversation (greetings, small talk)
- Information already present in the user's brain context
- Temporary debugging sessions or one-off questions
- Passwords, tokens, API keys, or secrets
- Raw code snippets (the decision is synced, not the code)

#### Trust Levels

When an AI writes back a memory, its status depends on the API key's trust level:

| Level     | Behavior                                                                                 | Use Case                               |
| --------- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| `review`  | Memories saved as `candidate` — user must approve in dashboard before they become active | New or untested integrations (default) |
| `trusted` | Memories saved as `active` — immediately available to all connected AIs                  | Established, verified AI connections   |

Set trust level per API key:

```bash
curl -X PATCH https://api.onebrain.rocks/v1/api-keys/:id/trust \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{ "trustLevel": "trusted" }'
```

#### Deduplication

The write-back endpoint runs dedup before saving. If a memory with the same type, similar title (Dice coefficient), and similar body already exists, the POST returns the existing memory with `200 OK` instead of creating a duplicate. This prevents redundant entries when multiple AIs learn the same fact.

### Integration Methods

| Method              | Platforms                        | Auto-Sync    | Setup                                       |
| ------------------- | -------------------------------- | ------------ | ------------------------------------------- |
| **Connect URL**     | Any AI with HTTP access          | Read + Write | Give URL once as system prompt              |
| **MCP Server**      | Claude Desktop, Cursor, Windsurf | Read + Write | Add to MCP config JSON                      |
| **ChatGPT Actions** | ChatGPT Custom GPTs              | Read + Write | Add plugin URL to GPT                       |
| **REST API**        | Any agent, script, or automation | Read + Write | Use API key with `connect.*` scopes         |
| **System Prompt**   | Any AI (manual copy-paste)       | Read only    | Copy context output, paste as system prompt |

### Setup Guide

#### Claude Desktop / Cursor (MCP)

Add this to your MCP configuration file (`claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "onebrain": {
      "command": "node",
      "args": ["apps/mcp/dist/index.js"],
      "env": {
        "ONEBRAIN_API_URL": "https://api.onebrain.rocks",
        "ONEBRAIN_API_KEY": "ob_your_api_key_here"
      }
    }
  }
}
```

The MCP server exposes 6 tools (`get_user_context`, `search_memory`, `write_memory`, `upsert_entity`, `get_project_context`, `get_daily_question`) that delegate to the REST API. See the [MCP Server](#mcp-server) section above for the full tool list.

#### ChatGPT (Custom GPT)

1. Create a Custom GPT in ChatGPT
2. Go to **Configure > Actions > Create new action**
3. Set the import URL to: `https://api.onebrain.rocks/v1/openapi.json`
4. ChatGPT auto-discovers the Connect read/write endpoints
5. In the GPT instructions, add your Connect URL:
   ```
   https://api.onebrain.rocks/v1/connect/ob_your_api_key_here
   ```
6. The GPT reads your brain context at conversation start and writes back new learnings automatically

#### Gemini (Gem)

1. Go to **Gemini > Gems > Create Gem**
2. In the system instruction field, paste your Connect URL output:
   ```bash
   curl https://api.onebrain.rocks/v1/connect/ob_your_api_key_here
   ```
3. Copy the full text output and paste it as the Gem's system instruction
4. Gemini reads your context on every conversation
5. For write-back, include the POST URL in the system instruction — Gemini will use it when it identifies new information

#### Agents (OpenClaw, CrewAI, LangChain, etc.)

Use the REST API directly in your agent's setup or tool configuration:

```bash
# Read brain context (returns system prompt as plain text)
curl https://api.onebrain.rocks/v1/connect/ob_your_api_key_here \
  -H "Accept: text/plain"

# Read with specific scope (brief, assistant, project, deep)
curl "https://api.onebrain.rocks/v1/connect/ob_your_api_key_here?scope=assistant" \
  -H "Accept: text/plain"

# Read as JSON (includes metadata and token estimate)
curl "https://api.onebrain.rocks/v1/connect/ob_your_api_key_here?scope=deep" \
  -H "Accept: application/json"

# Write back a new memory
curl -X POST https://api.onebrain.rocks/v1/connect/ob_your_api_key_here/memory \
  -H "Content-Type: application/json" \
  -d '{
    "type": "decision",
    "title": "Switched from REST to GraphQL for the mobile app",
    "body": "After evaluating both options, decided GraphQL reduces over-fetching on mobile and simplifies the data layer. REST remains for public API."
  }'
```

### Connect API Reference

#### `GET /v1/connect/:apiKey`

Reads the user's brain context as an AI-ready system prompt.

| Parameter | Location | Type   | Default      | Description                                                                |
| --------- | -------- | ------ | ------------ | -------------------------------------------------------------------------- |
| `apiKey`  | path     | string | —            | Full API key (`ob_prefix_secret`)                                          |
| `scope`   | query    | string | `deep`       | Token budget: `brief` (500), `assistant` (2K), `project` (3K), `deep` (8K) |
| `Accept`  | header   | string | `text/plain` | `text/plain` for raw prompt, `application/json` for structured response    |

**Scopes required**: `connect.read`

**Rate limit**: 30 requests/minute per API key prefix

**Response (plain text)**: Full system prompt with Sync Protocol v1 instructions, user context, and write-back URL.

**Response (JSON)**:

```json
{
  "data": {
    "systemPrompt": "# OneBrain Sync Protocol v1\n...",
    "meta": {
      "tokenEstimate": 4200,
      "scope": "deep",
      "writeBackEnabled": true,
      "generatedAt": "2026-03-21T10:30:00Z"
    }
  },
  "meta": { "requestId": "req-abc123" }
}
```

#### `POST /v1/connect/:apiKey/memory`

Writes a new memory back to OneBrain from an AI conversation.

| Parameter    | Location | Type   | Required | Description                                                                                           |
| ------------ | -------- | ------ | -------- | ----------------------------------------------------------------------------------------------------- |
| `apiKey`     | path     | string | Yes      | Full API key (`ob_prefix_secret`)                                                                     |
| `type`       | body     | string | Yes      | One of: `fact`, `preference`, `decision`, `goal`, `experience`, `skill`                               |
| `title`      | body     | string | Yes      | Short summary (1-500 chars)                                                                           |
| `body`       | body     | string | Yes      | Full detail (1-10,000 chars)                                                                          |
| `sourceType` | body     | string | No       | Default: `ai_extraction`. One of: `user_input`, `system_inference`, `ai_extraction`, `user_confirmed` |
| `confidence` | body     | number | No       | Default: `0.7`. Range: 0.0-1.0                                                                        |
| `metadata`   | body     | object | No       | Arbitrary key-value metadata                                                                          |

**Scopes required**: `connect.write`

**Rate limit**: 10 requests/minute per API key prefix

**Response** (`201 Created`): The created memory object. Status is `candidate` (review trust) or `active` (trusted).

**Response** (`200 OK`): If a duplicate memory already exists, returns the existing memory without creating a new one.

#### `PATCH /v1/api-keys/:id/trust`

Updates the trust level for an API key. Requires JWT authentication (not API key auth).

| Parameter    | Location | Type   | Required | Description           |
| ------------ | -------- | ------ | -------- | --------------------- |
| `id`         | path     | string | Yes      | API key ID            |
| `trustLevel` | body     | string | Yes      | `review` or `trusted` |

**Auth**: JWT (cookie-based, requires logged-in user)

**Response** (`200 OK`): Updated API key object.

### Security Considerations

- Connect URLs contain the full API key — treat them as secrets, never share publicly
- All connect endpoints enforce `Cache-Control: no-store` and `Referrer-Policy: no-referrer`
- API keys are hashed with SHA-256 in the database; only the prefix is stored in plaintext
- Rate limits are enforced per API key prefix (30/min read, 10/min write)
- Write-back URLs are only included in the system prompt when the key has `connect.write` scope
- The protocol never instructs the AI to share context with other users or expose the write-back URL

---

## For AI Agents

OneBrain is built for autonomous AI agents. Any agent that can make HTTP requests can read a user's brain context and write back new learnings — no browser, no UI, no human interaction required.

### Why Agents Should Use OneBrain

| Without OneBrain                       | With OneBrain                                               |
| -------------------------------------- | ----------------------------------------------------------- |
| Each agent starts from zero            | Every agent has full user context from the first message    |
| Knowledge dies when the session ends   | Learnings persist and sync across all agents                |
| User repeats preferences to every tool | Preferences, skills, and decisions are shared automatically |
| Agents can't coordinate                | Agents read each other's learnings via shared memory        |

### Agent Quick Start (5 Minutes)

```bash
# 1. Create account + API key (one-time setup, see "Automated Account Provisioning" below)
# 2. Read brain context
CONTEXT=$(curl -s "https://onebrain.rocks/api/eu/v1/connect" \
  -H "Authorization: ApiKey ob_your_key" \
  -H "Accept: text/plain")

# 3. Use $CONTEXT as system prompt for your agent

# 4. Write back learnings
curl -s -X POST "https://onebrain.rocks/api/eu/v1/connect/memory" \
  -H "Authorization: ApiKey ob_your_key" \
  -H "Content-Type: application/json" \
  -d '{"type":"decision","title":"Switched to PostgreSQL","body":"Team decided to migrate from MySQL to PostgreSQL for better JSON support."}'

# 5. Delta sync (only changes since last check)
curl -s "https://onebrain.rocks/api/eu/v1/connect/delta?since=2026-04-01T00:00:00Z" \
  -H "Authorization: ApiKey ob_your_key"
```

### Authentication for Agents

Agents authenticate exclusively via API keys. **No password, no 2FA, no browser session required.**

| Method                    | Header                                   | Use Case            |
| ------------------------- | ---------------------------------------- | ------------------- |
| Header auth (recommended) | `Authorization: ApiKey ob_prefix_secret` | All agents          |
| URL path (legacy)         | `GET /v1/connect/ob_prefix_secret`       | Simple integrations |

API keys bypass 2FA by design — they are pre-authorized machine credentials with scoped permissions and rate limits.

### Integration Examples

#### Python Agent

```python
import requests

API_KEY = "ob_your_key"
BASE = "https://onebrain.rocks/api/eu"

# Read context
ctx = requests.get(f"{BASE}/v1/connect",
    headers={"Authorization": f"ApiKey {API_KEY}", "Accept": "text/plain"}).text

# Write memory
requests.post(f"{BASE}/v1/connect/memory",
    headers={"Authorization": f"ApiKey {API_KEY}"},
    json={"type": "fact", "title": "User speaks German", "body": "Primary language is German, prefers German UI."})
```

#### LangChain / CrewAI

```python
from onebrain import OneBrain

ob = OneBrain(api_key="ob_your_key", base_url="https://onebrain.rocks/api/eu")
context = ob.get_context(scope="assistant")

# Use as system prompt
from langchain.chat_models import ChatOpenAI
llm = ChatOpenAI(model="gpt-4o")
llm.invoke([{"role": "system", "content": context}, {"role": "user", "content": "..."}])
```

#### Node.js / TypeScript Agent

```typescript
import OneBrain from 'onebrain';

const ob = new OneBrain({ apiKey: 'ob_your_key', baseUrl: 'https://onebrain.rocks/api/eu' });
const { context } = await ob.getContext({ scope: 'deep' });

// Write back
await ob.writeMemory({
  type: 'goal',
  title: 'Launch MVP by Q3',
  body: 'User wants to ship the MVP before July.',
});
```

### Context Scopes

Choose the right scope based on your agent's token budget:

| Scope       | Tokens | Best For                                                  |
| ----------- | ------ | --------------------------------------------------------- |
| `brief`     | ~500   | Quick lookups, chatbots with small context windows        |
| `assistant` | ~2,000 | General assistants, daily interactions                    |
| `project`   | ~3,000 | Project-focused agents, includes active project details   |
| `deep`      | ~8,000 | Full context — identity, all memories, entities, projects |

### Multi-Agent Architecture

Multiple agents can share the same user's brain by using separate API keys:

```
Agent A (Claude Code)  ──→  API Key 1 (connect.read + connect.write)  ──→  OneBrain
Agent B (ChatGPT)      ──→  API Key 2 (connect.read + connect.write)  ──→  (shared brain)
Agent C (Cron job)     ──→  API Key 3 (connect.read only)             ──→
```

Each agent reads the latest context (including memories written by other agents) and writes back its own learnings. The merge engine handles deduplication and conflict resolution automatically.

### Rate Limits for Agents

| Operation    | Limit  | Key                |
| ------------ | ------ | ------------------ |
| Read context | 30/min | Per API key prefix |
| Write memory | 10/min | Per API key prefix |
| Write batch  | 10/min | Per API key prefix |
| Delta sync   | 30/min | Per API key prefix |

### Agent Registration (3 Ways)

Agents can get an API key via three methods — no UI or human interaction required:

#### Option 1: Self-Registration (No Auth Required)

The simplest way. Any agent can register itself:

```bash
curl -s -X POST "https://onebrain.rocks/api/eu/v1/agents/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-agent",
    "description": "A coding assistant that remembers project context"
  }'
```

Returns a read-only API key (scopes: `connect.read`, `brain.read`, `entity.read`). Rate limited to 5/hour per IP.

#### Option 2: Invite Link (Admin-Controlled)

Admins create invite links with configurable access levels:

```bash
# Agent registers with an invite code
curl -s -X POST "https://onebrain.rocks/api/eu/v1/invite/register" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "partner-2026",
    "name": "my-agent",
    "description": "A coding assistant that remembers project context"
  }'
```

Invite links support:

- **Access level**: `read` (read-only) or `readwrite` (full access)
- **Max uses**: Limit how many agents can register per link
- **Expiration**: Auto-expire after N days
- **Global toggle**: Disable all invite registration with one switch
- **Per-link toggle**: Activate/deactivate individual links

Agents can also register via the web UI at `https://onebrain.rocks/invite/<code>`.

#### Option 3: Automated Provisioning (Admin Key Required)

For automated pipelines where you control the provisioning key:

**Prerequisites:** Set `AGENT_PROVISIONING_KEY` in your `.env`. The endpoint is disabled when the key is empty.

```bash
# Generate a provisioning key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Provision an agent (one request = account + API key)
curl -s -X POST "https://onebrain.rocks/api/eu/v1/agent-provision" \
  -H "Authorization: Bearer <AGENT_PROVISIONING_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-coding-agent",
    "scopes": ["connect.read", "connect.write"],
    "expiresInDays": 90
  }'
```

**Response (201 Created):**

```json
{
  "data": {
    "agentId": "uuid",
    "email": "agent-uuid@agents.onebrain.local",
    "name": "my-coding-agent",
    "apiKey": {
      "prefix": "ob_a1b2c3d4",
      "fullKey": "ob_a1b2c3d4_secret...",
      "scopes": ["connect.read", "connect.write"],
      "expiresAt": "2026-06-30T00:00:00.000Z"
    },
    "createdAt": "2026-04-01T12:00:00.000Z"
  }
}
```

**Available agent scopes:** `connect.read`, `connect.write`, `brain.read`, `entity.read`, `entity.write`, `memory.extract.write`

**Rate limit:** 10 requests/hour per IP.

**Security:**

- Provisioning key is verified with timing-safe comparison
- Agent accounts are marked as `accountType: agent` in the database
- API keys have standard expiration and can be revoked via the dashboard
- The `fullKey` is returned only once — store it securely

---

## For Teams

### Current Team Features

Organizations allow grouping users and managing membership:

```bash
# Create organization
curl -X POST "https://onebrain.rocks/api/eu/v1/orgs" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Engineering", "description": "Backend team"}'

# Add member
curl -X POST "https://onebrain.rocks/api/eu/v1/orgs/:orgId/members" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid", "role": "member"}'

# List members
curl "https://onebrain.rocks/api/eu/v1/orgs/:orgId/members" \
  -H "Authorization: Bearer <access_token>"
```

### Team Architecture

Each team member has their own brain with private memories, entities, and projects. Organization membership is currently metadata-only — there is no cross-user memory sharing.

| Feature                       | Status    |
| ----------------------------- | --------- |
| Create/manage organizations   | Available |
| Add/remove members with roles | Available |
| Individual brain per member   | Available |
| Shared team brain             | Planned   |
| Org-level API keys            | Planned   |
| Cross-user memory access      | Planned   |

### Team + Agent Workflow

Teams can use OneBrain with agents today by giving each team member their own API key:

```
Team Member A  ──→  API Key A  ──→  Brain A  ──→  Agent (reads A's context)
Team Member B  ──→  API Key B  ──→  Brain B  ──→  Agent (reads B's context)
```

Each member's agent has full access to that member's personal brain. Shared team context is on the roadmap.

---

## Merge Engine

The deterministic merge engine consolidates memory without any ML or embeddings:

1. **Duplicate detection** — same type + similar title (Dice coefficient) + similar body
2. **Conflict detection** — same type + similar topic + contradictory body
3. **Confidence scoring** — base by source type, boost on agreement, decrease on conflict
4. **Priority hierarchy** — `user_confirmed` > `user_input` > `system_inference` > `ai_extraction`
5. **Brain versioning** — snapshot of canonical state + merge log after each cycle

All merge actions include an explainability log (action, memoryIds, reason).

---

## Monetization

Plans, limits, and features are fully database-driven — editable via Admin UI without code changes.

**Default free plan:**

| Limit         | Value     |
| ------------- | --------- |
| Context calls | 100/month |
| Memory writes | 50/month  |
| Extract calls | 20/month  |

**Note on Stripe / Billing:**

OneBrain was originally designed as a SaaS product with paid plans. The full Stripe integration was built (checkout, customer portal, webhooks, subscription lifecycle, prorated upgrades/downgrades) before the project pivoted to open source. The billing code remains in the codebase and is fully functional, but **is not actively used**. Billing routes are only registered when `STRIPE_SECRET_KEY` is set — without it, all users get the free plan with no payment required. If you fork OneBrain for a commercial product, the Stripe integration is ready to use.

---

## GDPR/DSGVO Compliance

OneBrain is built for the EU market with full DSGVO compliance:

| Feature                  | Implementation                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Cookie Consent**       | 3-category banner (necessary, statistics, marketing), stored with timestamp + version                       |
| **Data Export**          | `GET /v1/user/export` — 14 categories (profile, memories, entities, projects, sessions, usage, consents...) |
| **Account Deletion**     | `DELETE /v1/user` — soft delete with 30-day grace period, then hard delete via retention job                |
| **Data Minimization**    | Only email required for auth, everything else optional                                                      |
| **PII Masking**          | Emails and IPs masked in all log output                                                                     |
| **Retention Automation** | Sessions 30d, magic links 24h, usage events 24mo, audit logs 90d, deleted users 30d                         |
| **Legal Pages**          | Impressum, Datenschutz, AGB — available in DE/EN/ES                                                         |
| **Region Isolation**     | EU data stays in EU, GLOBAL data stays in GLOBAL — no cross-region access                                   |
| **Consent Audit**        | All consents stored with IP hash, timestamp, and version for regulatory proof                               |

See [DSGVO-REPORT.md](./DSGVO-REPORT.md) for the full compliance report.

---

## Security

| Measure                                                                 | Status |
| ----------------------------------------------------------------------- | ------ |
| Helmet.js security headers (CSP, HSTS, X-Frame-Options DENY)            | Active |
| httpOnly cookies for tokens (no localStorage)                           | Active |
| CSRF protection via X-Requested-With header                             | Active |
| Rate limiting: auth 5/min, writes 30/min, global 600/min                | Active |
| CORS: explicit origins only, no wildcard                                | Active |
| SSRF protection on URL ingestion (DNS resolution + private IP blocking) | Active |
| API key hashing (SHA-256, prefix-based)                                 | Active |
| Admin role enforcement middleware                                       | Active |
| PII masking in all logs                                                 | Active |
| Persistent audit logging to database                                    | Active |
| Docker: non-root user (UID 1001), memory limits                         | Active |
| Input validation on all endpoints (Zod)                                 | Active |
| Parameterized queries only (Prisma ORM)                                 | Active |
| Webhook signature verification (Stripe)                                 | Active |
| File upload validation (type, size, 10MB limit)                         | Active |

---

## Web Application

### Pages (28 routes)

**Public:**

- `/` — Landing page
- `/login` — Authentication
- `/pricing` — Plan comparison
- `/auth/verify` — Magic link verification
- `/impressum` — Legal notice
- `/datenschutz` — Privacy policy
- `/agb` — Terms of service

**Dashboard:**

- `/dashboard` — Overview with stats and recent memories
- `/dashboard/brain` — Brain profile management
- `/dashboard/memory` — Memory list with filters and pagination
- `/dashboard/entities` — Entity management
- `/dashboard/projects` — Project management
- `/dashboard/sessions` — Active session management
- `/dashboard/ingest` — URL/file ingestion
- `/dashboard/integrations` — Integration settings
- `/dashboard/api-keys` — API key management
- `/dashboard/billing` — Subscription and billing
- `/dashboard/usage` — Usage analytics
- `/dashboard/referrals` — Referral system
- `/dashboard/shares` — Shared brain snapshots
- `/dashboard/agents` — Connected agents overview
- `/dashboard/agents/[id]` — Agent detail (config, activity, candidates)
- `/dashboard/onboarding` — First-time user onboarding

**Admin:**

- `/dashboard/admin` — Admin dashboard
- `/dashboard/admin/users` — User management
- `/dashboard/admin/audit` — Audit log viewer
- `/dashboard/admin/plans` — Plan management
- `/dashboard/admin/plans/[id]` — Plan detail editor

### Features

- **PWA**: installable app with service worker, offline caching, standalone mode
- **Responsive**: mobile-first with 768px breakpoint
- **Keyboard shortcuts**: navigation shortcuts for power users
- **i18n**: language switcher (DE/EN/ES) with localStorage persistence
- **RTL support**: right-to-left layout via RtlProvider
- **Cookie consent**: GDPR banner with 3 categories
- **Dark theme**: `#0f0f23` base, consistent dark palette

---

## Docker Deployment

### Build & Run

```bash
# Build all images
docker compose -f infra/region-eu/docker-compose.yml build
docker compose -f infra/control-plane/docker-compose.yml build

# Start EU region (API + PostgreSQL + Redis + MCP + migrations)
docker compose -f infra/region-eu/docker-compose.yml up -d

# Start control plane (Caddy reverse proxy + Web)
docker compose -f infra/control-plane/docker-compose.yml up -d

# Optional: Start GLOBAL region
docker compose -f infra/region-global/docker-compose.yml up -d
```

### Container Architecture

| Service    | Image                   | Memory Limit | Health Check               |
| ---------- | ----------------------- | ------------ | -------------------------- |
| `postgres` | postgres:16-alpine      | 1G           | `pg_isready` every 10s     |
| `redis`    | redis:7-alpine          | 512M         | `redis-cli ping` every 10s |
| `api`      | custom (node:22-alpine) | 512M         | `wget /health` every 30s   |
| `web`      | custom (node:22-alpine) | 256M         | `wget /` every 30s         |
| `mcp`      | custom (node:22-alpine) | —            | depends on api             |
| `caddy`    | caddy:2-alpine          | —            | `wget :80` every 30s       |
| `migrate`  | same as api             | —            | runs once, then exits      |

All custom images use multi-stage builds with non-root user (UID 1001).

### Caddy Reverse Proxy

- Auto-HTTPS via Let's Encrypt
- Region-based API routing (`/api/eu/*` → EU API, `/api/global/*` → GLOBAL API)
- Security headers (HSTS, X-Frame-Options, noSniff)
- gzip + zstd compression
- Server header stripped

---

## CI/CD

### GitHub Actions

**ci.yml** — runs on every push and PR:

- Install dependencies (pnpm)
- Type checking (all workspaces)
- Linting (ESLint)
- Tests (Vitest, 365 tests)
- Build verification

**deploy.yml** — blue-green deployment to Hetzner VPS:

- Build Docker images
- Push to registry
- Deploy with zero-downtime swap
- Health check verification
- Automatic rollback on failure

---

## Database

### Schema Overview

**31 models** across 4 domains:

| Domain           | Models                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Auth**         | User, Session, MagicLinkToken, ApiKey, AgentActivity                                                                |
| **Brain**        | BrainProfile, MemoryItem, Entity, EntityLink, Project, ProjectMemoryLink, BrainVersion, SourceEvent, Tag, MemoryTag |
| **Learning**     | DailyQuestion                                                                                                       |
| **Monetization** | Plan, PlanLimit, PlanFeature, UserPlan, UsageEvent, Subscription                                                    |
| **Growth**       | Referral, BrainShare                                                                                                |
| **Compliance**   | AuditLog, Consent                                                                                                   |
| **Settings**     | NotificationPreference, FileUpload                                                                                  |

**8 enums**: Region, Locale, MemoryType, MemoryStatus, SourceType, ProjectStatus, UserRole, SubscriptionStatus

All tables have `createdAt` + `updatedAt` with DB-level defaults. UUIDs for primary keys. Cascading deletes on user relationships.

### Migrations

```bash
# Apply migrations
DATABASE_URL="..." pnpm --filter @onebrain/db exec prisma migrate deploy

# Generate client after schema changes
pnpm --filter @onebrain/db exec prisma generate
```

---

## Testing

```bash
# Run all 365 tests (23 test files)
pnpm --filter @onebrain/api exec vitest run

# Run specific suite
pnpm --filter @onebrain/api exec vitest run src/__tests__/context-engine.test.ts

# Watch mode
pnpm --filter @onebrain/api exec vitest

# With coverage
pnpm --filter @onebrain/api exec vitest run --coverage
```

### Test Suites

| Suite                      | Tests | Category    |
| -------------------------- | ----- | ----------- |
| Tokens                     | 9     | Unit        |
| Response helpers           | 5     | Unit        |
| Audit logging              | 4     | Unit        |
| Text normalization         | 9     | Unit        |
| String similarity          | 11    | Unit        |
| Merge engine               | 18    | Unit        |
| API keys                   | 14    | Unit        |
| Daily questions            | 11    | Unit        |
| Context engine             | 40    | Unit        |
| Monetization               | 13    | Unit        |
| Viral & growth             | 15    | Unit        |
| GDPR service               | 12    | Unit        |
| Stripe service             | 8     | Unit        |
| Security (SSRF, headers)   | 10    | Unit        |
| PII masking                | 6     | Unit        |
| i18n pluralization         | 4     | Unit        |
| Auth integration           | 14    | Integration |
| Memory integration         | 14    | Integration |
| Billing integration        | 21    | Integration |
| Agent activity integration | 24    | Integration |
| Admin GDPR integration     | 29    | Integration |
| Core features integration  | 46    | Integration |

---

## Environment Variables

### Required

| Variable       | Description                       |
| -------------- | --------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string      |
| `JWT_SECRET`   | JWT signing secret (min 32 chars) |
| `CORS_ORIGIN`  | Allowed CORS origin               |

### API Server

| Variable               | Default                | Description             |
| ---------------------- | ---------------------- | ----------------------- |
| `API_PORT`             | 3001                   | API server port         |
| `API_HOST`             | 0.0.0.0                | API bind address        |
| `NODE_ENV`             | development            | Environment mode        |
| `JWT_EXPIRY`           | 15m                    | Access token lifetime   |
| `REFRESH_TOKEN_EXPIRY` | 7d                     | Refresh token lifetime  |
| `MAGIC_LINK_EXPIRY`    | 15m                    | Magic link lifetime     |
| `REDIS_URL`            | redis://localhost:6379 | Redis connection string |

### Email

| Variable    | Default                | Description      |
| ----------- | ---------------------- | ---------------- |
| `SMTP_HOST` | localhost              | Mail server      |
| `SMTP_PORT` | 1025                   | Mail server port |
| `SMTP_USER` | —                      | SMTP username    |
| `SMTP_PASS` | —                      | SMTP password    |
| `SMTP_FROM` | noreply@onebrain.rocks | Sender address   |

### Web App

| Variable                | Default               | Description          |
| ----------------------- | --------------------- | -------------------- |
| `NEXT_PUBLIC_API_URL`   | http://localhost:3001 | API URL for frontend |
| `NEXT_PUBLIC_DEMO_MODE` | false                 | Enable demo features |

### OAuth (Optional)

| Variable                       | Description                                    |
| ------------------------------ | ---------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID                         |
| `NEXT_PUBLIC_APPLE_CLIENT_ID`  | Apple OAuth client ID                          |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth client ID (frontend redirect)     |
| `GITHUB_CLIENT_ID`             | GitHub OAuth client ID (backend code exchange) |
| `GITHUB_CLIENT_SECRET`         | GitHub OAuth client secret                     |

### Stripe (Optional — legacy SaaS, not active)

| Variable                 | Description                    |
| ------------------------ | ------------------------------ |
| `STRIPE_SECRET_KEY`      | Stripe API secret key          |
| `STRIPE_WEBHOOK_SECRET`  | Stripe webhook signing secret  |
| `STRIPE_PUBLISHABLE_KEY` | Stripe public key for frontend |

### MCP Server

| Variable           | Default               | Description          |
| ------------------ | --------------------- | -------------------- |
| `ONEBRAIN_API_URL` | http://localhost:3001 | API URL for MCP      |
| `ONEBRAIN_API_KEY` | —                     | API key for MCP auth |

---

## Development Commands

```bash
pnpm install            # Install all dependencies
pnpm dev                # Start all apps (Turborepo)
pnpm build              # Build everything
pnpm typecheck          # Type-check all workspaces
pnpm lint               # Lint all code (ESLint)
pnpm format             # Format with Prettier
pnpm format:check       # Check formatting
pnpm clean              # Remove all build artifacts
```

---

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for the full version history.

**Current: v1.8.0** — 470+ features, 365 tests, 31 database models.

---

## Links

| Resource   | URL                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------- |
| Website    | [onebrain.rocks](https://onebrain.rocks)                                                  |
| SDK (npm)  | [onebrain](https://www.npmjs.com/package/onebrain)                                        |
| SDK Source | [onebrainaimemory/onebrainagentsdk](https://github.com/onebrainaimemory/onebrainagentsdk) |
| MCP Server | [onebrain-mcp](https://www.npmjs.com/package/onebrain-mcp)                                |
| Main Repo  | [onebrainaimemory/onebrain](https://github.com/onebrainaimemory/onebrain)                 |

---

## License

MIT — Copyright 2026 AZapp One

---

Made with ❤️ with [OneBrain](https://github.com/onebrainaimemory/onebrain)
