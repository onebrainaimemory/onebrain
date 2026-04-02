import { getClient } from '@onebrain/db';
import { getPeriodStart } from './plan.service.js';
import { nullableJson } from '../lib/prisma-json.js';

/**
 * Records a usage event for a user.
 */
export async function trackUsage(
  userId: string,
  type: string,
  tokensUsed = 0,
  metadata?: Record<string, unknown>,
): Promise<{ id: string; userId: string; type: string; tokensUsed: number; createdAt: Date }> {
  const prisma = getClient();

  return prisma.usageEvent.create({
    data: {
      userId,
      type,
      tokensUsed,
      metadata: nullableJson(metadata ?? null),
    },
  });
}

/**
 * Counts usage events of a given type within the current period.
 */
export async function getUsageCount(
  userId: string,
  type: string,
  period: 'monthly' | 'weekly' | 'daily',
): Promise<number> {
  const prisma = getClient();
  const periodStart = getPeriodStart(period);

  return prisma.usageEvent.count({
    where: {
      userId,
      type,
      createdAt: { gte: periodStart },
    },
  });
}

/**
 * Returns aggregated usage stats for the current period.
 */
export async function getUsageSummary(userId: string, period: 'monthly' | 'weekly' | 'daily') {
  const prisma = getClient();
  const periodStart = getPeriodStart(period);

  const events = await prisma.usageEvent.groupBy({
    by: ['type'],
    where: {
      userId,
      createdAt: { gte: periodStart },
    },
    _count: { id: true },
    _sum: { tokensUsed: true },
  });

  return events.map((e) => ({
    type: e.type,
    count: e._count.id,
    tokensUsed: e._sum.tokensUsed ?? 0,
  }));
}
