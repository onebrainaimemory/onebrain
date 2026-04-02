import { getClient } from '@onebrain/db';
import { isEmbeddingEnabled } from './embedding.service.js';
import { enqueueEmbedding } from '../queues/embedding.queue.js';

// ─── Types ───

export interface EmbeddingStatus {
  totalMemories: number;
  embedded: number;
  pending: number;
  failed: number;
  missing: number;
  coverage: number;
}

export interface ReindexOptions {
  /** Filter: only reindex items with this embedding status. Default: missing + failed */
  status?: 'failed' | 'missing';
  /** Max items to enqueue in one batch. Default: 500 */
  maxItems?: number;
}

export interface ReindexResult {
  total: number;
  queued: number;
  errors: number;
  error?: string;
}

// ─── Embedding Status ───

/**
 * Get embedding coverage stats for a user's memories.
 */
export async function getEmbeddingStatus(userId: string): Promise<EmbeddingStatus> {
  const prisma = getClient();
  const baseWhere = { userId, status: 'active' as const, deletedAt: null };

  const [total, embedded, pending, failed, missing] = await Promise.all([
    prisma.memoryItem.count({ where: baseWhere }),
    prisma.memoryItem.count({ where: { ...baseWhere, embeddingStatus: 'completed' } }),
    prisma.memoryItem.count({ where: { ...baseWhere, embeddingStatus: 'pending' } }),
    prisma.memoryItem.count({ where: { ...baseWhere, embeddingStatus: 'failed' } }),
    prisma.memoryItem.count({ where: { ...baseWhere, embeddingStatus: 'none' } }),
  ]);

  return {
    totalMemories: total,
    embedded,
    pending,
    failed,
    missing,
    coverage: total > 0 ? Math.round((embedded / total) * 100) / 100 : 0,
  };
}

// ─── Batch Reindex ───

/**
 * Find memories without embeddings (or with failed status) and enqueue them.
 * Returns how many were queued.
 */
export async function batchReindex(
  userId: string,
  options: ReindexOptions = {},
): Promise<ReindexResult> {
  if (!isEmbeddingEnabled()) {
    return { total: 0, queued: 0, errors: 0, error: 'Embedding API not configured' };
  }

  const { status, maxItems = 500 } = options;
  const prisma = getClient();

  // Build embedding status filter
  // 'none' = never embedded, 'failed' = embedding attempt failed
  const embeddingStatusFilter =
    status === 'failed' ? 'failed' : status === 'missing' ? 'none' : { in: ['failed', 'none'] };

  const memories = await prisma.memoryItem.findMany({
    where: {
      userId,
      status: 'active',
      deletedAt: null,
      embeddingStatus: embeddingStatusFilter,
    },
    select: { id: true, userId: true },
    orderBy: { updatedAt: 'desc' },
    take: maxItems,
  });

  let queued = 0;
  let errors = 0;

  for (const memory of memories) {
    try {
      await enqueueEmbedding(memory.id, memory.userId);
      queued++;
    } catch {
      errors++;
    }
  }

  return {
    total: memories.length,
    queued,
    errors,
  };
}
