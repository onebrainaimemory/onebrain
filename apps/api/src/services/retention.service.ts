import { getClient } from '@onebrain/db';

/**
 * Data retention rules:
 * - Sessions: 30 days after expiry
 * - MagicLinkTokens: expired tokens cleaned immediately
 * - UsageEvents: 24 months
 * - AuditLogs: configurable via AUDIT_LOG_RETENTION_DAYS (default 365 days)
 * - SourceEvents: 12 months (processed), 30 days (unprocessed)
 * - BrainVersions: keep last 10 per user, delete rest after 12 months
 * - BrainShares: 90 days after expiry
 * - Soft-deleted Users: 30 days after deletion
 * - Consent records: 3 years (DSGVO audit trail)
 */

export async function runRetentionCleanup(): Promise<{
  sessions: number;
  magicLinks: number;
  usageEvents: number;
  auditLogs: number;
  sourceEvents: number;
  brainShares: number;
  deletedUsers: number;
  expiredMemories: number;
  consentRecords: number;
}> {
  const prisma = getClient();
  const now = new Date();

  // Expired sessions: 30 days after expiry
  const sessionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sessionsResult = await prisma.session.deleteMany({
    where: { expiresAt: { lt: sessionCutoff } },
  });

  // Magic link tokens: clean all expired tokens
  const magicLinksResult = await prisma.magicLinkToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // Usage events: 24 months
  const usageCutoff = new Date(now.getTime() - 24 * 30 * 24 * 60 * 60 * 1000);
  const usageResult = await prisma.usageEvent.deleteMany({
    where: { createdAt: { lt: usageCutoff } },
  });

  // Audit logs: configurable retention (default 365 days)
  const auditRetentionDays = parseInt(process.env['AUDIT_LOG_RETENTION_DAYS'] ?? '365', 10);
  const auditCutoff = new Date(now.getTime() - auditRetentionDays * 24 * 60 * 60 * 1000);
  const auditResult = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: auditCutoff } },
  });

  // Source events: 12 months for processed
  const sourceEventCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const sourceEventsResult = await prisma.sourceEvent.deleteMany({
    where: {
      isProcessed: true,
      createdAt: { lt: sourceEventCutoff },
    },
  });

  // Brain shares: 90 days after expiry
  const brainShareCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const brainSharesResult = await prisma.brainShare.deleteMany({
    where: {
      expiresAt: { not: null, lt: brainShareCutoff },
    },
  });

  // Soft-deleted users: 30 days after deletion → hard delete
  const userCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const usersToDelete = await prisma.user.findMany({
    where: {
      deletedAt: { not: null, lt: userCutoff },
    },
    select: { id: true },
  });

  if (usersToDelete.length > 0) {
    const userIds = usersToDelete.map((u) => u.id);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Hard-delete soft-deleted memory items past 30-day grace period
  const memoryCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const memoriesResult = await prisma.memoryItem.deleteMany({
    where: { deletedAt: { not: null, lt: memoryCutoff } },
  });

  // Consent records: 3 years (DSGVO audit trail retention)
  const consentCutoff = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
  const consentResult = await prisma.consent.deleteMany({
    where: { createdAt: { lt: consentCutoff } },
  });

  return {
    sessions: sessionsResult.count,
    magicLinks: magicLinksResult.count,
    usageEvents: usageResult.count,
    auditLogs: auditResult.count,
    sourceEvents: sourceEventsResult.count,
    brainShares: brainSharesResult.count,
    deletedUsers: usersToDelete.length,
    expiredMemories: memoriesResult.count,
    consentRecords: consentResult.count,
  };
}
