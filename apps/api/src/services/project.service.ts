import { getClient } from '@onebrain/db';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateProjectMemoryLinkInput,
} from '@onebrain/schemas';
import { audit } from '../lib/audit.js';
import { nullableJson } from '../lib/prisma-json.js';

interface ProjectDto {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectWithLinksDto extends ProjectDto {
  memoryLinks: {
    id: string;
    memoryItemId: string;
    linkType: string;
    createdAt: string;
  }[];
}

interface ProjectListResult {
  items: ProjectDto[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

function toDto(project: {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ProjectDto {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description,
    status: project.status,
    metadata: project.metadata as Record<string, unknown> | null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function listProjects(
  userId: string,
  options: { cursor?: string; limit: number; status?: string },
): Promise<ProjectListResult> {
  const prisma = getClient();
  const { cursor, limit, status } = options;

  const where = {
    userId,
    ...(status && { status: status as 'active' | 'archived' | 'completed' }),
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.project.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1]!.id : null;

  audit(userId, 'list', 'projects', undefined, { count: resultItems.length });

  return {
    items: resultItems.map(toDto),
    cursor: nextCursor,
    hasMore,
    total,
  };
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<ProjectWithLinksDto | null> {
  const prisma = getClient();

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      projectMemoryLinks: {
        select: {
          id: true,
          memoryItemId: true,
          linkType: true,
          createdAt: true,
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  audit(userId, 'read', 'project', project.id);

  return {
    ...toDto(project),
    memoryLinks: project.projectMemoryLinks.map((l) => ({
      id: l.id,
      memoryItemId: l.memoryItemId,
      linkType: l.linkType,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  const prisma = getClient();

  const project = await prisma.project.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      status: 'active',
      metadata: nullableJson(input.metadata ?? null),
    },
  });

  audit(userId, 'create', 'project', project.id);
  return toDto(project);
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectDto | null> {
  const prisma = getClient();

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!existing) {
    return null;
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.metadata !== undefined && { metadata: nullableJson(input.metadata) }),
    },
  });

  audit(userId, 'update', 'project', project.id);
  return toDto(project);
}

export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const prisma = getClient();

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!existing) {
    return false;
  }

  await prisma.project.delete({ where: { id: projectId } });
  audit(userId, 'delete', 'project', projectId);
  return true;
}

export async function addProjectMemoryLink(
  userId: string,
  projectId: string,
  input: CreateProjectMemoryLinkInput,
): Promise<{
  id: string;
  projectId: string;
  memoryItemId: string;
  linkType: string;
  createdAt: string;
} | null> {
  const prisma = getClient();

  const [project, memory] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, userId } }),
    prisma.memoryItem.findFirst({ where: { id: input.memoryItemId, userId, deletedAt: null } }),
  ]);

  if (!project || !memory) {
    return null;
  }

  const link = await prisma.projectMemoryLink.create({
    data: {
      projectId,
      memoryItemId: input.memoryItemId,
      linkType: input.linkType,
    },
  });

  audit(userId, 'create', 'project_memory_link', link.id, {
    projectId,
    memoryItemId: input.memoryItemId,
  });

  return {
    id: link.id,
    projectId: link.projectId,
    memoryItemId: link.memoryItemId,
    linkType: link.linkType,
    createdAt: link.createdAt.toISOString(),
  };
}

export async function removeProjectMemoryLink(
  userId: string,
  projectId: string,
  linkId: string,
): Promise<boolean> {
  const prisma = getClient();

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    return false;
  }

  const link = await prisma.projectMemoryLink.findFirst({
    where: { id: linkId, projectId },
  });

  if (!link) {
    return false;
  }

  await prisma.projectMemoryLink.delete({ where: { id: linkId } });
  audit(userId, 'delete', 'project_memory_link', linkId);
  return true;
}
