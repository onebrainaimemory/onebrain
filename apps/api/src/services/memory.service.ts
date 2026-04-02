import { getClient } from '@onebrain/db';
import type { CreateMemoryInput, UpdateMemoryInput } from '@onebrain/schemas';
import { audit } from '../lib/audit.js';
import { nullableJson } from '../lib/prisma-json.js';
import { normalize, SimilarityThresholds } from '@onebrain/shared';
import { diceCoefficient, isSimilar } from '../lib/similarity.js';
import { encryptMemory, decryptMemory } from '../lib/memory-encryption.js';
import { enqueueEmbedding, enqueueEmbeddingUpdate } from '../queues/embedding.queue.js';
import { enqueueSkillAnalysis } from '../queues/skill-analysis.queue.js';

const { DEDUP: DEDUP_THRESHOLD, CONFLICT: CONFLICT_THRESHOLD } = SimilarityThresholds;

interface MemoryItemDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  sourceType: string;
  confidence: number;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryListResult {
  items: MemoryItemDto[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

function toDto(item: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  sourceType: string;
  confidence: number;
  status: string;
  isEncrypted?: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): MemoryItemDto {
  // Decrypt fields if encrypted
  const { title, body } = decryptMemory(item.userId, {
    title: item.title,
    body: item.body,
    isEncrypted: item.isEncrypted ?? false,
  });

  return {
    id: item.id,
    userId: item.userId,
    type: item.type,
    title,
    body,
    sourceType: item.sourceType,
    confidence: item.confidence,
    status: item.status,
    metadata: item.metadata as Record<string, unknown> | null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listMemories(
  userId: string,
  options: {
    cursor?: string;
    limit: number;
    type?: string;
    status?: string;
    search?: string;
  },
): Promise<MemoryListResult> {
  const prisma = getClient();
  const { cursor, limit, type, status, search } = options;

  const where: Record<string, unknown> = {
    userId,
    deletedAt: null,
    ...(type && { type }),
    ...(status && { status }),
  };

  if (search) {
    where['OR'] = [
      { title: { contains: search, mode: 'insensitive' } },
      { body: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.memoryItem.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.memoryItem.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1]!.id : null;

  audit(userId, 'list', 'memory_items', undefined, { count: resultItems.length });

  return {
    items: resultItems.map(toDto),
    cursor: nextCursor,
    hasMore,
    total,
  };
}

export async function getMemory(userId: string, memoryId: string): Promise<MemoryItemDto | null> {
  const prisma = getClient();

  const item = await prisma.memoryItem.findFirst({
    where: { id: memoryId, userId, deletedAt: null },
  });

  if (!item) {
    return null;
  }

  audit(userId, 'read', 'memory_item', item.id);
  return toDto(item);
}

export async function createMemory(
  userId: string,
  input: CreateMemoryInput,
  apiKeyId?: string,
): Promise<MemoryItemDto> {
  const prisma = getClient();

  // Encrypt title and body if encryption is configured
  const encrypted = encryptMemory(userId, { title: input.title, body: input.body });

  const item = await prisma.memoryItem.create({
    data: {
      userId,
      type: input.type,
      title: encrypted.title,
      body: encrypted.body,
      sourceType: input.sourceType,
      confidence: input.confidence,
      status: 'active',
      isEncrypted: encrypted.isEncrypted,
      metadata: nullableJson(input.metadata ?? null),
      ...(apiKeyId ? { apiKeyId } : {}),
    },
  });

  audit(userId, 'create', 'memory_item', item.id);

  // DeepRecall: async embedding generation (fire-and-forget)
  enqueueEmbedding(item.id, userId).catch(() => {});

  return toDto(item);
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  input: UpdateMemoryInput,
): Promise<MemoryItemDto | null> {
  const prisma = getClient();

  const existing = await prisma.memoryItem.findFirst({
    where: { id: memoryId, userId, deletedAt: null },
  });

  if (!existing) {
    return null;
  }

  // Re-encrypt updated fields
  const encrypted = encryptMemory(userId, {
    title: input.title ?? existing.title,
    body: input.body ?? existing.body,
  });

  const item = await prisma.memoryItem.update({
    where: { id: memoryId },
    data: {
      ...(input.title !== undefined && { title: encrypted.title }),
      ...(input.body !== undefined && { body: encrypted.body }),
      ...(input.confidence !== undefined && { confidence: input.confidence }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.metadata !== undefined && { metadata: nullableJson(input.metadata) }),
      isEncrypted: encrypted.isEncrypted,
    },
  });

  audit(userId, 'update', 'memory_item', item.id);

  // DeepRecall: re-embed if text content changed (fire-and-forget)
  if (input.title !== undefined || input.body !== undefined) {
    enqueueEmbeddingUpdate(item.id, userId).catch(() => {});
  }

  return toDto(item);
}

export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  const prisma = getClient();

  const existing = await prisma.memoryItem.findFirst({
    where: { id: memoryId, userId, deletedAt: null },
  });

  if (!existing) {
    return false;
  }

  await prisma.memoryItem.update({
    where: { id: memoryId },
    data: { deletedAt: new Date(), status: 'archived' },
  });
  audit(userId, 'soft_delete', 'memory_item', memoryId);
  return true;
}

export async function extractMemory(
  userId: string,
  input: CreateMemoryInput,
): Promise<MemoryItemDto> {
  const prisma = getClient();

  const sourceEvent = await prisma.sourceEvent.create({
    data: {
      userId,
      sourceType: input.sourceType,
      rawContent: JSON.stringify({ title: input.title, body: input.body }),
      isProcessed: false,
    },
  });

  const item = await prisma.memoryItem.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      sourceType: input.sourceType,
      confidence: input.confidence,
      status: 'candidate',
      metadata: nullableJson(input.metadata ?? null),
    },
  });

  await prisma.sourceEvent.update({
    where: { id: sourceEvent.id },
    data: {
      isProcessed: true,
      memoryItemId: item.id,
    },
  });

  audit(userId, 'extract', 'memory_item', item.id, {
    sourceEventId: sourceEvent.id,
  });

  // Auto-merge on extract if enabled
  const mergeOnExtract = process.env['MERGE_ON_EXTRACT'] !== 'false';
  if (mergeOnExtract) {
    await autoMergeCandidate(userId, item.id);
  }

  // DeepRecall: async embedding for extracted memories
  enqueueEmbedding(item.id, userId).catch(() => {});

  // SkillForge: trigger analysis after agent writes (fire-and-forget)
  if (input.sourceType === 'ai_extraction' || input.sourceType === 'system_inference') {
    enqueueSkillAnalysis(userId, 24).catch(() => {});
  }

  // Re-fetch to get the potentially updated status
  const updated = await prisma.memoryItem.findUnique({
    where: { id: item.id },
  });

  return toDto(updated ?? item);
}

/**
 * Auto-merge a candidate against existing active memories.
 * If high-confidence duplicate (>0.8), auto-archive candidate and
 * boost existing. If conflict detected, mark both as conflicted.
 */
export async function autoMergeCandidate(
  userId: string,
  candidateId: string,
): Promise<{ action: 'none' | 'archived' | 'conflicted' }> {
  const prisma = getClient();

  const candidate = await prisma.memoryItem.findFirst({
    where: { id: candidateId, userId, status: 'candidate' },
  });

  if (!candidate) {
    return { action: 'none' };
  }

  const activeMemories = await prisma.memoryItem.findMany({
    where: { userId, status: 'active', type: candidate.type },
    take: 200,
  });

  const normalizedTitle = normalize(candidate.title);
  const normalizedBody = normalize(candidate.body);

  for (const existing of activeMemories) {
    const existTitle = normalize(existing.title);
    const existBody = normalize(existing.body);

    const titleSim = diceCoefficient(normalizedTitle, existTitle);
    const bodySim = diceCoefficient(normalizedBody, existBody);

    // High-confidence duplicate: similar title AND body
    if (titleSim > DEDUP_THRESHOLD && bodySim > CONFLICT_THRESHOLD) {
      await prisma.memoryItem.update({
        where: { id: candidateId },
        data: { status: 'archived' },
      });

      const boosted = Math.min(1.0, existing.confidence + 0.1);
      await prisma.memoryItem.update({
        where: { id: existing.id },
        data: { confidence: Math.round(boosted * 100) / 100 },
      });

      audit(userId, 'auto_merge', 'memory_item', candidateId, {
        action: 'archived',
        existingId: existing.id,
        titleSimilarity: Math.round(titleSim * 100) / 100,
      });

      return { action: 'archived' };
    }

    // Conflict: same topic but different body
    const sameTopic = isSimilar(normalizedTitle, existTitle, CONFLICT_THRESHOLD);
    const differentBody = !isSimilar(normalizedBody, existBody, CONFLICT_THRESHOLD);

    if (sameTopic && differentBody) {
      await prisma.memoryItem.updateMany({
        where: { id: { in: [candidateId, existing.id] } },
        data: { status: 'conflicted' },
      });

      audit(userId, 'auto_merge', 'memory_item', candidateId, {
        action: 'conflicted',
        existingId: existing.id,
      });

      return { action: 'conflicted' };
    }
  }

  return { action: 'none' };
}

interface DuplicatePair {
  memoryA: MemoryItemDto;
  memoryB: MemoryItemDto;
  similarity: number;
}

export async function scanForDuplicates(userId: string, threshold = 0.6): Promise<DuplicatePair[]> {
  const prisma = getClient();

  // NOTE: take: 200 bounds query latency. Future: cursor-based pagination for full coverage.
  const items = await prisma.memoryItem.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const duplicates: DuplicatePair[] = [];
  let foundInOuterLoop = false;

  for (let i = 0; i < items.length; i++) {
    foundInOuterLoop = false;
    for (let j = i + 1; j < items.length; j++) {
      const itemA = items[i]!;
      const itemB = items[j]!;
      const titleSim = diceCoefficient(itemA.title, itemB.title);

      if (titleSim >= threshold) {
        duplicates.push({
          memoryA: toDto(itemA),
          memoryB: toDto(itemB),
          similarity: Math.round(titleSim * 100) / 100,
        });
        foundInOuterLoop = true;
      }
    }

    // Early exit: if no duplicates found for this item and we haven't
    // found much recently, remaining items are likely distinct
    if (!foundInOuterLoop && duplicates.length > 0) break;

    if (duplicates.length >= 50) {
      break;
    }
  }

  audit(userId, 'scan_duplicates', 'memory_items', undefined, {
    count: duplicates.length,
  });

  return duplicates;
}

interface ImportItem {
  title: string;
  body: string;
  type?: string;
}

export async function importMemories(
  userId: string,
  items: ImportItem[],
): Promise<{ created: number; errors: string[] }> {
  const prisma = getClient();
  let created = 0;
  const errors: string[] = [];

  if (items.length > 100) {
    throw new Error('Import batch exceeds maximum of 100 items');
  }

  const validTypes = new Set<string>([
    'fact',
    'preference',
    'decision',
    'goal',
    'experience',
    'skill',
  ]);

  type MemoryType = 'fact' | 'preference' | 'decision' | 'goal' | 'experience' | 'skill';

  for (const item of items) {
    const memType: MemoryType = validTypes.has(item.type ?? '')
      ? (item.type as MemoryType)
      : 'fact';

    if (!item.title?.trim() || !item.body?.trim()) {
      errors.push(`Skipped empty item: ${item.title ?? '(no title)'}`);
      continue;
    }

    try {
      await prisma.memoryItem.create({
        data: {
          userId,
          type: memType,
          title: item.title.trim().slice(0, 500),
          body: item.body.trim().slice(0, 10000),
          sourceType: 'user_input',
          confidence: 1.0,
          status: 'active',
        },
      });
      created++;
    } catch {
      errors.push(`Failed to create: ${item.title}`);
    }
  }

  audit(userId, 'import', 'memory_items', undefined, {
    created,
    total: items.length,
  });

  return { created, errors };
}
