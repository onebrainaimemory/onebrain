# OneBrain — Comprehensive Audit Report

**Date:** 2026-03-24  
**Scope:** Full Monorepo (apps/api, apps/web, apps/mcp, packages/\*)  
**Auditor:** Automated Code Review

---

## Executive Summary

OneBrain is a well-structured Turborepo monorepo with solid fundamentals: good CI/CD, proper authentication, DSGVO compliance features, and a well-designed context engine. The Prisma schema has **73 indexes across 30 models** — thorough coverage. Test coverage exists with ~2300 LOC of tests and an 80% CI threshold.

However, the audit reveals **2 Critical**, **5 High**, **8 Medium**, and **6 Low** findings. The most urgent issues are:

1. **SQL Injection** in `embedding.service.ts` via `$queryRawUnsafe` with string interpolation
2. **Hardcoded outdated embedding model** (`text-embedding-ada-002` — deprecated by OpenAI)
3. **O(n²) deduplication** algorithms that don't scale
4. **Code duplication** between `consolidation.service.ts`, `dedup.service.ts`, and `memory.service.ts`

---

## Findings by Severity

### 🔴 CRITICAL

#### C1: SQL Injection in Semantic Search

**File:** `apps/api/src/services/embedding.service.ts`  
**Lines:** 91-109 (`semanticSearch` function)

The `semanticSearch` function uses `$queryRawUnsafe` with direct string interpolation of `userId` and `queryEmbedding`:

```typescript
const results = await prisma.$queryRawUnsafe<...>(`
  SELECT m.id as memory_item_id, m.title, m.body, m.type, m.confidence,
         1 - (e.embedding <=> '${JSON.stringify(queryEmbedding)}'::vector) as score
  FROM embeddings e
  JOIN memory_items m ON m.id = e.memory_item_id
  WHERE m.user_id = '${userId}'::uuid
    ...
  LIMIT ${topK}
`);
```

**Risk:** A malicious `userId` could inject arbitrary SQL. Even though `userId` comes from JWT in practice, defense-in-depth requires parameterized queries.

**Fix:**

```typescript
const results = await prisma.$queryRawUnsafe<...>(
  `
    SELECT m.id as memory_item_id, m.title, m.body, m.type, m.confidence,
           1 - (e.embedding <=> $1::vector) as score
    FROM embeddings e
    JOIN memory_items m ON m.id = e.memory_item_id
    WHERE m.user_id = $2::uuid
      AND m.deleted_at IS NULL
      AND m.status = 'active'
    ORDER BY e.embedding <=> $1::vector
    LIMIT $3
  `,
  JSON.stringify(queryEmbedding),
  userId,
  topK,
);
```

Or switch to `Prisma.$queryRaw` with tagged template literals.

---

#### C2: Deprecated Embedding Model

**File:** `apps/api/src/services/embedding.service.ts`  
**Line:** 5

```typescript
const EMBEDDING_MODEL = 'text-embedding-ada-002';
```

`text-embedding-ada-002` was deprecated by OpenAI in January 2025. It still works but is more expensive and slower than `text-embedding-3-small`.

**Fix:**

```typescript
const EMBEDDING_MODEL = process.env['EMBEDDING_MODEL'] ?? 'text-embedding-3-small';
```

---

### 🟠 HIGH

#### H1: O(n²) Deduplication Algorithms Don't Scale

**Files:**

- `apps/api/src/services/consolidation.service.ts` (lines 25-42)
- `apps/api/src/services/memory.service.ts` (`scanForDuplicates`, lines 215-240)
- `apps/api/src/services/merge.service.ts` (`detectDuplicates`, lines 72-90)

All three functions use nested loops comparing every item against every other item. With `take: 200`, that's up to 19,900 comparisons. For users with more memories, this is O(n²) and will timeout.

**Fix:** Pre-filter by type (already done), then use a locality-sensitive hashing (LSH) or bucketing strategy. For text similarity, a quick length-ratio pre-filter eliminates most pairs before expensive Levenshtein/Dice computation.

```typescript
// Quick pre-filter: skip if lengths differ by >30%
if (Math.abs(a.body.length - b.body.length) / Math.max(a.body.length, b.body.length) > 0.3)
  continue;
```

---

#### H2: Missing Tests for Key Services

**Files without test coverage:**

- `apps/api/src/services/embedding.service.ts` — **no tests**
- `apps/api/src/services/consolidation.service.ts` — **no tests**
- `apps/api/src/services/retention.service.ts` — **no tests**
- `apps/api/src/services/brain.service.ts` — **no tests**

These are core services handling data integrity, embeddings, and billing-related brain profiles. The context engine (`464 LOC tests`) and merge engine (`252 LOC tests`) are well-tested by comparison.

