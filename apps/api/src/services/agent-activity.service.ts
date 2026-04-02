import { getClient } from '@onebrain/db';
import { nullableJson } from '../lib/prisma-json.js';

export async function logAgentActivity(
  apiKeyId: string,
  userId: string,
  action: string,
  resource: string,
  status: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const prisma = getClient();
    await prisma.agentActivity.create({
      data: {
        apiKeyId,
        userId,
        action,
        resource,
        status,
        details: details ? nullableJson(details) : undefined,
      },
    });
  } catch {
    // Fire-and-forget — don't block request on logging failure
  }
}

export async function getAgentList(userId: string) {
  const prisma = getClient();

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      trustLevel: true,
      description: true,
      rateLimitPerMin: true,
      isActive: true,
      lastUsedAt: true,
      lastSyncedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const keyIds = keys.map((k) => k.id);

  const [activityCounts, candidateCounts] = await Promise.all([
    prisma.agentActivity.groupBy({
      by: ['apiKeyId'],
      where: { apiKeyId: { in: keyIds } },
      _count: { id: true },
    }),
    prisma.memoryItem.groupBy({
      by: ['apiKeyId'],
      where: {
        apiKeyId: { in: keyIds },
        status: 'candidate',
      },
      _count: { id: true },
    }),
  ]);

  const activityMap = new Map(activityCounts.map((a) => [a.apiKeyId, a._count.id]));
  const candidateMap = new Map(candidateCounts.map((c) => [c.apiKeyId!, c._count.id]));

  return keys.map((key) => ({
    ...key,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    lastSyncedAt: key.lastSyncedAt?.toISOString() ?? null,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    totalCalls: activityMap.get(key.id) ?? 0,
    candidateCount: candidateMap.get(key.id) ?? 0,
  }));
}

interface ActivityItem {
  id: string;
  apiKeyId: string;
  action: string;
  resource: string;
  status: string;
  details: unknown;
  createdAt: string;
  apiKey: { name: string; prefix: string };
}

interface ActivityListResult {
  data: ActivityItem[];
  cursor: string | null;
  hasMore: boolean;
}

export async function getAgentActivities(
  userId: string,
  options: {
    apiKeyId?: string;
    cursor?: string;
    limit: number;
    days: number;
  },
): Promise<ActivityListResult> {
  const prisma = getClient();
  const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    userId,
    createdAt: { gte: since },
  };
  if (options.apiKeyId) {
    where['apiKeyId'] = options.apiKeyId;
  }

  const items = await prisma.agentActivity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options.limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      apiKeyId: true,
      action: true,
      resource: true,
      status: true,
      details: true,
      createdAt: true,
      apiKey: { select: { name: true, prefix: true } },
    },
  });

  const hasMore = items.length > options.limit;
  const data = hasMore ? items.slice(0, options.limit) : items;

  return {
    data: data.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    cursor: hasMore ? data[data.length - 1]!.id : null,
    hasMore,
  };
}

export async function getAgentSummary(userId: string, apiKeyId?: string, days: number = 30) {
  const prisma = getClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    userId,
    createdAt: { gte: since },
  };
  if (apiKeyId) {
    where['apiKeyId'] = apiKeyId;
  }

  const [total, byAction, byStatus, errorCount, activeAgents] = await Promise.all([
    prisma.agentActivity.count({ where }),
    prisma.agentActivity.groupBy({
      by: ['action'],
      where,
      _count: { id: true },
    }),
    prisma.agentActivity.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.agentActivity.count({
      where: { ...where, status: 'error' },
    }),
    apiKeyId
      ? Promise.resolve(1)
      : prisma.agentActivity.groupBy({ by: ['apiKeyId'], where }).then((r) => r.length),
  ]);

  const pendingCandidates = await prisma.memoryItem.count({
    where: {
      userId,
      status: 'candidate',
      ...(apiKeyId ? { apiKeyId } : { apiKeyId: { not: null } }),
    },
  });

  return {
    totalCalls: total,
    errorCount,
    errorRate: total > 0 ? Math.round((errorCount / total) * 10000) / 100 : 0,
    activeAgents,
    pendingCandidates,
    byAction: byAction.map((a) => ({
      action: a.action,
      count: a._count.id,
    })),
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
  };
}

interface DeltaSyncMemory {
  id: string;
  type: string;
  title: string;
  body: string;
  sourceType: string;
  confidence: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DeltaSyncResult {
  memories: DeltaSyncMemory[];
  since: string;
  until: string;
  count: number;
}

export async function getDeltaSync(
  userId: string,
  apiKeyId: string,
  since?: string,
): Promise<DeltaSyncResult> {
  const prisma = getClient();

  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, userId },
    select: { lastSyncedAt: true },
  });

  const sinceDate = since ? new Date(since) : (apiKey?.lastSyncedAt ?? new Date(0));

  const now = new Date();

  const memories = await prisma.memoryItem.findMany({
    where: {
      userId,
      updatedAt: { gt: sinceDate },
      status: 'active',
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      sourceType: true,
      confidence: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { lastSyncedAt: now },
  });

  return {
    memories: memories.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    since: sinceDate.toISOString(),
    until: now.toISOString(),
    count: memories.length,
  };
}

export async function bulkUpdateCandidates(
  userId: string,
  apiKeyId: string,
  action: 'approve' | 'dismiss',
): Promise<number> {
  const prisma = getClient();

  const newStatus = action === 'approve' ? 'active' : 'archived';

  const result = await prisma.memoryItem.updateMany({
    where: {
      userId,
      apiKeyId,
      status: 'candidate',
    },
    data: { status: newStatus },
  });

  return result.count;
}
