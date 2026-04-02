import crypto from 'node:crypto';
import { getClient } from '@onebrain/db';
import { jsonValue } from '../lib/prisma-json.js';

/** Sensitive field keys stripped from public snapshots and exports. */
const SENSITIVE_KEYS = new Set([
  'id',
  'userId',
  'user_id',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
  'deletedAt',
  'deleted_at',
]);

// ── Pure utility functions ──────────────────────────────────

/**
 * Generates a unique referral code with ob-ref- prefix.
 */
export function generateReferralCode(): string {
  return `ob-ref-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generates a unique share token with ob-share- prefix.
 */
export function generateShareToken(): string {
  return `ob-share-${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Strips sensitive fields (IDs, timestamps) from an object.
 */
export function stripSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!SENSITIVE_KEYS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/** Brain export input shape. */
export interface BrainExportData {
  profile: {
    summary: string | null;
    traits: Record<string, unknown>;
    preferences: Record<string, unknown>;
  };
  memories: Array<{
    type: string;
    title: string;
    body: string | null;
    status: string;
  }>;
  entities: Array<{
    name: string;
    type: string;
    description: string | null;
  }>;
  projects: Array<{
    name: string;
    description: string | null;
    status: string;
  }>;
}

/**
 * Formats brain data as a markdown export document.
 */
export function formatBrainExportMarkdown(data: BrainExportData): string {
  const lines: string[] = ['# Brain Export', ''];

  // Profile
  if (data.profile.summary) {
    lines.push('## Profile', '', data.profile.summary, '');
    const traits = Object.entries(data.profile.traits);
    if (traits.length > 0) {
      lines.push('### Traits');
      for (const [key, value] of traits) {
        lines.push(`- **${key}**: ${value}`);
      }
      lines.push('');
    }
    const prefs = Object.entries(data.profile.preferences);
    if (prefs.length > 0) {
      lines.push('### Preferences');
      for (const [key, value] of prefs) {
        lines.push(`- **${key}**: ${value}`);
      }
      lines.push('');
    }
  }

  // Memories grouped by type
  if (data.memories.length > 0) {
    lines.push('## Memories', '');
    const grouped = new Map<string, typeof data.memories>();
    for (const mem of data.memories) {
      const list = grouped.get(mem.type) ?? [];
      list.push(mem);
      grouped.set(mem.type, list);
    }
    for (const [type, items] of grouped) {
      lines.push(`### ${type}`, '');
      for (const item of items) {
        const body = item.body ? `: ${item.body}` : '';
        lines.push(`- **${item.title}**${body}`);
      }
      lines.push('');
    }
  }

  // Entities
  if (data.entities.length > 0) {
    lines.push('## Entities', '');
    for (const entity of data.entities) {
      const desc = entity.description ? `: ${entity.description}` : '';
      lines.push(`- **${entity.name}** (${entity.type})${desc}`);
    }
    lines.push('');
  }

  // Projects
  if (data.projects.length > 0) {
    lines.push('## Projects', '');
    for (const project of data.projects) {
      const desc = project.description ? `: ${project.description}` : '';
      lines.push(`- **${project.name}** [${project.status}]${desc}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates a system prompt that incorporates brain context
 * for use with external AI tools.
 */
export function generateAiExportPrompt(data: BrainExportData): string {
  const parts: string[] = [
    'You are an AI assistant with access to the following user context.',
    'Use this information as a system prompt to personalize your responses.',
    '',
  ];

  if (data.profile.summary) {
    parts.push(`## About the user`, '', data.profile.summary, '');
  }

  if (data.memories.length > 0) {
    parts.push('## Key facts and preferences', '');
    for (const mem of data.memories) {
      const body = mem.body ? ` — ${mem.body}` : '';
      parts.push(`- [${mem.type}] ${mem.title}${body}`);
    }
    parts.push('');
  }

  if (data.entities.length > 0) {
    parts.push('## People and entities the user knows', '');
    for (const entity of data.entities) {
      const desc = entity.description ? ` — ${entity.description}` : '';
      parts.push(`- ${entity.name} (${entity.type})${desc}`);
    }
    parts.push('');
  }

  if (data.projects.length > 0) {
    parts.push('## Active projects', '');
    for (const project of data.projects) {
      const desc = project.description ? ` — ${project.description}` : '';
      parts.push(`- ${project.name} [${project.status}]${desc}`);
    }
    parts.push('');
  }

  parts.push(
    'Use the above context to provide personalized, relevant responses.',
    'Do not repeat this context back to the user unless asked.',
  );

  return parts.join('\n');
}

// ── DB-backed operations ────────────────────────────────────

/**
 * Creates a referral code for a user.
 */
export async function createReferralCode(userId: string) {
  const prisma = getClient();
  const code = generateReferralCode();

  return prisma.referral.create({
    data: {
      referrerUserId: userId,
      code,
      status: 'pending',
    },
  });
}

/**
 * Completes a referral when a referred user signs up.
 */
export async function completeReferral(
  code: string,
  referredUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const prisma = getClient();

  const referral = await prisma.referral.findUnique({ where: { code } });
  if (!referral) {
    return { success: false, error: 'Referral code not found' };
  }

  if (referral.status === 'completed') {
    return { success: false, error: 'Referral already completed' };
  }

  if (referral.referrerUserId === referredUserId) {
    return { success: false, error: 'Cannot refer yourself' };
  }

  await prisma.referral.update({
    where: { code },
    data: {
      referredUserId,
      status: 'completed',
      completedAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Lists referrals for a user (as referrer).
 */
export async function getUserReferrals(userId: string, cursor?: string, limit = 20) {
  const prisma = getClient();

  const items = await prisma.referral.findMany({
    where: { referrerUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const result = hasMore ? items.slice(0, limit) : items;

  return {
    items: result,
    cursor: hasMore ? result[result.length - 1]!.id : null,
    hasMore,
  };
}

/**
 * Creates a shareable brain snapshot.
 * Strips sensitive data before storing.
 */
interface BrainShareRecord {
  id: string;
  userId: string;
  shareToken: string;
  snapshot: unknown;
  scope: string;
  expiresAt: Date | null;
  viewCount: number;
  createdAt: Date;
}

export async function createBrainShare(
  userId: string,
  scope: string,
  data: BrainExportData,
  expiresInHours?: number,
): Promise<BrainShareRecord> {
  const prisma = getClient();
  const shareToken = generateShareToken();

  // Strip sensitive fields from snapshot
  const sanitizedSnapshot = {
    profile: data.profile,
    memories: data.memories.map((m) => ({
      type: m.type,
      title: m.title,
      body: m.body,
      status: m.status,
    })),
    entities: data.entities.map((e) => ({
      name: e.name,
      type: e.type,
      description: e.description,
    })),
    projects: data.projects.map((p) => ({
      name: p.name,
      description: p.description,
      status: p.status,
    })),
  };

  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null;

  return prisma.brainShare.create({
    data: {
      userId,
      shareToken,
      snapshot: jsonValue(sanitizedSnapshot as unknown as Record<string, unknown>),
      scope,
      expiresAt,
    },
  });
}

/**
 * Retrieves a brain share by token. Increments view count.
 * Returns null if expired or not found.
 */
export async function getBrainShare(shareToken: string): Promise<BrainShareRecord | null> {
  const prisma = getClient();

  const share = await prisma.brainShare.findUnique({
    where: { shareToken },
  });

  if (!share) return null;

  if (share.expiresAt && share.expiresAt < new Date()) {
    return null;
  }

  await prisma.brainShare.update({
    where: { shareToken },
    data: { viewCount: { increment: 1 } },
  });

  return share;
}

/**
 * Fetches full brain export data for a user.
 */
export async function getBrainExportData(userId: string): Promise<BrainExportData> {
  const prisma = getClient();

  const [profile, memories, entities, projects] = await Promise.all([
    prisma.brainProfile.findUnique({ where: { userId } }),
    prisma.memoryItem.findMany({
      where: { userId, status: 'active' },
      select: { type: true, title: true, body: true, status: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.entity.findMany({
      where: { userId },
      select: { name: true, type: true, description: true },
      orderBy: { name: 'asc' },
    }),
    prisma.project.findMany({
      where: { userId },
      select: { name: true, description: true, status: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    profile: {
      summary: profile?.summary ?? null,
      traits: (profile?.traits as Record<string, unknown>) ?? {},
      preferences: (profile?.preferences as Record<string, unknown>) ?? {},
    },
    memories,
    entities,
    projects,
  };
}

/**
 * Lists brain shares for a user with cursor pagination.
 */
export async function getUserShares(
  userId: string,
  cursor?: string,
  limit = 20,
): Promise<{
  items: Array<{
    id: string;
    shareToken: string;
    scope: string;
    viewCount: number;
    createdAt: Date;
    expiresAt: Date | null;
    [key: string]: unknown;
  }>;
  cursor: string | null;
  hasMore: boolean;
}> {
  const prisma = getClient();

  const items = await prisma.brainShare.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const result = hasMore ? items.slice(0, limit) : items;

  return {
    items: result,
    cursor: hasMore ? result[result.length - 1]!.id : null,
    hasMore,
  };
}

/**
 * Revokes (deletes) a brain share owned by the user.
 * Returns true if deleted, false if not found.
 */
export async function revokeBrainShare(userId: string, shareId: string): Promise<boolean> {
  const prisma = getClient();

  const share = await prisma.brainShare.findFirst({
    where: { id: shareId, userId },
  });

  if (!share) return false;

  await prisma.brainShare.delete({ where: { id: shareId } });
  return true;
}

/**
 * Grants referral reward: extends referrer's plan by 30 days.
 * Sets rewardGranted on the referral record.
 */
export async function grantReferralReward(code: string): Promise<{
  granted: boolean;
  referrerUserId?: string;
}> {
  const prisma = getClient();

  const referral = await prisma.referral.findUnique({
    where: { code },
  });

  if (!referral || referral.status !== 'completed') {
    return { granted: false };
  }

  if (referral.rewardGranted) {
    return { granted: false, referrerUserId: referral.referrerUserId };
  }

  // Extend the referrer's active plan by 30 days
  const activePlan = await prisma.userPlan.findFirst({
    where: {
      userId: referral.referrerUserId,
      isActive: true,
    },
    orderBy: { startedAt: 'desc' },
  });

  if (activePlan) {
    const currentExpiry = activePlan.expiresAt ?? new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.userPlan.update({
      where: { id: activePlan.id },
      data: { expiresAt: newExpiry },
    });
  }

  // Mark reward as granted
  await prisma.referral.update({
    where: { code },
    data: { rewardGranted: true },
  });

  return { granted: true, referrerUserId: referral.referrerUserId };
}
