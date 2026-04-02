import { getClient } from '@onebrain/db';
import type { UpdateBrainProfileInput } from '@onebrain/schemas';
import { audit } from '../lib/audit.js';
import { jsonValue } from '../lib/prisma-json.js';

interface BrainProfileDto {
  id: string;
  userId: string;
  summary: string | null;
  traits: Record<string, unknown>;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface BrainContextDto {
  profile: BrainProfileDto;
  recentMemories: {
    id: string;
    type: string;
    title: string;
    body: string;
    confidence: number;
    createdAt: string;
  }[];
  topEntities: {
    id: string;
    name: string;
    type: string;
    linkCount: number;
  }[];
  activeProjects: {
    id: string;
    name: string;
    description: string | null;
  }[];
  stats: {
    totalMemories: number;
    totalEntities: number;
    totalProjects: number;
    latestVersion: number | null;
  };
}

export async function getProfile(userId: string): Promise<BrainProfileDto> {
  const prisma = getClient();

  let profile = await prisma.brainProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.brainProfile.create({
      data: {
        userId,
        traits: {},
        preferences: {},
      },
    });
  }

  audit(userId, 'read', 'brain_profile', profile.id);

  return {
    id: profile.id,
    userId: profile.userId,
    summary: profile.summary,
    traits: profile.traits as Record<string, unknown>,
    preferences: profile.preferences as Record<string, unknown>,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function updateProfile(
  userId: string,
  input: UpdateBrainProfileInput,
): Promise<BrainProfileDto> {
  const prisma = getClient();

  const profile = await prisma.brainProfile.upsert({
    where: { userId },
    update: {
      ...(input.summary !== undefined && { summary: input.summary }),
      ...(input.traits && { traits: jsonValue(input.traits) }),
      ...(input.preferences && { preferences: jsonValue(input.preferences) }),
    },
    create: {
      userId,
      summary: input.summary ?? null,
      traits: jsonValue(input.traits ?? {}),
      preferences: jsonValue(input.preferences ?? {}),
    },
  });

  audit(userId, 'update', 'brain_profile', profile.id);

  return {
    id: profile.id,
    userId: profile.userId,
    summary: profile.summary,
    traits: profile.traits as Record<string, unknown>,
    preferences: profile.preferences as Record<string, unknown>,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function getContext(userId: string): Promise<BrainContextDto> {
  const prisma = getClient();

  const [profile, recentMemories, entities, activeProjects, stats, latestVersion] =
    await Promise.all([
      getProfile(userId),
      prisma.memoryItem.findMany({
        where: { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          confidence: true,
          createdAt: true,
        },
      }),
      prisma.entity.findMany({
        where: { userId },
        include: { _count: { select: { entityLinks: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.project.findMany({
        where: { userId, status: 'active' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, name: true, description: true },
      }),
      Promise.all([
        prisma.memoryItem.count({ where: { userId, status: 'active' } }),
        prisma.entity.count({ where: { userId } }),
        prisma.project.count({ where: { userId } }),
      ]),
      prisma.brainVersion.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
    ]);

  audit(userId, 'read', 'brain_context');

  return {
    profile,
    recentMemories: recentMemories.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      body: m.body,
      confidence: m.confidence,
      createdAt: m.createdAt.toISOString(),
    })),
    topEntities: entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      linkCount: e._count.entityLinks,
    })),
    activeProjects,
    stats: {
      totalMemories: stats[0],
      totalEntities: stats[1],
      totalProjects: stats[2],
      latestVersion: latestVersion?.version ?? null,
    },
  };
}
