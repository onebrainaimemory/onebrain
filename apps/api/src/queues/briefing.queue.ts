import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { getClient } from '@onebrain/db';
import { isQueueEnabled } from './connection.js';
import { config } from '../config.js';
import { isQuietHours } from '../services/briefing.service.js';

// ─── Types ───

export interface BriefingJobData {
  type: 'scheduled' | 'triggered';
  scheduleId?: string;
  triggerId?: string;
  userId: string;
  briefingType: string;
  channels: string[];
}

const QUEUE_NAME = 'brainpulse-briefings';

// ─── Queue ───

let briefingQueue: Queue<BriefingJobData> | null = null;

function getQueue(): Queue<BriefingJobData> | null {
  if (briefingQueue) return briefingQueue;
  if (!isQueueEnabled()) return null;

  briefingQueue = new Queue<BriefingJobData>(QUEUE_NAME, {
    connection: { url: config.redis.url },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  });

  return briefingQueue;
}

// ─── Enqueue ───

/**
 * Enqueue a briefing generation job from a schedule.
 */
export async function enqueueBriefingFromSchedule(
  scheduleId: string,
  userId: string,
  briefingType: string,
  channels: string[],
): Promise<boolean> {
  const queue = getQueue();
  if (!queue) return false;

  await queue.add(
    'generate',
    {
      type: 'scheduled',
      scheduleId,
      userId,
      briefingType,
      channels,
    },
    {
      jobId: `briefing-sched-${scheduleId}-${Date.now()}`,
      priority: 5,
    },
  );

  return true;
}

/**
 * Enqueue a briefing from an event trigger.
 */
export async function enqueueBriefingFromTrigger(
  triggerId: string,
  userId: string,
  briefingType: string,
  channels: string[],
): Promise<boolean> {
  const queue = getQueue();
  if (!queue) return false;

  await queue.add(
    'generate',
    {
      type: 'triggered',
      triggerId,
      userId,
      briefingType,
      channels,
    },
    {
      jobId: `briefing-trig-${triggerId}-${Date.now()}`,
      priority: 3,
    },
  );

  return true;
}

// ─── Worker ───

let briefingWorker: Worker<BriefingJobData> | null = null;

/**
 * Generate a briefing: assemble content, create DB record, deliver.
 */
async function processBriefingJob(
  job: Job<BriefingJobData>,
): Promise<{ briefingId: string; delivered: boolean }> {
  const { userId, briefingType, channels } = job.data;
  const prisma = getClient();

  // Check quiet hours
  const briefingConfig = await prisma.briefingConfig.findUnique({
    where: { userId },
  });

  if (briefingConfig) {
    const inQuietHours = isQuietHours(
      briefingConfig.quietHoursStart,
      briefingConfig.quietHoursEnd,
      briefingConfig.timezone,
    );

    if (inQuietHours) {
      return { briefingId: '', delivered: false };
    }
  }

  // Assemble briefing content
  const { title, contentText, contentHtml } = await assembleBriefingContent(userId, briefingType);

  // Create briefing record
  const briefing = await prisma.briefing.create({
    data: {
      userId,
      type: briefingType,
      status: 'delivered',
      title,
      contentText,
      contentHtml,
      deliveredVia: channels,
      ...(job.data.scheduleId ? { scheduleId: job.data.scheduleId } : {}),
      ...(job.data.triggerId ? { triggerId: job.data.triggerId } : {}),
    },
  });

  // Update schedule's lastFiredAt
  if (job.data.scheduleId) {
    await prisma.briefingSchedule.update({
      where: { id: job.data.scheduleId },
      data: { lastFiredAt: new Date() },
    });
  }

  // Deliver via channels (fire-and-forget per channel)
  for (const channel of channels) {
    try {
      await deliverBriefing(userId, briefing.id, channel, title, contentText, contentHtml);
    } catch {
      // Log but don't fail — partial delivery is acceptable
      console.error(`[BrainPulse] Delivery failed via ${channel} for ${briefing.id}`);
    }
  }

  return { briefingId: briefing.id, delivered: true };
}

// ─── Content Assembly ───

interface BriefingContent {
  title: string;
  contentText: string;
  contentHtml: string | null;
}

