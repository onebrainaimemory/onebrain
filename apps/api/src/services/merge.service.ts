import { getClient } from '@onebrain/db';
import { normalize } from '../lib/text-normalize.js';
import { isSimilar } from '../lib/similarity.js';
import { audit } from '../lib/audit.js';
import { jsonValue } from '../lib/prisma-json.js';
import type { MergeLogEntry } from '@onebrain/shared';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MergeCandidate {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  sourceType: string;
  confidence: number;
  status: string;
  metadata: Record<string, unknown> | null;
}

export interface DuplicateMatch {
  existingId: string;
  candidateId: string;
  keepId: string;
  archiveId: string;
}

export interface ConflictMatch {
  existingId: string;
  candidateId: string;
}

export interface ConfidenceContext {
  isDuplicate: boolean;
  isConflict: boolean;
  agreementCount: number;
}

export interface MergeResult {
  merged: number;
  archived: number;
  conflicted: number;
  activated: number;
  versionId: string | null;
  log: MergeLogEntry[];
}

// ─────────────────────────────────────────────
// Step 1 — Normalization
// ─────────────────────────────────────────────

export function normalizeMemory<T extends { title: string; body: string }>(item: T): T {
  return {
    ...item,
    title: normalize(item.title),
    body: normalize(item.body),
  };
}

// ─────────────────────────────────────────────
// Step 2 — Duplicate Detection
// ─────────────────────────────────────────────

export function detectDuplicates(
  candidate: MergeCandidate,
  existing: MergeCandidate[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const item of existing) {
    if (item.type !== candidate.type) continue;
    if (item.status === 'archived') continue;

    const titleMatch = isSimilar(candidate.title, item.title, 0.6);
    const bodyMatch = isSimilar(candidate.body, item.body, 0.5);

    if (titleMatch && bodyMatch) {
      const keepHigher = item.confidence >= candidate.confidence;
      matches.push({
        existingId: item.id,
        candidateId: candidate.id,
        keepId: keepHigher ? item.id : candidate.id,
        archiveId: keepHigher ? candidate.id : item.id,
      });
    }
  }

  return matches;
}

// ─────────────────────────────────────────────
// Step 3 — Conflict Detection
// ─────────────────────────────────────────────

export function detectConflicts(
  candidate: MergeCandidate,
  existing: MergeCandidate[],
): ConflictMatch[] {
  const matches: ConflictMatch[] = [];

  for (const item of existing) {
    if (item.type !== candidate.type) continue;
    if (item.status === 'archived') continue;

    // Same topic = similar title
    const sameTopic = isSimilar(candidate.title, item.title, 0.5);
    // Different body = contradictory
    const differentBody = !isSimilar(candidate.body, item.body, 0.5);

    if (sameTopic && differentBody) {
      matches.push({
        existingId: item.id,
        candidateId: candidate.id,
      });
    }
  }

  return matches;
}

// ─────────────────────────────────────────────
// Step 4 — Confidence Handling
// ─────────────────────────────────────────────

const BASE_CONFIDENCE: Record<string, number> = {
  user_confirmed: 1.0,
  user_input: 1.0,
  system_inference: 0.7,
  ai_extraction: 0.6,
};

export function assignBaseConfidence(sourceType: string): number {
  return BASE_CONFIDENCE[sourceType] ?? 0.5;
}

export function applyConfidenceAdjustments(base: number, context: ConfidenceContext): number {
  let adjusted = base;

  if (context.isDuplicate && context.agreementCount > 0) {
    // Multiple sources agree — increase by 0.1 per agreement, max 1.0
    adjusted = Math.min(1.0, adjusted + context.agreementCount * 0.1);
  }

  if (context.isConflict) {
    // Conflict — decrease by 0.2
    adjusted = Math.max(0.1, adjusted - 0.2);
  }

  return Math.round(adjusted * 100) / 100;
}

// ─────────────────────────────────────────────
// Step 5 — Category Priority (sorting)
// ─────────────────────────────────────────────

const SOURCE_PRIORITY: Record<string, number> = {
  user_confirmed: 1,
  user_input: 2,
  ai_extraction: 3,
  system_inference: 4,
};

