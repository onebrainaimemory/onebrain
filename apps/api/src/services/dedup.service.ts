import { getClient } from '@onebrain/db';
import { normalize, SimilarityThresholds } from '@onebrain/shared';

const { DEDUP: DEDUP_THRESHOLD } = SimilarityThresholds;

/**
 * Finds an existing memory that is similar enough to be a duplicate.
 *
 * Matching criteria:
 * - Same user, same type, status = active
 * - Title similarity ≥ DEDUP_THRESHOLD (normalized Levenshtein)
 *
 * Returns the existing memory if a duplicate is found, null otherwise.
 */
export async function findDuplicateMemory(
  userId: string,
  type: string,
  title: string,
  body: string,
): Promise<{ id: string; type: string; title: string; body: string; status: string } | null> {
  const prisma = getClient();

  // NOTE: take: 200 bounds query latency. Future: cursor-based pagination.
  const candidates = await prisma.memoryItem.findMany({
    where: {
      userId,
      type: type as 'fact' | 'preference' | 'decision' | 'goal' | 'experience' | 'skill',
      status: 'active',
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: { id: true, type: true, title: true, body: true, status: true },
  });

  const normalizedTitle = normalize(title, { lowercase: true });

  for (const candidate of candidates) {
    const titleSim = titleSimilarity(
      normalizedTitle,
      normalize(candidate.title, { lowercase: true }),
    );
    if (titleSim >= DEDUP_THRESHOLD) {
      // Also check body similarity as a secondary signal
      const bodySim = titleSimilarity(
        normalize(body, { lowercase: true }),
        normalize(candidate.body, { lowercase: true }),
      );
      if (bodySim >= DEDUP_THRESHOLD * 0.6) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Compute similarity between two strings using normalized Levenshtein.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);
  return 1 - distance / maxLen;
}

/**
 * Classic Levenshtein distance with early exit optimization.
 * Uses two-row approach for O(min(m,n)) space.
 */
function levenshtein(a: string, b: string): number {
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;

  // Early exit: if length difference alone exceeds 20% of max,
  // they can't be 80% similar
  if (bLen - aLen > bLen * 0.2) {
    return bLen;
  }

  let prev = new Array<number>(aLen + 1);
  let curr = new Array<number>(aLen + 1);

  for (let i = 0; i <= aLen; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(prev[i]! + 1, curr[i - 1]! + 1, prev[i - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[aLen]!;
}