async function assembleBriefingContent(
  userId: string,
  briefingType: string,
): Promise<BriefingContent> {
  const prisma = getClient();
  const now = new Date();

  if (briefingType === 'morning') {
    return assembleMorningBriefing(prisma, userId);
  }

  if (briefingType === 'evening') {
    return assembleEveningBriefing(prisma, userId, now);
  }

  if (briefingType === 'weekly_health') {
    return assembleWeeklyHealth(prisma, userId);
  }

  // midday / event_triggered: generic summary
  return assembleGenericBriefing(prisma, userId, briefingType);
}

async function assembleMorningBriefing(
  prisma: ReturnType<typeof getClient>,
  userId: string,
): Promise<BriefingContent> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentMemories, pendingCandidates, agentActivity] = await Promise.all([
    prisma.memoryItem.count({
      where: { userId, createdAt: { gte: yesterday }, deletedAt: null },
    }),
    prisma.memoryItem.count({
      where: { userId, status: 'candidate' },
    }),
    prisma.agentActivity.count({
      where: { userId, createdAt: { gte: yesterday } },
    }),
  ]);

  const sections: string[] = [];
  sections.push(`New memories (24h): ${recentMemories}`);
  sections.push(`Pending candidates: ${pendingCandidates}`);
  sections.push(`Agent activity (24h): ${agentActivity} calls`);

  if (pendingCandidates > 5) {
    sections.push(`Action: ${pendingCandidates} memories need your review.`);
  }

  const contentText = sections.join('\n');

  return {
    title: 'Morning Briefing',
    contentText,
    contentHtml: `<ul>${sections.map((s) => `<li>${s}</li>`).join('')}</ul>`,
  };
}

async function assembleEveningBriefing(
  prisma: ReturnType<typeof getClient>,
  userId: string,
  now: Date,
): Promise<BriefingContent> {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [created, updated, archived] = await Promise.all([
    prisma.memoryItem.count({
      where: { userId, createdAt: { gte: todayStart }, deletedAt: null },
    }),
    prisma.memoryItem.count({
      where: { userId, updatedAt: { gte: todayStart }, createdAt: { lt: todayStart } },
    }),
    prisma.memoryItem.count({
      where: {
        userId,
        status: 'archived',
        updatedAt: { gte: todayStart },
      },
    }),
  ]);

  const sections = [
    `Created today: ${created}`,
    `Updated today: ${updated}`,
    `Archived today: ${archived}`,
  ];

  return {
    title: 'Evening Summary',
    contentText: sections.join('\n'),
    contentHtml: `<ul>${sections.map((s) => `<li>${s}</li>`).join('')}</ul>`,
  };
}

async function assembleWeeklyHealth(
  prisma: ReturnType<typeof getClient>,
  userId: string,
): Promise<BriefingContent> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [total, stale, byType] = await Promise.all([
    prisma.memoryItem.count({
      where: { userId, deletedAt: null },
    }),
    prisma.memoryItem.count({
      where: {
        userId,
        deletedAt: null,
        updatedAt: { lt: thirtyDaysAgo },
        status: 'active',
      },
    }),
    prisma.memoryItem.groupBy({
      by: ['type'],
      where: { userId, deletedAt: null },
      _count: { id: true },
    }),
  ]);

  const sections = [
    `Total memories: ${total}`,
    `Stale (>30d no update): ${stale}`,
    'Type distribution:',
    ...byType.map((t) => `  ${t.type}: ${t._count.id}`),
  ];

  if (stale > 10) {
    sections.push(`Suggestion: Review ${stale} stale memories for cleanup.`);
  }

  return {
    title: 'Weekly Brain Health',
    contentText: sections.join('\n'),
    contentHtml: `<ul>${sections.map((s) => `<li>${s}</li>`).join('')}</ul>`,
  };
}

async function assembleGenericBriefing(
  prisma: ReturnType<typeof getClient>,
  userId: string,
  briefingType: string,
): Promise<BriefingContent> {
  const recent = await prisma.memoryItem.findMany({
    where: { userId, deletedAt: null, status: 'active' },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { title: true, type: true },
  });

  const sections = recent.map((m) => `[${m.type}] ${m.title}`);

  return {
    title: `${briefingType} Briefing`,
    contentText: sections.join('\n') || 'No recent activity.',
    contentHtml: sections.length
      ? `<ul>${sections.map((s) => `<li>${s}</li>`).join('')}</ul>`
      : '<p>No recent activity.</p>',
  };
}

// ─── Delivery ───

