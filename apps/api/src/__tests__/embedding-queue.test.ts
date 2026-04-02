import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock BullMQ ───
const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockAdd,
    close: mockClose,
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: mockClose,
  })),
}));

// ─── Mock connection (resolved from queues/) ───
vi.mock('../queues/connection.js', () => ({
  isQueueEnabled: vi.fn().mockReturnValue(true),
  getQueueConnectionOptions: vi.fn().mockReturnValue({
    connection: { url: 'redis://localhost:6379' },
  }),
}));

// ─── Mock config ───
vi.mock('../config.js', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
    nodeEnv: 'test',
  },
}));

// ─── Mock embedding service ───
vi.mock('../services/embedding.service.js', () => ({
  storeEmbedding: vi.fn().mockResolvedValue(42),
  isEmbeddingEnabled: vi.fn().mockReturnValue(true),
  markEmbeddingPending: vi.fn().mockResolvedValue(undefined),
  markEmbeddingFailed: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock memory encryption ───
vi.mock('../lib/memory-encryption.js', () => ({
  decryptMemory: vi
    .fn()
    .mockImplementation((_userId: string, data: { title: string; body: string }) => ({
      title: data.title,
      body: data.body,
    })),
}));

// ─── Mock Prisma ───
vi.mock('@onebrain/db', () => ({
  getClient: vi.fn().mockReturnValue({
    memoryItem: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        title: 'Test Memory',
        body: 'Test body content',
        isEncrypted: false,
        type: 'fact',
        status: 'active',
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  }),
}));

describe('DeepRecall — Embedding Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enqueue an embedding job', async () => {
    const { enqueueEmbedding } = await import('../queues/embedding.queue.js');

    const result = await enqueueEmbedding('mem-1', 'user-1');
    expect(result).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(
      'generate',
      { memoryItemId: 'mem-1', userId: 'user-1' },
      expect.objectContaining({ jobId: 'embed:mem-1', priority: 5 }),
    );
  });

  it('should enqueue an update job with higher priority', async () => {
    const { enqueueEmbeddingUpdate } = await import('../queues/embedding.queue.js');

    const result = await enqueueEmbeddingUpdate('mem-1', 'user-1');
    expect(result).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(
      'regenerate',
      { memoryItemId: 'mem-1', userId: 'user-1' },
      expect.objectContaining({ priority: 3 }),
    );
  });

  it('should mark embedding as pending on enqueue', async () => {
    const { enqueueEmbedding } = await import('../queues/embedding.queue.js');
    const { markEmbeddingPending } = await import('../services/embedding.service.js');

    await enqueueEmbedding('mem-2', 'user-1');
    expect(markEmbeddingPending).toHaveBeenCalledWith('mem-2');
  });

  it('should start embedding worker', async () => {
    const { startEmbeddingWorker } = await import('../queues/embedding.queue.js');
    const { Worker } = await import('bullmq');

    const worker = startEmbeddingWorker();
    expect(worker).not.toBeNull();
    expect(Worker).toHaveBeenCalledWith(
      'deeprecall-embeddings',
      expect.any(Function),
      expect.objectContaining({ concurrency: 3 }),
    );
  });

  it('should gracefully shutdown queue and worker', async () => {
    const { shutdownEmbeddingQueue, startEmbeddingWorker, enqueueEmbedding } =
      await import('../queues/embedding.queue.js');

    startEmbeddingWorker();
    await enqueueEmbedding('mem-1', 'user-1');

    await shutdownEmbeddingQueue();
    expect(mockClose).toHaveBeenCalled();
  });
});

describe('DeepRecall — Embedding text composition', () => {
  it('should compose text with title weighted (repeated)', () => {
    const title = 'Machine Learning Basics';
    const body = 'Neural networks are computational models inspired by the brain.';
    const embeddingText = `${title}\n${title}\n${body}`.slice(0, 8000);

    expect(embeddingText).toContain('Machine Learning Basics');
    // Title appears twice for weight
    const firstIdx = embeddingText.indexOf('Machine Learning Basics');
    const lastIdx = embeddingText.lastIndexOf('Machine Learning Basics');
    expect(firstIdx).toBeLessThan(lastIdx);
    expect(embeddingText).toContain('Neural networks');
  });

  it('should truncate at 8000 chars', () => {
    const title = 'X';
    const body = 'Y'.repeat(10000);
    const embeddingText = `${title}\n${title}\n${body}`.slice(0, 8000);
    expect(embeddingText.length).toBe(8000);
  });
});

describe('DeepRecall — Queue disabled scenarios', () => {
  it('should return false when embedding API not configured', async () => {
    const { isEmbeddingEnabled } = await import('../services/embedding.service.js');
    vi.mocked(isEmbeddingEnabled).mockReturnValueOnce(false);

    const { enqueueEmbedding } = await import('../queues/embedding.queue.js');
    const result = await enqueueEmbedding('mem-1', 'user-1');
    expect(result).toBe(false);
  });

  it('should return false for update when embedding not configured', async () => {
    const { isEmbeddingEnabled } = await import('../services/embedding.service.js');
    vi.mocked(isEmbeddingEnabled).mockReturnValueOnce(false);

    const { enqueueEmbeddingUpdate } = await import('../queues/embedding.queue.js');
    const result = await enqueueEmbeddingUpdate('mem-1', 'user-1');
    expect(result).toBe(false);
  });

  it('should return null for worker when queue disabled', async () => {
    const { isQueueEnabled } = await import('../queues/connection.js');
    vi.mocked(isQueueEnabled).mockReturnValueOnce(false);

    // Reset the cached worker reference
    const mod = await import('../queues/embedding.queue.js');
    await mod.shutdownEmbeddingQueue();

    const worker = mod.startEmbeddingWorker();
    expect(worker).toBeNull();
  });
});
