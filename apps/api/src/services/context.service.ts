import { getClient } from '@onebrain/db';
import { audit } from '../lib/audit.js';
import { decryptMemory } from '../lib/memory-encryption.js';
import {
  buildContext,
  VALID_SCOPES,
  type ContextScope,
  type ContextResult,
  type ContextSkill,
  type RawMemoryItem,
  type RawEntity,
  type RawProject,
  type ProfileSummary,
  type ContextStats,
} from '../lib/context-engine/index.js';
import { canUseSkillForge } from '../lib/feature-gate.js';

/**
 * Build optimized LLM context for a user.
 * Fetches data from DB and delegates to the context engine.
 */
export async function getOptimizedContext(
  userId: string,
  scope: ContextScope,
): Promise<ContextResult> {
  const prisma = getClient();

  // Check if user has SkillForge to include skills in context
  let hasSkillForge = false;
  try {
    hasSkillForge = await canUseSkillForge(userId);
  } catch {
    // Plan not found or feature gate unavailable — skip skills
  }

  const [
    profileRow,
    memoryRows,
    entityRows,
    projectRows,
    skillRows,
    memoriesCount,
    entitiesCount,
    projectsCount,
    latestVersion,
  ] = await Promise.all([
    prisma.brainProfile.findUnique({ where: { userId } }),
    prisma.memoryItem.findMany({
      where: { userId, status: 'active' },
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
        isEncrypted: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.entity.findMany({
      where: { userId },
      include: { _count: { select: { entityLinks: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.project.findMany({
      where: { userId },
      include: { _count: { select: { projectMemoryLinks: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    hasSkillForge
      ? prisma.skillMetadata.findMany({
          where: { status: 'active', memory: { userId, deletedAt: null } },
          include: { memory: { select: { title: true, body: true } } },
          orderBy: { confidenceScore: 'desc' },
          take: 20,
        })
      : Promise.resolve([]),
    prisma.memoryItem.count({ where: { userId, status: 'active' } }),
    prisma.entity.count({ where: { userId } }),
    prisma.project.count({ where: { userId } }),
    prisma.brainVersion.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { version: true },
    }),
  ]);

  const profile: ProfileSummary = {
    summary: profileRow?.summary ?? null,
    traits: (profileRow?.traits as Record<string, unknown>) ?? {},
    preferences: (profileRow?.preferences as Record<string, unknown>) ?? {},
  };

  const memories: RawMemoryItem[] = memoryRows.map((m) => {
    const { title, body } = decryptMemory(userId, {
      title: m.title,
      body: m.body,
      isEncrypted: m.isEncrypted,
    });
    return {
      id: m.id,
      type: m.type,
      title,
      body,
      sourceType: m.sourceType,
      confidence: m.confidence,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  });

  const entities: RawEntity[] = entityRows.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    description: e.description,
    linkCount: e._count.entityLinks,
    updatedAt: e.updatedAt.toISOString(),
  }));

  const projects: RawProject[] = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    memoryLinkCount: p._count.projectMemoryLinks,
    updatedAt: p.updatedAt.toISOString(),
  }));

  const skills: ContextSkill[] = skillRows.map((s) => ({
    title: (s as { memory: { title: string } }).memory.title,
    body: (s as { memory: { body: string } }).memory.body,
    triggerConditions: (s.triggerConditions as string[]) ?? [],
    confidenceScore: s.confidenceScore,
    usageCount: s.usageCount,
  }));

  const stats: ContextStats = {
    totalMemories: memoriesCount,
    totalEntities: entitiesCount,
    totalProjects: projectsCount,
    latestVersion: latestVersion?.version ?? null,
  };

  const result = buildContext(scope, memories, entities, projects, profile, stats, skills);

  audit(userId, 'read', 'context', undefined, {
    scope,
    tokenEstimate: result.meta.tokenEstimate,
    truncated: result.meta.truncated,
  });

  return result;
}

export function isValidScope(scope: string): scope is ContextScope {
  return VALID_SCOPES.has(scope);
}