---

#### H3: Hardcoded Similarity Thresholds Scattered Across Codebase

**Files:**

- `consolidation.service.ts`: `threshold * 0.6` for body similarity (line 38)
- `memory.service.ts`: `0.8` title, `0.5` body (lines 199-206)
- `dedup.service.ts`: `0.8` threshold (line 37)
- `merge.service.ts`: `0.6` title, `0.5` body (lines 78-79)

These magic numbers are inconsistent and duplicated. `consolidation.service.ts` uses `threshold * 0.6` while `memory.service.ts` uses hardcoded `0.5`.

**Fix:** Extract to a shared config/constants:

```typescript
// packages/shared/src/constants.ts
export const SIMILARITY = {
  DUPLICATE_TITLE: 0.8,
  DUPLICATE_BODY: 0.5,
  MERGE_TITLE: 0.6,
  MERGE_BODY: 0.5,
  CONFLICT_TITLE: 0.5,
} as const;
```

---

#### H4: `normalize()` Function Duplicated 3 Times

**Files:**

- `apps/api/src/lib/text-normalize.ts` (canonical)
- `apps/api/src/services/dedup.service.ts` (line 52 — redefined locally)
- Uses `diceCoefficient` from `similarity.ts` in consolidation, but `levenshtein` in dedup

`dedup.service.ts` has its own `normalize()` and `levenshtein()` implementations instead of using the shared `text-normalize.ts` and `similarity.ts`. Also uses a **different similarity algorithm** (Levenshtein) than the rest of the codebase (Dice coefficient).

**Fix:** Import from shared modules:

```typescript
import { normalize } from '../lib/text-normalize.js';
import { isSimilar } from '../lib/similarity.js';
```

---

#### H5: No Dockerfile for API

The repo has Dockerfiles for MCP and Web, but **no Dockerfile for the API server** — the primary backend service. This suggests either manual deployment or an undocumented process.

---

### 🟡 MEDIUM

#### M1: Retention Service Hard-Deletes User Data Without Cascade

**File:** `apps/api/src/services/retention.service.ts` (lines 48-55)

```typescript
const usersToDelete = await prisma.user.findMany({
  where: { deletedAt: { not: null, lt: userCutoff } },
  select: { id: true },
});
if (usersToDelete.length > 0) {
  const userIds = usersToDelete.map((u) => u.id);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
```

This hard-deletes users after 30 days. While Prisma cascades are defined in the schema, this is a **DSGVO-relevant operation** that should:

1. Log an audit trail before deletion
2. Generate an export for the user's records
3. Use a transaction with error handling
4. Consider GDPR's right to erasure requirements (e.g., 30-day notice period)

**Fix:**

```typescript
if (usersToDelete.length > 0) {
  for (const user of usersToDelete) {
    // Export data first
    await exportUserData(user.id);
    audit(user.id, 'hard_delete', 'user', user.id);
  }
  await prisma.$transaction(userIds.map((id) => prisma.user.delete({ where: { id } })));
}
```

---

#### M2: `extractMemory` Has N+1 Query Pattern

**File:** `apps/api/src/services/memory.service.ts` (lines 159-185)

```typescript
// 1. Create sourceEvent
const sourceEvent = await prisma.sourceEvent.create(...);
// 2. Create memoryItem
const item = await prisma.memoryItem.create(...);
// 3. Update sourceEvent with memoryItemId
await prisma.sourceEvent.update({ where: { id: sourceEvent.id }, ... });
// 4. autoMergeCandidate (does multiple queries)
// 5. Re-fetch the item
const updated = await prisma.memoryItem.findUnique(...);
```

That's 3-5 sequential DB round-trips for a single memory extraction. Steps 1 and 2 should use a transaction. Step 3's update can be combined with step 1.

**Fix:** Use `prisma.$transaction` and include `memoryItemId` in the sourceEvent create:

```typescript
const [sourceEvent, item] = await prisma.$transaction([
  prisma.sourceEvent.create({ data: { userId, sourceType: input.sourceType, rawContent: '...' } }),
  prisma.memoryItem.create({ data: { ..., sourceEventId: ??? } }),
]);
```

Or use interactive transactions.

---

#### M3: No Input Validation on `importMemories` Batch Size

**File:** `apps/api/src/services/memory.service.ts` (lines 248-283)

The `importMemories` function accepts an arbitrary array of items with no limit. A user could import 100,000 memories in one request, causing:

- OOM from loading all items
- Extremely long request times
- Sequential DB inserts (no batching)

**Fix:** Add a batch limit:

```typescript
export async function importMemories(
  userId: string,
  items: ImportItem[],
): Promise<{ created: number; errors: string[] }> {
  if (items.length > 500) {
    throw new Error('Batch size exceeds maximum of 500 items');
  }
  // ...
}
```

