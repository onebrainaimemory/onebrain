import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { isQueueEnabled } from './connection.js';
import { config } from '../config.js';
import {
  analyzeMemoriesForSkills,
  deduplicateSkills,
  persistExtractedSkills,
  runSkillLifecycle,
} from '../services/skill-extraction.service.js';
import { canUseSkillForge } from '../lib/feature-gate.js';

// ─── Types ───

export interface SkillAnalysisJobData {
  userId: string;
  type: 'extract' | 'lifecycle';
  sinceHours?: number;
}

const QUEUE_NAME = 'skillforge-analysis';

// ─── Queue ───

let analysisQueue: Queue<SkillAnalysisJobData> | null = null;

function getQueue(): Queue<SkillAnalysisJobData> | null {
  if (analysisQueue) return analysisQueue;
  if (!isQueueEnabled()) return null;

  analysisQueue = new Queue<SkillAnalysisJobData>(QUEUE_NAME, {
    connection: { url: config.redis.url },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  });

  return analysisQueue;
}

// ─── Enqueue ───

/**
 * Enqueue a skill extraction job for a user.
 * Typically triggered after N agent write-backs.
 */
export async function enqueueSkillAnalysis(userId: string, sinceHours = 24): Promise<boolean> {
  const hasFeature = await canUseSkillForge(userId);
  if (!hasFeature) return false;

  const queue = getQueue();
  if (!queue) return false;

  await queue.add(
    'extract',
    { userId, type: 'extract', sinceHours },
    {
      jobId: `skill-extract:${userId}:${Date.now()}`,
      priority: 8,
    },
  );

  return true;
}

/**
 * Enqueue the global skill lifecycle job (decay/archive/promote).
 * Runs once daily via scheduler.
 */
export async function enqueueSkillLifecycle(): Promise<boolean> {
  const queue = getQueue();
  if (!queue) return false;

  await queue.add(
    'lifecycle',
    { userId: 'system', type: 'lifecycle' },
    {
      jobId: `skill-lifecycle:${Date.now()}`,
      priority: 10,
    },
  );

  return true;
}

// ─── Worker ───

let analysisWorker: Worker<SkillAnalysisJobData> | null = null;

async function processSkillJob(
  job: Job<SkillAnalysisJobData>,
): Promise<{ type: string; result: unknown }> {
  const { type, userId, sinceHours } = job.data;

  if (type === 'lifecycle') {
    const result = await runSkillLifecycle();
    return { type: 'lifecycle', result };
  }

  // Extract skills
  const extraction = await analyzeMemoriesForSkills(userId, {
    sinceHours: sinceHours ?? 24,
  });

  if (extraction.skills.length === 0) {
    return { type: 'extract', result: { skillsFound: 0, persisted: 0 } };
  }

  // Deduplicate
  const unique = await deduplicateSkills(userId, extraction.skills);

  if (unique.length === 0) {
    return {
      type: 'extract',
      result: { skillsFound: extraction.skills.length, unique: 0, persisted: 0 },
    };
  }

  // Persist
  const ids = await persistExtractedSkills(userId, unique);

  return {
    type: 'extract',
    result: {
      skillsFound: extraction.skills.length,
      unique: unique.length,
      persisted: ids.length,
      provider: extraction.provider,
    },
  };
}

/**
 * Start the skill analysis worker. Call once from app.ts onReady hook.
 */
export function startSkillAnalysisWorker(): Worker<SkillAnalysisJobData> | null {
  if (!isQueueEnabled()) return null;
  if (analysisWorker) return analysisWorker;

  analysisWorker = new Worker<SkillAnalysisJobData>(QUEUE_NAME, processSkillJob, {
    connection: { url: config.redis.url },
    concurrency: 1,
    limiter: {
      max: 10,
      duration: 60_000,
    },
  });

  analysisWorker.on('completed', (job) => {
    if (job) {
      console.info(`[SkillForge] Job completed: ${job.data.type} for ${job.data.userId}`);
    }
  });

  analysisWorker.on('failed', (job, err) => {
    if (job) {
      console.error(
        `[SkillForge] Job failed: ${job.data.type} for ${job.data.userId}`,
        err.message,
      );
    }
  });

  console.info('[SkillForge] Analysis worker started (concurrency=1)');
  return analysisWorker;
}

/**
 * Gracefully shut down queue + worker.
 */
export async function shutdownSkillAnalysisQueue(): Promise<void> {
  if (analysisWorker) {
    await analysisWorker.close();
    analysisWorker = null;
  }
  if (analysisQueue) {
    await analysisQueue.close();
    analysisQueue = null;
  }
}
