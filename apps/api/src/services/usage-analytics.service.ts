import { getClient } from '@onebrain/db';

interface UsageByType {
  type: string;
  count: number;
  tokens: number;
}

interface UsageByDay {
  date: string;
  count: number;
  tokens: number;
}

interface UsageAnalytics {
  byType: UsageByType[];
  byDay: UsageByDay[];
  totals: {
    count: number;
    tokens: number;
  };
}

/**
 * Returns detailed usage analytics for a user.
 * Groups usage events by type and by day for the last 30 days.
 */
export async function getUserUsageAnalytics(userId: string, days = 30): Promise<UsageAnalytics> {
  const prisma = getClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [byTypeResult, rawEvents] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ['type'],
      where: { userId, createdAt: { gte: cutoff } },
      _count: { id: true },
      _sum: { tokensUsed: true },
    }),
    prisma.usageEvent.findMany({
      where: { userId, createdAt: { gte: cutoff } },
      select: { tokensUsed: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const byType: UsageByType[] = byTypeResult.map((row) => ({
    type: row.type,
    count: row._count.id,
    tokens: row._sum.tokensUsed ?? 0,
  }));

  const dayMap = new Map<string, { count: number; tokens: number }>();
  for (const event of rawEvents) {
    const dateKey = event.createdAt.toISOString().slice(0, 10);
    const existing = dayMap.get(dateKey) ?? { count: 0, tokens: 0 };
    existing.count += 1;
    existing.tokens += event.tokensUsed;
    dayMap.set(dateKey, existing);
  }

  const byDay: UsageByDay[] = [];
  for (const [date, stats] of dayMap) {
    byDay.push({ date, count: stats.count, tokens: stats.tokens });
  }

  const totals = {
    count: byType.reduce((sum, row) => sum + row.count, 0),
    tokens: byType.reduce((sum, row) => sum + row.tokens, 0),
  };

  return { byType, byDay, totals };
}