Also use `prisma.$transaction` with `createMany` for batch inserts.

---

#### M4: CI Pipeline Has No E2E Tests

**File:** `.github/workflows/ci.yml`

The CI runs unit tests and build verification but has no E2E test step. The repo contains `apps/web/e2e/login.spec.ts` and `apps/web/e2e/dashboard.spec.ts` but they are not executed in CI.

**Fix:** Add a Playwright E2E job:

```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    -  # ... checkout, setup
    - name: Install Playwright
      run: pnpm --filter @onebrain/web exec playwright install --with-deps
    - name: Run E2E tests
      run: pnpm --filter @onebrain/web exec playwright test
```

---

#### M5: `runMerge` Loads ALL Active Memories Without Limit

**File:** `apps/api/src/services/merge.service.ts` (line 166)

```typescript
const rawExisting = await prisma.memoryItem.findMany({
  where: { userId, status: 'active' },
});
```

For users with thousands of active memories, this loads everything into memory. Should use pagination or at least a reasonable `take` limit.

---

#### M6: `_body` Parameter in `findDuplicateMemory` Is Unused

**File:** `apps/api/src/services/dedup.service.ts` (line 15)

```typescript
export async function findDuplicateMemory(
  userId: string,
  type: string,
  title: string,
  _body: string,  // ← prefixed with _ but still accepted
): Promise<...>
```

The `_body` parameter is never used in the function. The function only compares titles. This means the dedup service is **not comparing body content** despite accepting it. Either remove the parameter or use it for body similarity checks.

---

#### M7: `context-engine` Token Estimation Is Approximate

**File:** `apps/api/src/lib/context-engine/compress.ts`

Token estimation uses `text.length / 4` (or `/ 3.2` for JSON). This is a rough heuristic that can be off by 20-40%. For an LLM context engine where token budgets matter, this could lead to:

- Over-truncation (sending less context than budget allows)
- Under-truncation (exceeding actual token limits)

**Fix:** Use the `tiktoken` library for accurate GPT token counting, or at minimum document the margin of error and add a safety buffer (e.g., 80% of budget).

---

#### M8: Magic Link Token Not Rate-Limited

**File:** `apps/api/src/services/auth.service.ts` (`requestMagicLink`)

The `requestMagicLink` function creates a new token without rate limiting. An attacker could spam the endpoint to send many emails to a victim (email bombing). The global rate limit (600/min) helps, but a per-email rate limit would be better.

**Fix:** Add per-email cooldown:

```typescript
const cooldownKey = `magiclink_cooldown:${email}`;
const existing = await getCache(cooldownKey);
if (existing) {
  throw new AuthError('TOO_MANY_REQUESTS', 'auth.magic_link.cooldown', 429);
}
await setCache(cooldownKey, '1', 60); // 60s cooldown
```

---

### 🟢 LOW

#### L1: Unused `TokenPair` Interface in `password.service.ts`

**File:** `apps/api/src/services/password.service.ts` (line 10)

`TokenPair` is defined locally but already exists in `auth.service.ts` with the same shape. Should be shared.

---

#### L2: `parseExpiry` Duplicated in `auth.service.ts` and `password.service.ts`

Both files contain identical `parseExpiry` functions. Extract to a shared utility.

---

#### L3: No MCP Dockerfile Caching Optimization

**File:** `apps/mcp/Dockerfile`

The Dockerfile installs all dependencies before building. Consider layer ordering: copy `package.json` files first (already done) but also separate `devDependencies` from `prodDependencies` to reduce rebuild times.

---

#### L4: Web Next.js Config Not Reviewed

The Next.js config (`apps/web/next.config.js`) was not found/reviewed. Verify:

- `output: 'standalone'` for Docker (seems enabled based on Dockerfile)
- No `dangerouslyAllowSVG` or unsafe image domains
- Proper CSP headers via middleware

---

#### L5: No `.env.example` File

No `.env.example` or `.env.schema` file found. New developers must read `config.ts` to discover required environment variables.

**Fix:** Create `.env.example`:

```
JWT_SECRET=
DATABASE_URL=
SMTP_HOST=
SMTP_FROM=
CORS_ORIGIN=
STRIPE_SECRET_KEY=
REDIS_URL=
```

---

#### L6: `hybridSearch` Weighting May Produce Unintuitive Results

**File:** `apps/api/src/services/embedding.service.ts` (lines 129-166)

Text search results are scored by rank position (`1 - idx / length`), not by actual text similarity. Item at position 0 gets score 1.0 regardless of how well it actually matched. Consider using `contains` match quality or PostgreSQL full-text search ranking instead.

