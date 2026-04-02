# Contributing to OneBrain

Thank you for your interest in contributing to OneBrain! This guide will help you get started.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 16
- Redis 7 (optional for development, required for production)

## Setup

```bash
git clone <repo-url> onebrain
cd onebrain
pnpm install

# Create database
createdb onebrain

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET (min 32 chars)

# Run migrations and generate Prisma client
pnpm --filter @onebrain/db exec prisma migrate deploy
pnpm --filter @onebrain/db exec prisma generate

# Start all apps
pnpm dev
```

## Code Style

- **ESLint** enforces code quality rules (run `pnpm lint`)
- **Prettier** enforces formatting (run `pnpm format`)
- A **pre-commit hook** (husky + lint-staged) auto-formats staged files
- TypeScript **type-only imports** are enforced: use `import type { Foo }`
- **ESM** throughout — imports require `.js` extensions

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Examples:

- `feat(auth): add GitHub OAuth login`
- `fix(security): add CSRF check on refresh endpoint`
- `docs: update README with new API endpoints`

## Pull Request Process

1. **Branch from `main`** — use a descriptive branch name (`feat/github-oauth`, `fix/csrf-refresh`)
2. **Write tests first** — we follow TDD. Coverage must stay above 80%
3. **Run the full check suite** before pushing:
   ```bash
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm --filter @onebrain/api run test
   pnpm --filter @onebrain/web run test
   pnpm build
   ```
4. **CI must pass** — format, lint, typecheck, tests, build, coverage threshold
5. **Keep PRs focused** — one feature or fix per PR
6. **Security-sensitive paths** require maintainer review (see CODEOWNERS)

## Testing

- **Framework:** Vitest
- **API tests:** `pnpm --filter @onebrain/api run test`
- **Web tests:** `pnpm --filter @onebrain/web run test`
- **Single file:** `pnpm --filter @onebrain/api run test src/__tests__/similarity.test.ts`
- **Coverage:** `pnpm --filter @onebrain/api run test -- --coverage`
- **Threshold:** 80% lines, 75% branches (enforced in CI)

## Project Structure

```
apps/api/     — Fastify REST API (port 3001)
apps/web/     — Next.js dashboard (port 3000)
apps/mcp/     — MCP server for AI tools (stdio)
packages/db/  — Prisma schema + client
packages/shared/  — TypeScript types
packages/schemas/ — Zod validation schemas
packages/i18n/    — Translations (DE/EN/ES)
```

## Security

If you discover a security vulnerability, please do **not** open a public issue. Instead, email the maintainers directly. See SECURITY-AUDIT.md for the current security posture.

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.
