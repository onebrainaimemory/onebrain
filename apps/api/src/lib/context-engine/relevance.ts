import type { RawMemoryItem, RawEntity, RawProject, ScoredItem } from './types.js';

// ─────────────────────────────────────────────
// Source type priority weights (deterministic)
// ─────────────────────────────────────────────

const SOURCE_WEIGHTS: Record<string, number> = {
  user_confirmed: 1.0,
  user_input: 0.9,
  system_inference: 0.6,
  ai_extraction: 0.5,
};

// ─────────────────────────────────────────────
// Recency decay: items older than 90 days decay
// ─────────────────────────────────────────────

function recencyScore(dateStr: string): number {
  const ageMs = Date.now() - new Date(dateStr).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) return 1.0;
  if (ageDays <= 30) return 0.8;
  if (ageDays <= 90) return 0.6;
  if (ageDays <= 365) return 0.3;
  return 0.1;
}

// ─────────────────────────────────────────────
// Memory scoring
// ─────────────────────────────────────────────

export function scoreMemory(item: RawMemoryItem): ScoredItem<RawMemoryItem> {
  const reasons: string[] = [];

  // Source weight (35%)
  const sourceWeight = SOURCE_WEIGHTS[item.sourceType] ?? 0.5;
  reasons.push(`source:${item.sourceType}=${sourceWeight}`);

  // Confidence (35%)
  const confidenceWeight = item.confidence;
  reasons.push(`confidence=${confidenceWeight}`);

  // Recency (30%)
  const recency = recencyScore(item.updatedAt);
  reasons.push(`recency=${recency}`);

  const score = Math.min(1.0, sourceWeight * 0.35 + confidenceWeight * 0.35 + recency * 0.3);

  return {
    item,
    score: Math.round(score * 1000) / 1000,
    reasons,
  };
}

// ─────────────────────────────────────────────
// Entity scoring
// ─────────────────────────────────────────────

export function scoreEntity(entity: RawEntity): ScoredItem<RawEntity> {
  const reasons: string[] = [];

  // Link count weight (50%) — more connected = more important
  const linkScore = Math.min(1.0, entity.linkCount / 10);
  reasons.push(`links=${entity.linkCount},score=${linkScore}`);

  // Recency (50%)
  const recency = recencyScore(entity.updatedAt);
  reasons.push(`recency=${recency}`);

  const score = linkScore * 0.5 + recency * 0.5;

  return {
    item: entity,
    score: Math.round(score * 1000) / 1000,
    reasons,
  };
}

// ─────────────────────────────────────────────
// Project scoring
// ─────────────────────────────────────────────

const STATUS_WEIGHTS: Record<string, number> = {
  active: 1.0,
  completed: 0.4,
  archived: 0.2,
};

export function scoreProject(project: RawProject): ScoredItem<RawProject> {
  const reasons: string[] = [];

  // Status weight (40%)
  const statusWeight = STATUS_WEIGHTS[project.status] ?? 0.3;
  reasons.push(`status:${project.status}=${statusWeight}`);

  // Memory link count (30%)
  const linkScore = Math.min(1.0, project.memoryLinkCount / 10);
  reasons.push(`memoryLinks=${project.memoryLinkCount},score=${linkScore}`);

  // Recency (30%)
  const recency = recencyScore(project.updatedAt);
  reasons.push(`recency=${recency}`);

  const score = statusWeight * 0.4 + linkScore * 0.3 + recency * 0.3;

  return {
    item: project,
    score: Math.round(score * 1000) / 1000,
    reasons,
  };
}
