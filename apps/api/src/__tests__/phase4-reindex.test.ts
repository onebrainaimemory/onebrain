import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───

const mockMemoryFindMany = vi.fn();
const mockMemoryCount = vi.fn();
const mockPrisma = {
  memoryItem: {
    findMany: mockMemoryFindMany,
    count: mockMemoryCount,
  },
};

vi.mock('@onebrain/db', () => ({
  getClient: () => mockPrisma,
}));

const mockEnqueueEmbedding = vi.fn();
vi.mock('../queues/embedding.queue.js', () => ({
  enqueueEmbedding: (...args: unknown[]) => mockEnqueueEmbedding(...args),
}));

const mockIsEmbeddingEnabled = vi.fn();
vi.mock('../services/embedding.service.js', () => ({
  isEmbeddingEnabled: () => mockIsEmbeddingEnabled(),
}));

const mockCanUseDeepRecall = vi.fn();
vi.mock('../lib/feature-gate.js', () => ({
  canUseDeepRecall: (...args: unknown[]) => mockCanUseDeepRecall(...args),
}));

import { getEmbeddingStatus, batchReindex } from '../services/embedding-admin.service.js';

// ─── Tests ───

describe('DeepRecall — Batch Re-Embedding (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Embedding Status ──

  describe('getEmbeddingStatus()', () => {
    it('should return embedding stats for a user', async () => {
      mockMemoryCount
        .mockResolvedValueOnce(100) // total active memories
        .mockResolvedValueOnce(80) // completed embeddings
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(3) // failed
        .mockResolvedValueOnce(12); // no embedding

      const stats = await getEmbeddingStatus('user-1');

      expect(stats).toEqual({
        totalMemories: 100,
        embedded: 80,
        pending: 5,
        failed: 3,
        missing: 12,
        coverage: 0.8,
      });
    });

    it('should handle zero memories', async () => {
      mockMemoryCount.mockResolvedValue(0);

      const stats = await getEmbeddingStatus('user-2');

      expect(stats.totalMemories).toBe(0);
      expect(stats.coverage).toBe(0);
    });
  });

  // ── Batch Reindex ──

  describe('batchReindex()', () => {
    it('should enqueue memories without embeddings', async () => {
      mockIsEmbeddingEnabled.mockReturnValue(true);
      mockCanUseDeepRecall.mockResolvedValue(true);

      const memories = [
        { id: 'mem-1', userId: 'user-1' },
        { id: 'mem-2', userId: 'user-1' },
        { id: 'mem-3', userId: 'user-1' },
      ];
      mockMemoryFindMany.mockResolvedValue(memories);
      mockEnqueueEmbedding.mockResolvedValue(true);

      const result = await batchReindex('user-1');

      expect(result.queued).toBe(3);
      expect(result.total).toBe(3);
      expect(mockEnqueueEmbedding).toHaveBeenCalledTimes(3);
      expect(mockEnqueueEmbedding).toHaveBeenCalledWith('mem-1', 'user-1');
    });

    it('should respect maxItems limit', async () => {
      mockIsEmbeddingEnabled.mockReturnValue(true);
      mockCanUseDeepRecall.mockResolvedValue(true);

      // Prisma mock returns whatever — we verify `take` was passed
      const memories = Array.from({ length: 3 }, (_, i) => ({
        id: `mem-${i}`,
        userId: 'user-1',
      }));
      mockMemoryFindMany.mockResolvedValue(memories);
      mockEnqueueEmbedding.mockResolvedValue(true);

      await batchReindex('user-1', { maxItems: 3 });

      expect(mockMemoryFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
    });

    it('should filter by status (failed only)', async () => {
      mockIsEmbeddingEnabled.mockReturnValue(true);
      mockCanUseDeepRecall.mockResolvedValue(true);

      mockMemoryFindMany.mockResolvedValue([{ id: 'fail-1', userId: 'user-1' }]);
      mockEnqueueEmbedding.mockResolvedValue(true);

      const result = await batchReindex('user-1', { status: 'failed' });

      expect(result.queued).toBe(1);
      expect(mockMemoryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            embeddingStatus: 'failed',
          }),
        }),
      );
    });

    it('should return zero when embedding API is disabled', async () => {
      mockIsEmbeddingEnabled.mockReturnValue(false);

      const result = await batchReindex('user-1');

      expect(result.queued).toBe(0);
      expect(result.error).toBe('Embedding API not configured');
      expect(mockEnqueueEmbedding).not.toHaveBeenCalled();
    });

    it('should handle enqueue failures gracefully', async () => {
      mockIsEmbeddingEnabled.mockReturnValue(true);
      mockCanUseDeepRecall.mockResolvedValue(true);

      mockMemoryFindMany.mockResolvedValue([
        { id: 'ok-1', userId: 'user-1' },
        { id: 'fail-1', userId: 'user-1' },
        { id: 'ok-2', userId: 'user-1' },
      ]);
      mockEnqueueEmbedding
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Redis down'))
        .mockResolvedValueOnce(true);

      const result = await batchReindex('user-1');

      expect(result.queued).toBe(2);
      expect(result.errors).toBe(1);
    });

    it('should default to missing+failed when no status specified', async () => {
      mockIsEmbeddingEnabled.mockReturnValue(true);
      mockCanUseDeepRecall.mockResolvedValue(true);

      mockMemoryFindMany.mockResolvedValue([]);

      await batchReindex('user-1');

      expect(mockMemoryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            embeddingStatus: { in: ['failed', 'none'] },
          }),
        }),
      );
    });
  });
});
