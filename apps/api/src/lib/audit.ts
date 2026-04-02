import { maskIp } from './pii-mask.js';
import { nullableJson } from './prisma-json.js';

export interface AuditEntry {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory log kept for backward compatibility with tests.
// Capped at 1000 entries to prevent unbounded memory growth.
const MAX_AUDIT_LOG_SIZE = 1000;
const auditLog: AuditEntry[] = [];

/**
 * Logs an audit event. Persists to DB (fire-and-forget) and
 * keeps in-memory copy for fast access.
 */
export function audit(
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string,
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    resource,
    resourceId,
    details,
    ipAddress: ipAddress ? maskIp(ipAddress) : undefined,
    userAgent,
  };
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG_SIZE);
  }

  if (process.env['NODE_ENV'] === 'development') {
    console.info(`[AUDIT] ${entry.action} ${entry.resource} ${entry.resourceId ?? ''}`);
  }

  // Fire-and-forget DB persistence
  persistAuditEntry(entry).catch(() => {
    // Silently fail — in-memory log is the fallback
  });
}

async function persistAuditEntry(entry: AuditEntry): Promise<void> {
  const { getClient } = await import('@onebrain/db');
  const prisma = getClient();

  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details ? nullableJson(entry.details) : undefined,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}

export function getAuditLog(userId?: string, limit = 100): AuditEntry[] {
  const filtered = userId ? auditLog.filter((e) => e.userId === userId) : auditLog;
  return filtered.slice(-limit);
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}

/**
 * Fetches audit logs from DB with cursor pagination.
 */
export async function getPersistedAuditLogs(options: {
  userId?: string;
  cursor?: string;
  limit?: number;
}): Promise<{
  items: Array<{
    id: string;
    userId: string;
    action: string;
    resource: string;
    resourceId: string | null;
    details: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }>;
  cursor: string | null;
  hasMore: boolean;
}> {
  const { getClient } = await import('@onebrain/db');
  const prisma = getClient();
  const limit = Math.min(options.limit ?? 20, 100);

  const where: Record<string, unknown> = {};
  if (options.userId) {
    where['userId'] = options.userId;
  }

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const result = hasMore ? items.slice(0, limit) : items;

  return {
    items: result.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    })),
    cursor: hasMore ? result[result.length - 1]!.id : null,
    hasMore,
  };
}
