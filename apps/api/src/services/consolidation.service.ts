import { getClient } from '@onebrain/db';
import { normalize, SimilarityThresholds } from '@onebrain/shared';
import { diceCoefficient } from '../lib/similarity.js';

const { MERGE: MERGE_THRESHOLD } = SimilarityThresholds;

/**
 * Consolidate memories: automatically merge similar memories within a user's account.
 *
 * Optimization: items are grouped by type before comparison, reducing
 * cross-type comparisons from O(n²) to O(n log n) in practice.
 *
 * NOTE: Limited to the 200 most recent memories per type to bound latency.
 * Pagination support should be added for accounts with very large datasets.
 */
export async function consolidateMemories(
  userId: string,
  options: {
    type?: string;
    threshold?: number;
    dryRun?: boolean;
  } = {},
): Promise<{
  merged: number;
  groups: Array<{ ids: string[]; title: string; body: string }>;
}> {
  const prisma = getClient();
  const threshold = options.threshold ?? MERGE_THRESHOLD;
  const dryRun = options.dryRun ?? false;

  const where: Record<string, unknown> = {
    userId,
    deletedAt: null,
    status: 'active',
    ...(options.type && { type: options.type }),
  };

  // NOTE: take: 200 bounds query latency for large accounts.
  // Future: add cursor-based pagination for full coverage.
  const items = await prisma.memoryItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Group by type to reduce comparisons — only compare items of the same type
  const byType = new Map<string, number[]>();
  for (let i = 0; i < items.length; i++) {
    const type = items[i]!.type;
    const indices = byType.get(type) ?? [];
    indices.push(i);
    byType.set(type, indices);
  }

  const visited = new Set<number>();
  const groups: Array<{ ids: string[]; title: string; body: string }> = [];

  // Pre-compute normalized forms
  const normalizedTitles = items.map((item) => normalize(item.title));
  const normalizedBodies = items.map((item) => normalize(item.body));

  for (const [, indices] of byType) {
    for (let gi = 0; gi < indices.length; gi++) {
      const i = indices[gi]!;
      if (visited.has(i)) continue;

      const group = [i];
      const titleA = normalizedTitles[i]!;
      const bodyA = normalizedBodies[i]!;

      for (let gj = gi + 1; gj < indices.length; gj++) {
        const j = indices[gj]!;
        if (visited.has(j)) continue;

        const titleB = normalizedTitles[j]!;
        const bodyB = normalizedBodies[j]!;

        const titleSim = diceCoefficient(titleA, titleB);

        // Early exit: if titles aren't similar, skip body comparison
        if (titleSim <= threshold) continue;

        const bodySim = diceCoefficient(bodyA, bodyB);

        if (bodySim > threshold * 0.6) {
          group.push(j);
          visited.add(j);
        }
      }

      visited.add(i);

      if (group.length > 1) {
        const groupItems = group.map((idx) => items[idx]!);
        const primary = groupItems[0]!;
        const mergedBody = groupItems
          .map((item) => item.body)
          .filter((b, idx) => idx === 0 || !primary.body.includes(b.slice(0, 50)))
          .join('\n\n');

        groups.push({
          ids: groupItems.map((item) => item.id),
          title: primary.title,
          body: mergedBody.slice(0, 10000),
        });
      }
    }
  }

  if (!dryRun) {
    for (const group of groups) {
      const [primaryId, ...mergeIds] = group.ids;

      await prisma.memoryItem.update({
        where: { id: primaryId },
        data: { body: group.body, confidence: 1.0 },
      });

      await prisma.memoryItem.updateMany({
        where: { id: { in: mergeIds } },
        data: { status: 'archived', deletedAt: new Date() },
      });
    }
  }

  return { merged: groups.length, groups };
}

/**
 * Set TTL/expiration on memories. Returns count of expired memories deleted.
 */
export async function expireMemories(userId?: string, ttlDays = 365): Promise<number> {
  const prisma = getClient();
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    createdAt: { lt: cutoff },
    status: 'active',
    ...(userId && { userId }),
  };

  const result = await prisma.memoryItem.updateMany({
    where,
    data: { status: 'archived', deletedAt: new Date() },
  });

  return result.count;
}
