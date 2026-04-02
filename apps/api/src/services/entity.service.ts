import { getClient } from '@onebrain/db';
import type {
  CreateEntityInput,
  UpdateEntityInput,
  CreateEntityLinkInput,
} from '@onebrain/schemas';
import { audit } from '../lib/audit.js';
import { nullableJson } from '../lib/prisma-json.js';
import { diceCoefficient } from '../lib/similarity.js';

interface EntityDto {
  id: string;
  userId: string;
  name: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface EntityWithLinksDto extends EntityDto {
  links: {
    id: string;
    memoryItemId: string;
    linkType: string;
    createdAt: string;
  }[];
}

interface EntityListResult {
  items: EntityDto[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

function toDto(entity: {
  id: string;
  userId: string;
  name: string;
  type: string;
  description: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): EntityDto {
  return {
    id: entity.id,
    userId: entity.userId,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    metadata: entity.metadata as Record<string, unknown> | null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export async function listEntities(
  userId: string,
  options: { cursor?: string; limit: number; type?: string },
): Promise<EntityListResult> {
  const prisma = getClient();
  const { cursor, limit, type } = options;

  const where = {
    userId,
    ...(type && { type }),
  };

  const [items, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.entity.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1]!.id : null;

  audit(userId, 'list', 'entities', undefined, { count: resultItems.length });

  return {
    items: resultItems.map(toDto),
    cursor: nextCursor,
    hasMore,
    total,
  };
}

/**
 * List all entities with their links for graph visualization.
 * Returns all entities (no pagination) with link data.
 */
export async function listEntitiesWithLinks(userId: string): Promise<EntityWithLinksDto[]> {
  const prisma = getClient();

  const entities = await prisma.entity.findMany({
    where: { userId },
    include: {
      entityLinks: {
        select: {
          id: true,
          memoryItemId: true,
          linkType: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  audit(userId, 'list', 'entities_graph', undefined, {
    count: entities.length,
  });

  return entities.map((entity) => ({
    ...toDto(entity),
    links: entity.entityLinks.map((link) => ({
      id: link.id,
      memoryItemId: link.memoryItemId,
      linkType: link.linkType,
      createdAt: link.createdAt.toISOString(),
    })),
  }));
}

export async function getEntity(
  userId: string,
  entityId: string,
): Promise<EntityWithLinksDto | null> {
  const prisma = getClient();

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, userId },
    include: {
      entityLinks: {
        select: {
          id: true,
          memoryItemId: true,
          linkType: true,
          createdAt: true,
        },
      },
    },
  });

  if (!entity) {
    return null;
  }

  audit(userId, 'read', 'entity', entity.id);

  return {
    ...toDto(entity),
    links: entity.entityLinks.map((l) => ({
      id: l.id,
      memoryItemId: l.memoryItemId,
      linkType: l.linkType,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

export async function createEntity(userId: string, input: CreateEntityInput): Promise<EntityDto> {
  const prisma = getClient();

  const entity = await prisma.entity.create({
    data: {
      userId,
      name: input.name,
      type: input.type.toLowerCase(),
      description: input.description ?? null,
      metadata: nullableJson(input.metadata ?? null),
    },
  });

  audit(userId, 'create', 'entity', entity.id);
  return toDto(entity);
}

export async function updateEntity(
  userId: string,
  entityId: string,
  input: UpdateEntityInput,
): Promise<EntityDto | null> {
  const prisma = getClient();

  const existing = await prisma.entity.findFirst({
    where: { id: entityId, userId },
  });

  if (!existing) {
    return null;
  }

  const entity = await prisma.entity.update({
    where: { id: entityId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type.toLowerCase() }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.metadata !== undefined && { metadata: nullableJson(input.metadata) }),
    },
  });

  audit(userId, 'update', 'entity', entity.id);
  return toDto(entity);
}

export async function deleteEntity(userId: string, entityId: string): Promise<boolean> {
  const prisma = getClient();

  const existing = await prisma.entity.findFirst({
    where: { id: entityId, userId },
  });

  if (!existing) {
    return false;
  }

  await prisma.entity.delete({ where: { id: entityId } });
  audit(userId, 'delete', 'entity', entityId);
  return true;
}

export async function addEntityLink(
  userId: string,
  entityId: string,
  input: CreateEntityLinkInput,
): Promise<{
  id: string;
  entityId: string;
  memoryItemId: string;
  linkType: string;
  createdAt: string;
} | null> {
  const prisma = getClient();

  const [entity, memory] = await Promise.all([
    prisma.entity.findFirst({ where: { id: entityId, userId } }),
    prisma.memoryItem.findFirst({ where: { id: input.memoryItemId, userId, deletedAt: null } }),
  ]);

  if (!entity || !memory) {
    return null;
  }

  const link = await prisma.entityLink.create({
    data: {
      entityId,
      memoryItemId: input.memoryItemId,
      linkType: input.linkType,
    },
  });

  audit(userId, 'create', 'entity_link', link.id, {
    entityId,
    memoryItemId: input.memoryItemId,
  });

  return {
    id: link.id,
    entityId: link.entityId,
    memoryItemId: link.memoryItemId,
    linkType: link.linkType,
    createdAt: link.createdAt.toISOString(),
  };
}

/**
 * Find duplicate entities for a user based on name similarity.
 * Uses dice coefficient with threshold 0.7 for same-type entities.
 */
export async function findDuplicateEntities(userId: string): Promise<{
  duplicates: {
    entityA: EntityDto;
    entityB: EntityDto;
    similarity: number;
  }[];
}> {
  const prisma = getClient();

  const entities = await prisma.entity.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });

  const duplicates: {
    entityA: EntityDto;
    entityB: EntityDto;
    similarity: number;
  }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const entityA = entities[i]!;
      const entityB = entities[j]!;

      if (entityA.type !== entityB.type) continue;

      const pairKey = [entityA.id, entityB.id].sort().join(':');
      if (seen.has(pairKey)) continue;

      const score = diceCoefficient(entityA.name.toLowerCase(), entityB.name.toLowerCase());

      if (score > 0.7) {
        seen.add(pairKey);
        duplicates.push({
          entityA: toDto(entityA),
          entityB: toDto(entityB),
          similarity: Math.round(score * 100) / 100,
        });
      }
    }
  }

  audit(userId, 'find_duplicates', 'entities', undefined, {
    count: duplicates.length,
  });

  return { duplicates };
}

/**
 * Merge two entities: move all links from removeId to keepId,
 * then delete the removed entity.
 */
export async function mergeEntities(
  userId: string,
  keepId: string,
  removeId: string,
): Promise<{ merged: boolean; linksTransferred: number }> {
  const prisma = getClient();

  const [keepEntity, removeEntity] = await Promise.all([
    prisma.entity.findFirst({ where: { id: keepId, userId } }),
    prisma.entity.findFirst({ where: { id: removeId, userId } }),
  ]);

  if (!keepEntity || !removeEntity) {
    return { merged: false, linksTransferred: 0 };
  }

  const linksToMove = await prisma.entityLink.findMany({
    where: { entityId: removeId },
    select: { id: true, memoryItemId: true, linkType: true },
  });

  let transferred = 0;

  for (const link of linksToMove) {
    const existingLink = await prisma.entityLink.findFirst({
      where: {
        entityId: keepId,
        memoryItemId: link.memoryItemId,
      },
      select: { id: true },
    });

    if (existingLink) {
      await prisma.entityLink.delete({ where: { id: link.id } });
    } else {
      await prisma.entityLink.update({
        where: { id: link.id },
        data: { entityId: keepId },
      });
      transferred++;
    }
  }

  await prisma.entity.delete({ where: { id: removeId } });

  audit(userId, 'merge', 'entity', keepId, {
    removedEntityId: removeId,
    linksTransferred: transferred,
  });

  return { merged: true, linksTransferred: transferred };
}

export async function removeEntityLink(
  userId: string,
  entityId: string,
  linkId: string,
): Promise<boolean> {
  const prisma = getClient();

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, userId },
  });

  if (!entity) {
    return false;
  }

  const link = await prisma.entityLink.findFirst({
    where: { id: linkId, entityId },
  });

  if (!link) {
    return false;
  }

  await prisma.entityLink.delete({ where: { id: linkId } });
  audit(userId, 'delete', 'entity_link', linkId);
  return true;
}
