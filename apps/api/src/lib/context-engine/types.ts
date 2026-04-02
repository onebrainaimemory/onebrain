// ─────────────────────────────────────────────
// Context Engine Types
// ─────────────────────────────────────────────

export const ContextScope = {
  BRIEF: 'brief',
  ASSISTANT: 'assistant',
  PROJECT: 'project',
  DEEP: 'deep',
} as const;

export type ContextScope = (typeof ContextScope)[keyof typeof ContextScope];

export const VALID_SCOPES = new Set<string>(Object.values(ContextScope));

/**
 * Token budgets per scope.
 * Estimated as ~4 chars per token (conservative).
 */
export const SCOPE_TOKEN_BUDGETS: Record<ContextScope, number> = {
  brief: 500,
  assistant: 2000,
  project: 3000,
  deep: 8000,
};

/**
 * How many items to include per scope.
 */
export const SCOPE_LIMITS: Record<ContextScope, ScopeLimits> = {
  brief: {
    memories: 3,
    entities: 2,
    projects: 1,
    skills: 0,
    includeProfile: true,
    includeStats: false,
  },
  assistant: {
    memories: 10,
    entities: 5,
    projects: 3,
    skills: 5,
    includeProfile: true,
    includeStats: true,
  },
  project: {
    memories: 5,
    entities: 3,
    projects: 5,
    skills: 3,
    includeProfile: false,
    includeStats: true,
  },
  deep: {
    memories: 30,
    entities: 15,
    projects: 10,
    skills: 10,
    includeProfile: true,
    includeStats: true,
  },
};

export interface ScopeLimits {
  memories: number;
  entities: number;
  projects: number;
  skills: number;
  includeProfile: boolean;
  includeStats: boolean;
}

/** Raw memory item from DB (pre-scoring). */
export interface RawMemoryItem {
  id: string;
  type: string;
  title: string;
  body: string;
  sourceType: string;
  confidence: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Raw entity from DB. */
export interface RawEntity {
  id: string;
  name: string;
  type: string;
  description: string | null;
  linkCount: number;
  updatedAt: string;
}

/** Raw project from DB. */
export interface RawProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  memoryLinkCount: number;
  updatedAt: string;
}

/** Profile summary. */
export interface ProfileSummary {
  summary: string | null;
  traits: Record<string, unknown>;
  preferences: Record<string, unknown>;
}

/** Stats block. */
export interface ContextStats {
  totalMemories: number;
  totalEntities: number;
  totalProjects: number;
  latestVersion: number | null;
}

/** Scored item (after relevance scoring). */
export interface ScoredItem<T> {
  item: T;
  score: number;
  reasons: string[];
}

/** Fields exposed per item in context output (redacted). */
export interface ContextMemory {
  type: string;
  title: string;
  body: string;
  confidence: number;
}

export interface ContextEntity {
  name: string;
  type: string;
  description: string | null;
  linkCount: number;
}

export interface ContextProject {
  name: string;
  description: string | null;
  status: string;
}

/** Skill extracted by SkillForge. */
export interface ContextSkill {
  title: string;
  body: string;
  triggerConditions: string[];
  confidenceScore: number;
  usageCount: number;
}

/** Final context output. */
export interface ContextResult {
  scope: ContextScope;
  formatted: string;
  structured: ContextStructured;
  meta: ContextMeta;
}

export interface ContextStructured {
  profile?: {
    summary: string | null;
    traits: Record<string, unknown>;
    preferences: Record<string, unknown>;
  };
  memories: ContextMemory[];
  entities: ContextEntity[];
  projects: ContextProject[];
  skills: ContextSkill[];
  stats?: ContextStats;
}

export interface ContextMeta {
  scope: ContextScope;
  tokenEstimate: number;
  tokensUsed: number;
  memoriesIncluded: number;
  entitiesIncluded: number;
  projectsIncluded: number;
  truncated: boolean;
  identityIncluded: boolean;
}

/**
 * Section trimming priority (lower = higher priority = trimmed last).
 * Identity is NEVER trimmed.
 */
export const SECTION_PRIORITY = {
  identity: 0,
  memories: 1,
  skills: 2,
  entities: 3,
  projects: 4,
  stats: 5,
} as const;
