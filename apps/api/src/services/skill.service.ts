import { getClient } from '@onebrain/db';
import type { CreateSkillInput, UpdateSkillInput, SkillListQueryInput } from '@onebrain/schemas';

// ─── SkillForge Service ───

export interface SkillDto {
  id: string;
  memoryId: string;
  title: string;
  body: string;
  status: string;
  triggerConditions: unknown[];
  verificationSteps: unknown[];
  sourceMemoryIds: string[];
  confidenceScore: number;
  usageCount: number;
  decayScore: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listSkills(
  userId: string,
  query: SkillListQueryInput,
): Promise<{ items: SkillDto[]; hasMore: boolean; cursor: string | null }> {
  const prisma = getClient();
  const { status, minConfidence, sortBy, cursor, limit } = query;

  const orderBy =
    sortBy === 'usage'
      ? { usageCount: 'desc' as const }
      : sortBy === 'recency'
        ? { createdAt: 'desc' as const }
        : { confidenceScore: 'desc' as const };

  const skills = await prisma.skillMetadata.findMany({
    where: {
      memory: { userId, deletedAt: null },
      ...(status ? { status } : {}),
      ...(minConfidence !== undefined ? { confidenceScore: { gte: minConfidence } } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    include: {
      memory: { select: { title: true, body: true } },
    },
    orderBy,
    take: limit + 1,
  });

  const hasMore = skills.length > limit;
  const items = skills.slice(0, limit);

  return {
    items: items.map((s) => toDto(s)),
    hasMore,
    cursor: items.length > 0 ? items[items.length - 1]!.id : null,
  };
}

export async function getSkill(userId: string, skillId: string): Promise<SkillDto | null> {
  const prisma = getClient();

  const skill = await prisma.skillMetadata.findFirst({
    where: {
      id: skillId,
      memory: { userId, deletedAt: null },
    },
    include: {
      memory: { select: { title: true, body: true } },
    },
  });

  return skill ? toDto(skill) : null;
}

export async function createSkill(userId: string, input: CreateSkillInput): Promise<SkillDto> {
  const prisma = getClient();

  const result = await prisma.$transaction(async (tx) => {
    const memory = await tx.memoryItem.create({
      data: {
        userId,
        type: 'skill',
        title: input.title,
        body: input.body,
        sourceType: 'user_input',
        confidence: input.confidenceScore,
        status: 'active',
      },
    });

    const skillMeta = await tx.skillMetadata.create({
      data: {
        memoryId: memory.id,
        status: 'active',
        triggerConditions: input.triggerConditions,
        verificationSteps: input.verificationSteps,
        sourceMemoryIds: input.sourceMemoryIds,
        confidenceScore: input.confidenceScore,
      },
      include: {
        memory: { select: { title: true, body: true } },
      },
    });

    return skillMeta;
  });

  return toDto(result);
}

export async function updateSkill(
  userId: string,
  skillId: string,
  input: UpdateSkillInput,
): Promise<SkillDto | null> {
  const prisma = getClient();

  const existing = await prisma.skillMetadata.findFirst({
    where: { id: skillId, memory: { userId, deletedAt: null } },
  });

  if (!existing) return null;

  const result = await prisma.$transaction(async (tx) => {
    if (input.title || input.body) {
      await tx.memoryItem.update({
        where: { id: existing.memoryId },
        data: {
          ...(input.title ? { title: input.title } : {}),
          ...(input.body ? { body: input.body } : {}),
        },
      });
    }

    return tx.skillMetadata.update({
      where: { id: skillId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.triggerConditions ? { triggerConditions: input.triggerConditions } : {}),
        ...(input.verificationSteps ? { verificationSteps: input.verificationSteps } : {}),
        ...(input.confidenceScore !== undefined ? { confidenceScore: input.confidenceScore } : {}),
      },
      include: {
        memory: { select: { title: true, body: true } },
      },
    });
  });

  return toDto(result);
}

export async function deleteSkill(userId: string, skillId: string): Promise<boolean> {
  const prisma = getClient();

  const existing = await prisma.skillMetadata.findFirst({
    where: { id: skillId, memory: { userId, deletedAt: null } },
  });

  if (!existing) return false;

  await prisma.skillMetadata.update({
    where: { id: skillId },
    data: { status: 'dismissed' },
  });

  return true;
}

export async function recordSkillFeedback(
  skillId: string,
  agentId: string,
  eventType: string,
  context?: Record<string, unknown>,
): Promise<void> {
  const prisma = getClient();

  await prisma.$transaction(async (tx) => {
    await tx.skillUsageEvent.create({
      data: {
        skillMetadataId: skillId,
        agentId,
        eventType,
        context: (context ?? {}) as Record<string, string>,
      },
    });

    const updates: Record<string, unknown> = {
      lastUsedAt: new Date(),
    };

    if (eventType === 'applied') {
      updates['usageCount'] = { increment: 1 };
      updates['confidenceScore'] = { increment: 0.05 };
    } else if (eventType === 'referenced') {
      updates['usageCount'] = { increment: 1 };
      updates['confidenceScore'] = { increment: 0.01 };
    } else if (eventType === 'dismissed') {
      updates['confidenceScore'] = { decrement: 0.02 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tx.skillMetadata.update({ where: { id: skillId }, data: updates as any });
  });
}

// ─── SkillForge Scoring Engine ───

export function calculateSkillScore(skill: {
  confidenceScore: number;
  usageCount: number;
  decayScore: number;
  createdAt: Date;
  lastUsedAt: Date | null;
}): number {
  const daysSinceCreation = Math.max(
    1,
    (Date.now() - skill.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const usageRate = Math.min(skill.usageCount / daysSinceCreation, 1);

  const recencyBonus = skill.lastUsedAt
    ? Math.max(0, 1 - (Date.now() - skill.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0;

  const score =
    skill.confidenceScore * 0.3 + usageRate * 0.3 + recencyBonus * 0.25 + skill.decayScore * 0.15;

  return Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000;
}

export function applyDecay(currentDecay: number): number {
  return Math.max(0, Math.round((currentDecay - 0.05) * 100) / 100);
}

export function applyBoost(currentConfidence: number, eventType: string): number {
  const boost = eventType === 'applied' ? 0.05 : eventType === 'referenced' ? 0.01 : 0;
  return Math.min(0.95, Math.round((currentConfidence + boost) * 100) / 100);
}

export function shouldArchive(skill: {
  decayScore: number;
  usageCount: number;
  createdAt: Date;
}): boolean {
  const ageInDays = (Date.now() - skill.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return skill.decayScore < 0.2 && skill.usageCount < 3 && ageInDays > 30;
}

export function shouldPromote(skill: {
  status: string;
  confidenceScore: number;
  usageCount: number;
}): boolean {
  return skill.status === 'candidate' && skill.confidenceScore > 0.8 && skill.usageCount >= 5;
}

// ─── Helpers ───

function toDto(skill: {
  id: string;
  memoryId: string;
  status: string;
  triggerConditions: unknown;
  verificationSteps: unknown;
  sourceMemoryIds: string[];
  confidenceScore: number;
  usageCount: number;
  decayScore: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memory: { title: string; body: string };
}): SkillDto {
  return {
    id: skill.id,
    memoryId: skill.memoryId,
    title: skill.memory.title,
    body: skill.memory.body,
    status: skill.status,
    triggerConditions: skill.triggerConditions as unknown[],
    verificationSteps: skill.verificationSteps as unknown[],
    sourceMemoryIds: skill.sourceMemoryIds,
    confidenceScore: skill.confidenceScore,
    usageCount: skill.usageCount,
    decayScore: skill.decayScore,
    lastUsedAt: skill.lastUsedAt?.toISOString() ?? null,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };
}
