import { describe, it, expect } from 'vitest';
import { scoreMemory, scoreEntity, scoreProject } from '../lib/context-engine/relevance.js';
import { filterByScope } from '../lib/context-engine/filter.js';
import {
  estimateTokens,
  compressBody,
  compressToTokenBudget,
} from '../lib/context-engine/compress.js';
import { formatAsText, formatAsJson } from '../lib/context-engine/format.js';
import { buildContext } from '../lib/context-engine/builder.js';
import type {
  RawMemoryItem,
  RawEntity,
  RawProject,
  ProfileSummary,
  ContextStats,
  ContextStructured,
} from '../lib/context-engine/types.js';

// ─────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────

function makeMemory(overrides: Partial<RawMemoryItem> = {}): RawMemoryItem {
  return {
    id: 'mem-1',
    type: 'fact',
    title: 'Test memory',
    body: 'This is a test memory body',
    sourceType: 'user_input',
    confidence: 0.9,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeEntity(overrides: Partial<RawEntity> = {}): RawEntity {
  return {
    id: 'ent-1',
    name: 'Acme Corp',
    type: 'organization',
    description: 'A test company',
    linkCount: 3,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProject(overrides: Partial<RawProject> = {}): RawProject {
  return {
    id: 'proj-1',
    name: 'OneBrain',
    description: 'Personal AI memory layer',
    status: 'active',
    memoryLinkCount: 5,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const PROFILE: ProfileSummary = {
  summary: 'Software engineer focused on AI',
  traits: { analytical: true },
  preferences: { language: 'en' },
};

const STATS: ContextStats = {
  totalMemories: 42,
  totalEntities: 10,
  totalProjects: 3,
  latestVersion: 5,
};

// ─────────────────────────────────────────────
// Relevance Scoring
// ─────────────────────────────────────────────

describe('relevance scoring', () => {
  describe('scoreMemory', () => {
    it('should score higher for user_confirmed source', () => {
      const confirmed = scoreMemory(makeMemory({ sourceType: 'user_confirmed' }));
      const extracted = scoreMemory(makeMemory({ sourceType: 'ai_extraction' }));
      expect(confirmed.score).toBeGreaterThan(extracted.score);
    });

    it('should score higher for higher confidence', () => {
      const high = scoreMemory(makeMemory({ confidence: 1.0 }));
      const low = scoreMemory(makeMemory({ confidence: 0.3 }));
      expect(high.score).toBeGreaterThan(low.score);
    });

    it('should score higher for recent items', () => {
      const recent = scoreMemory(
        makeMemory({
          updatedAt: new Date().toISOString(),
        }),
      );
      const old = scoreMemory(
        makeMemory({
          updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      );
      expect(recent.score).toBeGreaterThan(old.score);
    });

    it('should include reasons for scoring', () => {
      const scored = scoreMemory(makeMemory({ confidence: 1.0, sourceType: 'user_input' }));
      expect(scored.reasons.length).toBeGreaterThan(0);
    });

    it('should return score between 0 and 1', () => {
      const scored = scoreMemory(makeMemory());
      expect(scored.score).toBeGreaterThanOrEqual(0);
      expect(scored.score).toBeLessThanOrEqual(1);
    });
  });

  describe('scoreEntity', () => {
    it('should score higher for entities with more links', () => {
      const many = scoreEntity(makeEntity({ linkCount: 10 }));
      const few = scoreEntity(makeEntity({ linkCount: 1 }));
      expect(many.score).toBeGreaterThan(few.score);
    });

    it('should score higher for recently updated entities', () => {
      const recent = scoreEntity(
        makeEntity({
          updatedAt: new Date().toISOString(),
        }),
      );
      const old = scoreEntity(
        makeEntity({
          updatedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      );
      expect(recent.score).toBeGreaterThan(old.score);
    });
  });

  describe('scoreProject', () => {
    it('should score active projects higher than archived', () => {
      const active = scoreProject(makeProject({ status: 'active' }));
      const archived = scoreProject(makeProject({ status: 'archived' }));
      expect(active.score).toBeGreaterThan(archived.score);
    });

    it('should score projects with more memory links higher', () => {
      const many = scoreProject(makeProject({ memoryLinkCount: 20 }));
      const few = scoreProject(makeProject({ memoryLinkCount: 1 }));
      expect(many.score).toBeGreaterThan(few.score);
    });
  });
});

// ─────────────────────────────────────────────
// Filtering
// ─────────────────────────────────────────────

describe('filtering', () => {
  describe('filterByScope', () => {
    const memories = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `mem-${i}`, confidence: 1 - i * 0.04 }),
    );
    const entities = Array.from({ length: 10 }, (_, i) =>
      makeEntity({ id: `ent-${i}`, linkCount: 10 - i }),
    );
    const projects = Array.from({ length: 5 }, (_, i) => makeProject({ id: `proj-${i}` }));

    it('should limit items for brief scope', () => {
      const result = filterByScope('brief', memories, entities, projects, PROFILE, STATS);
      expect(result.memories.length).toBeLessThanOrEqual(3);
      expect(result.entities.length).toBeLessThanOrEqual(2);
      expect(result.projects.length).toBeLessThanOrEqual(1);
      expect(result.profile).toBeDefined();
      expect(result.stats).toBeUndefined();
    });

    it('should include more items for assistant scope', () => {
      const result = filterByScope('assistant', memories, entities, projects, PROFILE, STATS);
      expect(result.memories.length).toBeLessThanOrEqual(10);
      expect(result.entities.length).toBeLessThanOrEqual(5);
      expect(result.profile).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should exclude profile for project scope', () => {
      const result = filterByScope('project', memories, entities, projects, PROFILE, STATS);
      expect(result.profile).toBeUndefined();
      expect(result.stats).toBeDefined();
    });

    it('should include most items for deep scope', () => {
      const result = filterByScope('deep', memories, entities, projects, PROFILE, STATS);
      expect(result.memories.length).toBeLessThanOrEqual(30);
      expect(result.entities.length).toBeLessThanOrEqual(15);
      expect(result.profile).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should sort by relevance score (highest first)', () => {
      const result = filterByScope('assistant', memories, entities, projects, PROFILE, STATS);
      for (let i = 1; i < result.memories.length; i++) {
        expect(result.memories[i - 1]!.confidence).toBeGreaterThanOrEqual(
          result.memories[i]!.confidence,
        );
      }
    });
  });
});

// ─────────────────────────────────────────────
// Compression
// ─────────────────────────────────────────────

describe('compression', () => {
  describe('estimateTokens', () => {
    it('should estimate ~1 token per 4 characters', () => {
      const text = 'a'.repeat(400);
      const estimate = estimateTokens(text);
      expect(estimate).toBe(100);
    });

    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('compressBody', () => {
    it('should truncate body to maxLength', () => {
      const body = 'a'.repeat(500);
      const compressed = compressBody(body, 100);
      expect(compressed.length).toBeLessThanOrEqual(103); // 100 + "..."
    });

    it('should not modify body within limit', () => {
      const body = 'short text';
      expect(compressBody(body, 200)).toBe(body);
    });

    it('should add ellipsis when truncated', () => {
      const body = 'a'.repeat(500);
      const compressed = compressBody(body, 100);
      expect(compressed).toMatch(/\.\.\.$/);
    });
  });

  describe('compressToTokenBudget', () => {
    it('should not truncate if within budget', () => {
      const structured: ContextStructured = {
        memories: [{ type: 'fact', title: 'Short', body: 'Short body', confidence: 1 }],
        entities: [],
        projects: [],
        skills: [],
      };
      const result = compressToTokenBudget(structured, 2000);
      expect(result.truncated).toBe(false);
      expect(result.structured.memories[0]!.body).toBe('Short body');
    });

    it('should truncate bodies when exceeding budget', () => {
      const structured: ContextStructured = {
        memories: Array.from({ length: 20 }, (_, i) => ({
          type: 'fact',
          title: `Memory ${i}`,
          body: 'x'.repeat(500),
          confidence: 1,
        })),
        entities: [],
        projects: [],
        skills: [],
      };
      const result = compressToTokenBudget(structured, 500);
      expect(result.truncated).toBe(true);
      expect(result.tokenEstimate).toBeLessThanOrEqual(550); // some tolerance
    });

    it('should drop lowest-confidence items if still over budget', () => {
      const structured: ContextStructured = {
        memories: Array.from({ length: 50 }, (_, i) => ({
          type: 'fact',
          title: `Memory ${i}`,
          body: 'x'.repeat(200),
          confidence: 1 - i * 0.02,
        })),
        entities: [],
        projects: [],
        skills: [],
      };
      const result = compressToTokenBudget(structured, 500);
      expect(result.structured.memories.length).toBeLessThan(50);
    });
  });
});

// ─────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────

describe('formatting', () => {
  const structured: ContextStructured = {
    profile: {
      summary: 'Software engineer',
      traits: { analytical: true },
      preferences: { theme: 'dark' },
    },
    memories: [
      { type: 'fact', title: 'Works at Acme', body: 'User works at Acme Corp', confidence: 0.9 },
      { type: 'preference', title: 'Likes coffee', body: 'User drinks coffee', confidence: 0.8 },
    ],
    entities: [{ name: 'Acme Corp', type: 'organization', description: 'Employer', linkCount: 5 }],
    projects: [{ name: 'OneBrain', description: 'Memory layer', status: 'active' }],
    skills: [],
    stats: { totalMemories: 42, totalEntities: 10, totalProjects: 3, latestVersion: 5 },
  };

  describe('formatAsText', () => {
    it('should produce a non-empty string', () => {
      const text = formatAsText(structured);
      expect(text.length).toBeGreaterThan(0);
    });

    it('should include profile summary', () => {
      const text = formatAsText(structured);
      expect(text).toContain('Software engineer');
    });

    it('should include memory titles', () => {
      const text = formatAsText(structured);
      expect(text).toContain('Works at Acme');
      expect(text).toContain('Likes coffee');
    });

    it('should include entity names', () => {
      const text = formatAsText(structured);
      expect(text).toContain('Acme Corp');
    });

    it('should include project names', () => {
      const text = formatAsText(structured);
      expect(text).toContain('OneBrain');
    });

    it('should include stats', () => {
      const text = formatAsText(structured);
      expect(text).toContain('42');
    });

    it('should not include IDs or timestamps', () => {
      const text = formatAsText(structured);
      expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // no UUIDs
    });
  });

  describe('formatAsJson', () => {
    it('should return valid JSON string', () => {
      const json = formatAsJson(structured);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should contain all sections', () => {
      const parsed = JSON.parse(formatAsJson(structured));
      expect(parsed.profile).toBeDefined();
      expect(parsed.memories).toBeDefined();
      expect(parsed.entities).toBeDefined();
      expect(parsed.projects).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────
// Builder (integration)
// ─────────────────────────────────────────────

describe('buildContext', () => {
  const memories = Array.from({ length: 15 }, (_, i) =>
    makeMemory({
      id: `mem-${i}`,
      title: `Memory ${i}`,
      body: `Body of memory ${i} with some content`,
      confidence: 1 - i * 0.05,
      sourceType: i % 2 === 0 ? 'user_input' : 'ai_extraction',
    }),
  );
  const entities = [
    makeEntity({ id: 'ent-1', name: 'Alice', linkCount: 5 }),
    makeEntity({ id: 'ent-2', name: 'Bob', linkCount: 2 }),
  ];
  const projects = [makeProject({ id: 'proj-1', name: 'Alpha' })];

  it('should return a complete ContextResult for brief scope', () => {
    const result = buildContext('brief', memories, entities, projects, PROFILE, STATS);
    expect(result.scope).toBe('brief');
    expect(result.formatted.length).toBeGreaterThan(0);
    expect(result.structured.memories.length).toBeLessThanOrEqual(3);
    expect(result.meta.scope).toBe('brief');
    expect(result.meta.tokenEstimate).toBeGreaterThan(0);
  });

  it('should return more data for deep scope', () => {
    const resultBrief = buildContext('brief', memories, entities, projects, PROFILE, STATS);
    const resultDeep = buildContext('deep', memories, entities, projects, PROFILE, STATS);
    expect(resultDeep.structured.memories.length).toBeGreaterThan(
      resultBrief.structured.memories.length,
    );
  });

  it('should respect token budget', () => {
    const result = buildContext('brief', memories, entities, projects, PROFILE, STATS);
    expect(result.meta.tokenEstimate).toBeLessThanOrEqual(600); // budget + tolerance
  });

  it('should not expose IDs in formatted output', () => {
    const result = buildContext('assistant', memories, entities, projects, PROFILE, STATS);
    expect(result.formatted).not.toContain('mem-');
    expect(result.formatted).not.toContain('ent-');
  });

  it('should set truncated flag when content was compressed', () => {
    const largeMemories = Array.from({ length: 50 }, (_, i) =>
      makeMemory({
        id: `mem-${i}`,
        title: `Memory ${i} with a longer title that takes up space`,
        body: 'x'.repeat(2000),
        confidence: 1,
      }),
    );
    // Brief budget is 500 tokens. Even 3 memories with 2000-char bodies need truncation.
    const result = buildContext('brief', largeMemories, entities, projects, PROFILE, STATS);
    expect(result.meta.truncated).toBe(true);
  });

  it('should include metadata counts', () => {
    const result = buildContext('assistant', memories, entities, projects, PROFILE, STATS);
    expect(result.meta.memoriesIncluded).toBeGreaterThan(0);
    expect(result.meta.entitiesIncluded).toBeGreaterThan(0);
    expect(result.meta.projectsIncluded).toBeGreaterThan(0);
  });

  it('should include tokensUsed in metadata', () => {
    const result = buildContext('assistant', memories, entities, projects, PROFILE, STATS);
    expect(result.meta.tokensUsed).toBeGreaterThan(0);
    expect(result.meta.tokensUsed).toBe(result.meta.tokenEstimate);
  });

  it('should always include identity (profile) even under extreme compression', () => {
    const hugeMemories = Array.from({ length: 100 }, (_, i) =>
      makeMemory({
        id: `mem-${i}`,
        title: `Memory ${i}`,
        body: 'x'.repeat(5000),
        confidence: 1,
      }),
    );
    // Brief has tiny budget — everything gets compressed, but profile stays
    const result = buildContext('brief', hugeMemories, entities, projects, PROFILE, STATS);
    expect(result.meta.identityIncluded).toBe(true);
    expect(result.structured.profile).toBeDefined();
    expect(result.structured.profile?.summary).toBe('Software engineer focused on AI');
  });

  it('should track identityIncluded as false when scope excludes profile', () => {
    // Project scope excludes profile
    const result = buildContext('project', memories, entities, projects, PROFILE, STATS);
    expect(result.meta.identityIncluded).toBe(false);
  });
});