export function getSourcePriority(sourceType: string): number {
  return SOURCE_PRIORITY[sourceType] ?? 5;
}

// ─────────────────────────────────────────────
// Explainability — Merge Log
// ─────────────────────────────────────────────

export function buildMergeLog(
  duplicates: DuplicateMatch[],
  conflicts: ConflictMatch[],
): MergeLogEntry[] {
  const log: MergeLogEntry[] = [];
  const now = new Date().toISOString();

  for (const dup of duplicates) {
    log.push({
      action: 'archive',
      memoryIds: [dup.existingId, dup.candidateId],
      reason: `Duplicate detected: kept ${dup.keepId}, archived ${dup.archiveId}`,
      timestamp: now,
    });
  }

  for (const conflict of conflicts) {
    log.push({
      action: 'conflict',
      memoryIds: [conflict.existingId, conflict.candidateId],
      reason: 'Conflicting memory detected — both marked as conflicted, not auto-resolved',
      timestamp: now,
    });
  }

  return log;
}

// ─────────────────────────────────────────────
// Main Merge Engine — orchestrates all steps
// ─────────────────────────────────────────────

export async function runMerge(userId: string): Promise<MergeResult> {
  const prisma = getClient();

  // Fetch all candidate memories for this user
  const rawCandidates = await prisma.memoryItem.findMany({
    where: { userId, status: 'candidate' },
    orderBy: { createdAt: 'asc' },
  });

  if (rawCandidates.length === 0) {
    return {
      merged: 0,
      archived: 0,
      conflicted: 0,
      activated: 0,
      versionId: null,
      log: [],
    };
  }

  // Fetch existing active memories
  const rawExisting = await prisma.memoryItem.findMany({
    where: { userId, status: 'active' },
  });

  // Step 1: Normalize all items
  const candidates = rawCandidates.map((c) =>
    normalizeMemory({
      id: c.id,
      userId: c.userId,
      type: c.type,
      title: c.title,
      body: c.body,
      sourceType: c.sourceType,
      confidence: c.confidence,
      status: c.status,
      metadata: c.metadata as Record<string, unknown> | null,
    }),
  );

  const existing = rawExisting.map((e) =>
    normalizeMemory({
      id: e.id,
      userId: e.userId,
      type: e.type,
      title: e.title,
      body: e.body,
      sourceType: e.sourceType,
      confidence: e.confidence,
      status: e.status,
      metadata: e.metadata as Record<string, unknown> | null,
    }),
  );

  const allDuplicates: DuplicateMatch[] = [];
  const allConflicts: ConflictMatch[] = [];
  const processedIds = new Set<string>();

  // Steps 2-3: Check each candidate against existing
  for (const candidate of candidates) {
    const duplicates = detectDuplicates(candidate, existing);
    const conflicts = detectConflicts(candidate, existing);

    // If it's a duplicate, it cannot also be a conflict of the same item
    const conflictIds = new Set(duplicates.map((d) => d.existingId));
    const filteredConflicts = conflicts.filter((c) => !conflictIds.has(c.existingId));

    allDuplicates.push(...duplicates);
    allConflicts.push(...filteredConflicts);

    if (duplicates.length > 0 || filteredConflicts.length > 0) {
      processedIds.add(candidate.id);
    }
  }

  // Steps 4-5: Apply confidence and category priority
  let archivedCount = 0;
  let conflictedCount = 0;
  let activatedCount = 0;

  // Process duplicates — archive the lower-confidence one
  const archiveIds = new Set<string>();
  const keepIds = new Set<string>();

  for (const dup of allDuplicates) {
    archiveIds.add(dup.archiveId);
    keepIds.add(dup.keepId);
  }

  if (archiveIds.size > 0) {
    await prisma.memoryItem.updateMany({
      where: { id: { in: [...archiveIds] }, userId },
      data: { status: 'archived' },
    });
    archivedCount = archiveIds.size;
  }

  // Process conflicts — mark both as conflicted
  const conflictIds = new Set<string>();
  for (const conflict of allConflicts) {
    conflictIds.add(conflict.existingId);
    conflictIds.add(conflict.candidateId);
  }

  // Remove any IDs that were already archived
  for (const id of archiveIds) {
    conflictIds.delete(id);
  }

  if (conflictIds.size > 0) {
    await prisma.memoryItem.updateMany({
      where: { id: { in: [...conflictIds] }, userId },
      data: { status: 'conflicted' },
    });
    conflictedCount = conflictIds.size;

    // Apply confidence decrease for conflicted items (parallelized)
    const conflictUpdates = [...conflictIds]
      .map((id) => {
        const item = candidates.find((c) => c.id === id) ?? existing.find((e) => e.id === id);
        if (!item) return null;
        const adjusted = applyConfidenceAdjustments(item.confidence, {
          isDuplicate: false,
          isConflict: true,
          agreementCount: 0,
        });
        return prisma.memoryItem.update({
          where: { id },
          data: { confidence: adjusted },
        });
      })
      .filter(Boolean);
    await Promise.all(conflictUpdates);
  }

  // Boost confidence for kept duplicates (parallelized)
  const boostUpdates = [...keepIds]
    .filter((keepId) => !conflictIds.has(keepId))
    .map((keepId) => {
      const item = existing.find((e) => e.id === keepId) ?? candidates.find((c) => c.id === keepId);
      if (!item) return null;
      const agreementCount = allDuplicates.filter((d) => d.keepId === keepId).length;
      const adjusted = applyConfidenceAdjustments(item.confidence, {
        isDuplicate: true,
        isConflict: false,
        agreementCount,
      });
      return prisma.memoryItem.update({
        where: { id: keepId },
        data: { confidence: adjusted },
      });
    })
    .filter(Boolean);
  await Promise.all(boostUpdates);

  // Step 6: Activate remaining candidates (no duplicates, no conflicts)
  const activateIds = candidates
    .filter((c) => !archiveIds.has(c.id) && !conflictIds.has(c.id))
    .map((c) => c.id);

  if (activateIds.length > 0) {
    await prisma.memoryItem.updateMany({
      where: { id: { in: activateIds }, userId },
      data: { status: 'active' },
    });
    activatedCount = activateIds.length;
  }

  // Build explainability log
  const mergeLog = buildMergeLog(allDuplicates, allConflicts);

  // Add activation entries to log
  for (const id of activateIds) {
    mergeLog.push({
      action: 'merge',
      memoryIds: [id],
      reason: 'New memory activated — no duplicates or conflicts found',
      timestamp: new Date().toISOString(),
    });
  }

  // Step 7: Create brain version snapshot
  let versionId: string | null = null;

  const latestVersion = await prisma.brainVersion.findFirst({
    where: { userId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const activeMemories = await prisma.memoryItem.findMany({
    where: { userId, status: 'active' },
    select: { id: true, type: true, title: true, confidence: true },
  });

  const brainVersion = await prisma.brainVersion.create({
    data: {
      userId,
      version: nextVersion,
      snapshot: jsonValue({
        memoriesCount: activeMemories.length,
        memories: activeMemories.map((m) => ({
          id: m.id,
          type: m.type,
          title: m.title,
          confidence: m.confidence,
        })),
        mergedAt: new Date().toISOString(),
      }),
      mergeLog: jsonValue(mergeLog as unknown as Record<string, unknown>),
    },
  });

  versionId = brainVersion.id;

  audit(userId, 'merge', 'brain', versionId, {
    version: nextVersion,
    merged: allDuplicates.length,
    archived: archivedCount,
    conflicted: conflictedCount,
    activated: activatedCount,
  });

  return {
    merged: allDuplicates.length,
    archived: archivedCount,
    conflicted: conflictedCount,
    activated: activatedCount,
    versionId,
    log: mergeLog,
  };
}

/**
 * Get merge history (brain versions) for a user.
 */
export async function getMergeHistory(
  userId: string,
  options: { cursor?: string; limit: number },
): Promise<{
  items: {
    id: string;
    version: number;
    snapshot: Record<string, unknown>;
    mergeLog: MergeLogEntry[];
    createdAt: string;
  }[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}> {
  const prisma = getClient();
  const { cursor, limit } = options;

  const [items, total] = await Promise.all([
    prisma.brainVersion.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { version: 'desc' },
    }),
    prisma.brainVersion.count({ where: { userId } }),
  ]);

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1]!.id : null;

  audit(userId, 'list', 'brain_versions', undefined, {
    count: resultItems.length,
  });

  return {
    items: resultItems.map((v) => ({
      id: v.id,
      version: v.version,
      snapshot: v.snapshot as Record<string, unknown>,
      mergeLog: v.mergeLog as unknown as MergeLogEntry[],
      createdAt: v.createdAt.toISOString(),
    })),
    cursor: nextCursor,
    hasMore,
    total,
  };
}

/**
 * Rollback to a specific brain version by restoring the snapshot.
 * 1. Get the BrainVersion snapshot
 * 2. Delete all current active memories for user
 * 3. Re-create memories from snapshot
 * 4. Create a new BrainVersion recording the rollback
 */
export async function rollbackToVersion(
  userId: string,
  targetVersion: number,
): Promise<{
  success: boolean;
  versionId: string | null;
  restoredCount: number;
  skippedCount: number;
  error?: string;
}> {
  const prisma = getClient();

  const brainVersion = await prisma.brainVersion.findFirst({
    where: { userId, version: targetVersion },
  });

  if (!brainVersion) {
    return {
      success: false,
      versionId: null,
      restoredCount: 0,
      skippedCount: 0,
      error: 'Version not found',
    };
  }

  const snapshot = brainVersion.snapshot as Record<string, unknown>;
  const memories = (snapshot['memories'] ?? []) as Array<{
    id: string;
    type: string;
    title: string;
    confidence: number;
  }>;

  // Fetch full memory data for the snapshot memory IDs
  const memoryIds = memories.map((m) => m.id);
  const existingMemories = await prisma.memoryItem.findMany({
    where: { id: { in: memoryIds }, userId },
  });

  const existingMap = new Map(existingMemories.map((m) => [m.id, m]));

  // Archive all current active memories
  await prisma.memoryItem.updateMany({
    where: { userId, status: 'active' },
    data: { status: 'archived' },
  });

  // Restore: re-activate memories from snapshot (parallelized)
  const restorable = memories.filter((mem) => existingMap.has(mem.id));
  const skippedIds = memories.filter((mem) => !existingMap.has(mem.id)).map((mem) => mem.id);

  const restoreOps = restorable.map((mem) =>
    prisma.memoryItem.update({
      where: { id: mem.id },
      data: { status: 'active', confidence: mem.confidence },
    }),
  );
  await Promise.all(restoreOps);
  const restoredCount = restoreOps.length;

  // Create new brain version recording the rollback
  const latestVersion = await prisma.brainVersion.findFirst({
    where: { userId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const activeAfter = await prisma.memoryItem.findMany({
    where: { userId, status: 'active' },
    select: { id: true, type: true, title: true, confidence: true },
  });

  const newVersion = await prisma.brainVersion.create({
    data: {
      userId,
      version: nextVersion,
      snapshot: jsonValue({
        memoriesCount: activeAfter.length,
        memories: activeAfter.map((m) => ({
          id: m.id,
          type: m.type,
          title: m.title,
          confidence: m.confidence,
        })),
        mergedAt: new Date().toISOString(),
        rollbackFrom: targetVersion,
      }),
      mergeLog: jsonValue({
        action: 'rollback',
        fromVersion: targetVersion,
        restoredCount,
        skippedCount: skippedIds.length,
        skippedIds: skippedIds.length > 0 ? skippedIds : undefined,
        timestamp: new Date().toISOString(),
      } as unknown as Record<string, unknown>),
    },
  });

  audit(userId, 'rollback', 'brain', newVersion.id, {
    fromVersion: targetVersion,
    toVersion: nextVersion,
    restoredCount,
  });

  return {
    success: true,
    versionId: newVersion.id,
    restoredCount,
    skippedCount: skippedIds.length,
  };
}
