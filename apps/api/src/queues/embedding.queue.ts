import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { getClient } from '@onebrain/db';
import { isQueueEnabled } from './connection.js';
import { config } from '../config.js';
import {
  storeEmbedding,
  isEmbeddingEnabled,
  markEmbeddingPending,
  markEmbeddingFailed,
} from '../services/embedding.service.js';
import { decryptMemory } from '../lib/memory-encryption.js';

// ─── Types ───

export interface EmbeddingJobData {
  memoryItemId: string;
  userId: string;
}

const QUEUE_NAME = 'deeprecall-embeddings';

// ─── Queue ───

let embeddingQueue: Queue<EmbeddingJobData> | null = null;

function getQueue(): Queue<EmbeddingJobData> | null {
  if (embeddingQueue) return embeddingQueue;
  if (!isQueueEnabled()) return null;

  embeddingQueue = new Queue<EmbeddingJobData>(QUEUE_NAME, {
    connection: { url: config.redis.url },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  return embeddingQueue;
}

// ─── Enqueue (fire-and-forget) ───

/**
 * Enqueue an embedding generation job for a memory item.
 * - Marks the memory as 'pending' immediately
 * - Adds a BullMQ job for async processing
 * - No-ops gracefully if Redis or embedding API is not configured
 */
export async function enqueueEmbedding(memoryItemId: string, userId: string): Promise<boolean> {
  if (!isEmbeddingEnabled()) return false;

  const queue = getQueue();
  if (!queue) return false;

  await markEmbeddingPending(memoryItemId);

  await queue.add(
    'generate',
    { memoryItemId, userId },
    {
      jobId: `embed:${memoryItemId}`,
      priority: 5,
    },
  );

  return true;
}

/**
 * Enqueue embedding re-generation (e.g. after memory update).
 * Uses higher priority to process updates before new items.
 */
export async function enqueueEmbeddingUpdate(
  memoryItemId: string,
  userId: string,
): Promise<boolean> {
  if (!isEmbeddingEnabled()) return false;

  const queue = getQueue();
  if (!queue) return false;

  await markEmbeddingPending(memoryItemId);

  await queue.add(
    'regenerate',
    { memoryItemId, userId },
    {
      jobId: `embed:${memoryItemId}:${Date.now()}`,
      priority: 3,
    },
  );

  return true;
}

// ─── Worker ───

let embeddingWorker: Worker<EmbeddingJobData> | null = null;

/**
 * Process a single embedding job:
 * 1. Fetch memory from DB
 * 2. Decrypt title + body
 * 3. Compose embedding text
 * 4. Call storeEmbedding() (API + upsert)
 */
async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<{ tokensUsed: number }> {
  const { memoryItemId, userId } = job.data;

  const prisma = getClient();
  const memory = await prisma.memoryItem.findFirst({
    where: { id: memoryItemId, deletedAt: null },
  });

  if (!memory) {
    throw new Error(`Memory item ${memoryItemId} not found or deleted`);
  }

  // Decrypt if encrypted
  const { title, body } = decryptMemory(userId, {
    title: memory.title,
    body: memory.body,
    isEncrypted: memory.isEncrypted,
  });

  // Compose embedding text: title gets higher weight via repetition
  const embeddingText = `${title}\n${title}\n${body}`.slice(0, 8000);

  const tokensUsed = await storeEmbedding(memoryItemId, embeddingText);

  return { tokensUsed };
}

/**
 * Start the embedding worker. Call once from app.ts onReady hook.
 * Returns null if Redis/embeddings are not configured.
 */
export function startEmbeddingWorker(): Worker<EmbeddingJobData> | null {
  if (!isQueueEnabled() || !isEmbeddingEnabled()) return null;
  if (embeddingWorker) return embeddingWorker;

  embeddingWorker = new Worker<EmbeddingJobData>(QUEUE_NAME, processEmbeddingJob, {
    connection: { url: config.redis.url },
    concurrency: 3,
    limiter: {
      max: 50,
      duration: 60_000,
    },
  });

  embeddingWorker.on('completed', (job) => {
    if (job) {
      console.info(`[DeepRecall] Embedding completed: ${job.data.memoryItemId}`);
    }
  });

  embeddingWorker.on('failed', async (job, err) => {
    if (job) {
      console.error(`[DeepRecall] Embedding failed: ${job.data.memoryItemId}`, err.message);

      // Mark as failed after all retries exhausted
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        try {
          await markEmbeddingFailed(job.data.memoryItemId);
        } catch {
          // Best-effort status update
        }
      }
    }
  });

  console.info('[DeepRecall] Embedding worker started (concurrency=3)');
  return embeddingWorker;
}

/**
 * Gracefully shut down queue + worker.
 */
export async function shutdownEmbeddingQueue(): Promise<void> {
  if (embeddingWorker) {
    await embeddingWorker.close();
    embeddingWorker = null;
  }
  if (embeddingQueue) {
    await embeddingQueue.close();
    embeddingQueue = null;
  }
}
