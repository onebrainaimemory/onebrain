import { getClient } from '@onebrain/db';
import type { CreateTagInput } from '@onebrain/schemas';
import { audit } from '../lib/audit.js';

interface TagDto {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

interface MemoryTagDto {
  memoryItemId: string;
  tagId: string;
  tagName: string;
  tagColor: string;
}

function toTagDto(tag: {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: Date;
}): TagDto {
  return {
    id: tag.id,
    userId: tag.userId,
    name: tag.name,
    color: tag.color ?? '#6b7280',
    createdAt: tag.createdAt.toISOString(),
  };
}

export async function listTags(userId: string): Promise<TagDto[]> {
  const prisma = getClient();

  const tags = await prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });

  audit(userId, 'list', 'tags', undefined, { count: tags.length });
  return tags.map(toTagDto);
}

export async function createTag(userId: string, input: CreateTagInput): Promise<TagDto> {
  const prisma = getClient();

  const tag = await prisma.tag.create({
    data: {
      userId,
      name: input.name,
      color: input.color,
    },
  });

  audit(userId, 'create', 'tag', tag.id);
  return toTagDto(tag);
}

export async function deleteTag(userId: string, tagId: string): Promise<boolean> {
  const prisma = getClient();

  const existing = await prisma.tag.findFirst({
    where: { id: tagId, userId },
  });

  if (!existing) {
    return false;
  }

  await prisma.memoryTag.deleteMany({ where: { tagId } });
  await prisma.tag.delete({ where: { id: tagId } });

  audit(userId, 'delete', 'tag', tagId);
  return true;
}

export async function addTagToMemory(
  userId: string,
  memoryId: string,
  tagId: string,
): Promise<MemoryTagDto | null> {
  const prisma = getClient();

  const [memory, tag] = await Promise.all([
    prisma.memoryItem.findFirst({ where: { id: memoryId, userId, deletedAt: null } }),
    prisma.tag.findFirst({ where: { id: tagId, userId } }),
  ]);

  if (!memory || !tag) {
    return null;
  }

  const existing = await prisma.memoryTag.findFirst({
    where: { memoryItemId: memoryId, tagId },
  });

  if (existing) {
    return {
      memoryItemId: memoryId,
      tagId,
      tagName: tag.name,
      tagColor: tag.color ?? '#6b7280',
    };
  }

  await prisma.memoryTag.create({
    data: { memoryItemId: memoryId, tagId },
  });

  audit(userId, 'add_tag', 'memory_item', memoryId, { tagId });

  return {
    memoryItemId: memoryId,
    tagId,
    tagName: tag.name,
    tagColor: tag.color ?? '#6b7280',
  };
}

export async function removeTagFromMemory(
  userId: string,
  memoryId: string,
  tagId: string,
): Promise<boolean> {
  const prisma = getClient();

  const memory = await prisma.memoryItem.findFirst({
    where: { id: memoryId, userId, deletedAt: null },
  });

  if (!memory) {
    return false;
  }

  const existing = await prisma.memoryTag.findFirst({
    where: { memoryItemId: memoryId, tagId },
  });

  if (!existing) {
    return false;
  }

  await prisma.memoryTag.delete({
    where: { id: existing.id },
  });

  audit(userId, 'remove_tag', 'memory_item', memoryId, { tagId });
  return true;
}

export async function getTagsForMemory(memoryId: string): Promise<MemoryTagDto[]> {
  const prisma = getClient();

  const memoryTags = await prisma.memoryTag.findMany({
    where: { memoryItemId: memoryId },
    include: { tag: true },
  });

  return memoryTags.map((mt) => ({
    memoryItemId: mt.memoryItemId,
    tagId: mt.tagId,
    tagName: mt.tag.name,
    tagColor: mt.tag.color ?? '#6b7280',
  }));
}