---

## Summary Table

| ID  | Severity    | Category       | File                         | Description                                          |
| --- | ----------- | -------------- | ---------------------------- | ---------------------------------------------------- |
| C1  | 🔴 Critical | Security       | embedding.service.ts         | SQL injection via `$queryRawUnsafe`                  |
| C2  | 🔴 Critical | Performance    | embedding.service.ts         | Deprecated `ada-002` model                           |
| H1  | 🟠 High     | Performance    | consolidation, memory, merge | O(n²) dedup algorithms                               |
| H2  | 🟠 High     | Testing        | Multiple                     | No tests for embedding/consolidation/retention/brain |
| H3  | 🟠 High     | Quality        | Multiple                     | Inconsistent hardcoded similarity thresholds         |
| H4  | 🟠 High     | Quality        | dedup.service.ts             | Duplicate `normalize()` + different similarity algo  |
| H5  | 🟠 High     | Infrastructure | Root                         | No API Dockerfile                                    |
| M1  | 🟡 Medium   | DSGVO          | retention.service.ts         | Hard-delete without audit/export                     |
| M2  | 🟡 Medium   | Performance    | memory.service.ts            | N+1 in `extractMemory`                               |
| M3  | 🟡 Medium   | Security       | memory.service.ts            | Unbounded batch import size                          |
| M4  | 🟡 Medium   | CI/CD          | ci.yml                       | No E2E tests in pipeline                             |
| M5  | 🟡 Medium   | Performance    | merge.service.ts             | Unbounded `findMany` on active memories              |
| M6  | 🟡 Medium   | Quality        | dedup.service.ts             | Unused `_body` param                                 |
| M7  | 🟡 Medium   | Quality        | compress.ts                  | Imprecise token estimation                           |
| M8  | 🟡 Medium   | Security       | auth.service.ts              | Magic link not rate-limited per email                |
| L1  | 🟢 Low      | Quality        | password.service.ts          | Duplicated `TokenPair` type                          |
| L2  | 🟢 Low      | Quality        | auth + password              | Duplicated `parseExpiry`                             |
| L3  | 🟢 Low      | Infrastructure | mcp/Dockerfile               | No dev/prod dep separation                           |
| L4  | 🟢 Low      | Infrastructure | web                          | Next.js config not audited                           |
| L5  | 🟢 Low      | Developer UX   | Root                         | No `.env.example`                                    |
| L6  | 🟢 Low      | Quality        | embedding.service.ts         | Rank-based text scoring is imprecise                 |

---

## Prioritized Action Items

### Sprint 1 (Immediate — This Week)

1. **[C1]** Fix SQL injection in `semanticSearch` — switch to parameterized queries
2. **[C2]** Update embedding model to `text-embedding-3-small` (configurable via env)
3. **[M8]** Add per-email rate limiting to magic link requests
4. **[M3]** Add batch size limit to `importMemories`

### Sprint 2 (Next Week)

5. **[H1]** Add length-ratio pre-filter to all O(n²) dedup loops
6. **[H4]** Unify `normalize()` and similarity functions — use shared modules
7. **[H3]** Extract similarity thresholds to shared constants
8. **[M1]** Add audit logging before user hard-deletion in retention

### Sprint 3 (Upcoming)

9. **[H2]** Write tests for embedding, consolidation, retention, and brain services
10. **[M2]** Refactor `extractMemory` to use `$transaction`
11. **[M5]** Add `take` limit to `runMerge` active memory fetch
12. **[M4]** Add E2E tests to CI pipeline
13. **[H5]** Create API Dockerfile

### Backlog

14. **[M7]** Evaluate `tiktoken` for accurate token counting
15. **[L1-L6]** Code cleanup: deduplicate types, add `.env.example`, audit Next.js config
16. **[L6]** Improve hybrid search text scoring

---

## Positive Observations

- **Security foundation is strong:** Helmet, CORS hardening (no wildcards in prod), JWT test secret guard, bcrypt with cost factor 12, rate limiting
- **Auth is well-designed:** Magic link + password + 2FA (TOTP), account lockout, session management, PII masking
- **CI/CD is comprehensive:** Format check, lint, type check, security audit, test coverage threshold (80%), build verification
- **Context engine is well-architected:** Clean separation (types → relevance → filter → compress → format), deterministic scoring, explainability via reasons array
- **Merge engine is thorough:** Full pipeline with conflict detection, confidence handling, versioning, rollback support, audit logging
- **Prisma schema has excellent index coverage:** 73 indexes for 30 models
- **DSGVO features exist:** GDPR routes, audit logging, consent model, soft-delete patterns
- **Docker builds are secure:** Non-root user, multi-stage builds, minimal images
