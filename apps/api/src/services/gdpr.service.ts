import { createHmac } from 'node:crypto';
import { getClient } from '@onebrain/db';
import { config } from '../config.js';
import { audit } from '../lib/audit.js';

/**
 * Soft-deletes a user account (DSGVO Art. 17).
 * Sets deletedAt, deactivates account, terminates sessions.
 * After 30 days, retention job will hard-delete.
 */
export async function softDeleteUser(userId: string): Promise<void> {
  const prisma = getClient();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    }),
    // Terminate all sessions
    prisma.session.deleteMany({ where: { userId } }),
    // Invalidate all magic links
    prisma.magicLinkToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    // Revoke API keys
    prisma.apiKey.deleteMany({ where: { userId } }),
    // Deactivate plans
    prisma.userPlan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    }),
  ]);
}

/**
 * Hard-deletes a user and all cascaded data.
 * Called by retention job after grace period.
 */
export async function hardDeleteUser(userId: string): Promise<void> {
  const prisma = getClient();
  audit(userId, 'hard_delete', 'user', userId, { trigger: 'retention_job' });
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Exports all personal data for a user (DSGVO Art. 15/20).
 * Returns structured JSON with all data categories.
 */
interface UserExportData {
  exportedAt: string;
  user: {
    email: string;
    displayName: string | null;
    region: string;
    locale: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  profile: {
    summary: string | null;
    traits: unknown;
    preferences: unknown;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  memories: Array<{
    type: string;
    title: string;
    body: string;
    sourceType: string;
    confidence: number;
    status: string;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
  entities: Array<{
    name: string;
    type: string;
    description: string | null;
    metadata: unknown;
    createdAt: Date;
  }>;
  projects: Array<{
    name: string;
    description: string | null;
    status: string;
    metadata: unknown;
    createdAt: Date;
  }>;
  usageEvents: Array<{
    type: string;
    tokensUsed: number;
    createdAt: Date;
  }>;
  consents: Array<{
    categories: unknown;
    version: string;
    createdAt: Date;
  }>;
  dailyQuestions: Array<{
    question: string;
    answer: string | null;
    answeredAt: Date | null;
    createdAt: Date;
  }>;
  referrals: Array<{
    code: string;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  auditLogs: Array<{
    action: string;
    resource: string;
    resourceId: string | null;
    createdAt: Date;
  }>;
  brainVersions: Array<{
    version: number;
    snapshot: unknown;
    mergeLog: unknown;
    createdAt: Date;
  }>;
  sourceEvents: Array<{
    sourceType: string;
    rawContent: string;
    isProcessed: boolean;
    createdAt: Date;
  }>;
  brainShares: Array<{
    shareToken: string;
    scope: string;
    expiresAt: Date | null;
    viewCount: number;
    createdAt: Date;
  }>;
  subscriptions: Array<{
    status: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
  }>;
}

export async function exportUserData(userId: string): Promise<UserExportData> {
  const prisma = getClient();

  const [
    user,
    profile,
    memories,
    entities,
    projects,
    usageEvents,
    consents,
    dailyQuestions,
    referrals,
    auditLogs,
    brainVersions,
    sourceEvents,
    brainShares,
    subscriptions,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        displayName: true,
        region: true,
        locale: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.brainProfile.findUnique({
      where: { userId },
      select: {
        summary: true,
        traits: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.memoryItem.findMany({
      where: { userId },
      select: {
        type: true,
        title: true,
        body: true,
        sourceType: true,
        confidence: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.entity.findMany({
      where: { userId },
      select: {
        name: true,
        type: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.project.findMany({
      where: { userId },
      select: {
        name: true,
        description: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.usageEvent.findMany({
      where: { userId },
      select: {
        type: true,
        tokensUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.consent.findMany({
      where: { userId },
      select: {
        categories: true,
        version: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dailyQuestion.findMany({
      where: { userId },
      select: {
        question: true,
        answer: true,
        answeredAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.referral.findMany({
      where: { referrerUserId: userId },
      select: {
        code: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      select: {
        action: true,
        resource: true,
        resourceId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.brainVersion.findMany({
      where: { userId },
      select: {
        version: true,
        snapshot: true,
        mergeLog: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sourceEvent.findMany({
      where: { userId },
      select: {
        sourceType: true,
        rawContent: true,
        isProcessed: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.brainShare.findMany({
      where: { userId },
      select: {
        shareToken: true,
        scope: true,
        expiresAt: true,
        viewCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscription.findMany({
      where: { userId },
      select: {
        status: true,
        periodStart: true,
        periodEnd: true,
        cancelAtPeriodEnd: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    profile,
    memories,
    entities,
    projects,
    usageEvents,
    consents,
    dailyQuestions,
    referrals,
    auditLogs,
    brainVersions,
    sourceEvents,
    brainShares,
    subscriptions,
  };
}

/**
 * Restores a soft-deleted user account during the 30-day grace period.
 * Re-activates the account so user can log in again.
 */
export async function restoreUser(userId: string): Promise<boolean> {
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true },
  });

  if (!user?.deletedAt) {
    return false;
  }

  const daysSinceDeletion = (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceDeletion > 30) {
    return false;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: null,
      isActive: true,
    },
  });

  return true;
}

/**
 * Stores a consent record with hashed IP.
 */
export async function storeConsent(
  userId: string | null,
  categories: Record<string, boolean>,
  version: string,
  ip?: string,
): Promise<{ id: string }> {
  const prisma = getClient();

  const ipHash = ip ? createHmac('sha256', config.auth.jwtSecret).update(ip).digest('hex') : null;

  const consent = await prisma.consent.create({
    data: {
      userId,
      categories,
      version,
      ipHash,
    },
  });

  return { id: consent.id };
}