async function deliverBriefing(
  userId: string,
  briefingId: string,
  channel: string,
  title: string,
  contentText: string,
  contentHtml: string | null,
): Promise<void> {
  if (channel === 'email') {
    await deliverViaEmail(userId, title, contentHtml ?? contentText);
  } else if (channel === 'webhook') {
    await deliverViaWebhook(userId, briefingId, title, contentText);
  }
  // in_app: no active delivery needed — the record is queryable via GET /v1/briefings
}

async function deliverViaEmail(userId: string, subject: string, htmlBody: string): Promise<void> {
  const resendKey = process.env['RESEND_API_KEY'];
  if (!resendKey) return;

  const prisma = getClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) return;

  const mailFrom = process.env['MAIL_FROM'] ?? 'OneBrain <noreply@onebrain.rocks>';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: mailFrom,
      to: user.email,
      subject: `[BrainPulse] ${subject}`,
      html: htmlBody,
    }),
  });
}

async function deliverViaWebhook(
  userId: string,
  briefingId: string,
  title: string,
  contentText: string,
): Promise<void> {
  const prisma = getClient();
  const briefingConfig = await prisma.briefingConfig.findUnique({
    where: { userId },
    select: { webhookUrl: true, webhookSecret: true },
  });

  if (!briefingConfig?.webhookUrl) return;

  const payload = JSON.stringify({
    event: 'briefing.delivered',
    briefingId,
    title,
    contentText,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // HMAC signature if webhook secret is configured
  if (briefingConfig.webhookSecret) {
    const { createHmac } = await import('node:crypto');
    const signature = createHmac('sha256', briefingConfig.webhookSecret)
      .update(payload)
      .digest('hex');
    headers['X-BrainPulse-Signature'] = `sha256=${signature}`;
  }

  await fetch(briefingConfig.webhookUrl, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(10_000),
  });
}

// ─── Scheduler Tick ───

/**
 * Check all active schedules and fire those that are due.
 * Call this every 60 seconds from the onReady scheduler.
 */
export async function checkScheduledBriefings(): Promise<number> {
  const prisma = getClient();
  const now = new Date();

  const dueSchedules = await prisma.briefingSchedule.findMany({
    where: {
      isActive: true,
      nextFireAt: { lte: now },
    },
    include: {
      config: { select: { userId: true, isEnabled: true } },
    },
    take: 50,
  });

  let fired = 0;

  for (const schedule of dueSchedules) {
    if (!schedule.config.isEnabled) continue;

    const enqueued = await enqueueBriefingFromSchedule(
      schedule.id,
      schedule.config.userId,
      schedule.type,
      schedule.channels,
    );

    if (enqueued) {
      // Compute next fire time
      const { computeNextFireAt } = await import('../services/briefing.service.js');
      const config = await prisma.briefingConfig.findUnique({
        where: { userId: schedule.config.userId },
      });
      const nextFireAt = computeNextFireAt(schedule.cronExpression, config?.timezone ?? 'UTC');

      await prisma.briefingSchedule.update({
        where: { id: schedule.id },
        data: { nextFireAt },
      });

      fired++;
    }
  }

  return fired;
}

/**
 * Start the briefing worker. Call once from app.ts onReady hook.
 */
export function startBriefingWorker(): Worker<BriefingJobData> | null {
  if (!isQueueEnabled()) return null;
  if (briefingWorker) return briefingWorker;

  briefingWorker = new Worker<BriefingJobData>(QUEUE_NAME, processBriefingJob, {
    connection: { url: config.redis.url },
    concurrency: 2,
    limiter: {
      max: 30,
      duration: 60_000,
    },
  });

  briefingWorker.on('completed', (job) => {
    if (job) {
      console.info(
        `[BrainPulse] Briefing delivered: ${job.data.briefingType} for ${job.data.userId}`,
      );
    }
  });

  briefingWorker.on('failed', (job, err) => {
    if (job) {
      console.error(
        `[BrainPulse] Briefing failed: ${job.data.briefingType} for ${job.data.userId}`,
        err.message,
      );
    }
  });

  console.info('[BrainPulse] Briefing worker started (concurrency=2)');
  return briefingWorker;
}

/**
 * Gracefully shut down queue + worker.
 */
export async function shutdownBriefingQueue(): Promise<void> {
  if (briefingWorker) {
    await briefingWorker.close();
    briefingWorker = null;
  }
  if (briefingQueue) {
    await briefingQueue.close();
    briefingQueue = null;
  }
}
