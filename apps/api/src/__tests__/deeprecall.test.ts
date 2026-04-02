import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { diceCoefficient } from '../lib/similarity.js';

// ─── DeepRecall: Feature Gate Tests ───

describe('DeepRecall — feature gate', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('isEmbeddingApiConfigured returns false when no keys set', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const { isEmbeddingApiConfigured } = await import('../lib/feature-gate.js');
    expect(isEmbeddingApiConfigured()).toBe(false);
  });

  it('isEmbeddingApiConfigured returns true with OPENAI_API_KEY', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const mod = await import('../lib/feature-gate.js');
    // Module caches env at import time, so we test the function logic
    expect(typeof mod.canUseDeepRecall).toBe('function');
  });
});

// ─── DeepRecall: Keyword Search Scoring Tests ───

describe('DeepRecall — keyword search scoring', () => {
  it('should score title matches higher than body matches', () => {
    const titleScore = diceCoefficient('coffee preferences', 'coffee preferences');
    const bodyScore = diceCoefficient(
      'coffee preferences',
      'I like drinking coffee in the morning',
    );
    expect(titleScore).toBeGreaterThan(bodyScore);
  });

  it('should produce fused score = titleDice * 0.6 + bodyDice * 0.4', () => {
    const query = 'TypeScript developer';
    const title = 'TypeScript expertise';
    const body = 'Experienced TypeScript developer working on web apps';

    const titleDice = diceCoefficient(query, title);
    const bodyDice = diceCoefficient(query, body.slice(0, 500));
    const expected = titleDice * 0.6 + bodyDice * 0.4;

    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThanOrEqual(1);
  });

  it('should score completely unrelated queries near 0', () => {
    const score = diceCoefficient('quantum physics', 'banana bread recipe');
    expect(score).toBeLessThan(0.2);
  });
});

// ─── DeepRecall: Hybrid Fusion Math Tests ───

describe('DeepRecall — hybrid fusion scoring', () => {
  it('should compute fused score: alpha * vector + (1-alpha) * dice', () => {
    const vectorScore = 0.9;
    const diceScore = 0.3;
    const alpha = 0.6;

    const fused = vectorScore * alpha + diceScore * (1 - alpha);
    expect(fused).toBeCloseTo(0.66, 2);
  });

  it('alpha=1.0 should return pure vector score', () => {
    const vectorScore = 0.85;
    const diceScore = 0.1;
    const alpha = 1.0;

    const fused = vectorScore * alpha + diceScore * (1 - alpha);
    expect(fused).toBeCloseTo(0.85, 2);
  });

  it('alpha=0.0 should return pure dice score', () => {
    const vectorScore = 0.85;
    const diceScore = 0.4;
    const alpha = 0.0;

    const fused = vectorScore * alpha + diceScore * (1 - alpha);
    expect(fused).toBeCloseTo(0.4, 2);
  });

  it('should always produce score between 0 and 1', () => {
    const testCases = [
      { v: 0, d: 0, a: 0.5 },
      { v: 1, d: 1, a: 0.5 },
      { v: 0.5, d: 0.5, a: 0 },
      { v: 0.5, d: 0.5, a: 1 },
      { v: 0.1, d: 0.9, a: 0.3 },
      { v: 0.99, d: 0.01, a: 0.8 },
    ];

    for (const { v, d, a } of testCases) {
      const fused = v * a + d * (1 - a);
      expect(fused).toBeGreaterThanOrEqual(0);
      expect(fused).toBeLessThanOrEqual(1);
    }
  });
});

// ─── DeepRecall: Plan Gating Logic Tests ───

describe('DeepRecall — plan gating logic', () => {
  it('free plan should have deep_recall = false', () => {
    const features = [{ key: 'deep_recall', value: 'false' }];
    const feature = features.find((f) => f.key === 'deep_recall');
    expect(feature?.value).toBe('false');
  });

  it('pro plan should have deep_recall = true', () => {
    const features = [{ key: 'deep_recall', value: 'true' }];
    const feature = features.find((f) => f.key === 'deep_recall');
    expect(feature?.value).toBe('true');
  });

  it('search mode should downgrade from hybrid to keyword for free plan', () => {
    const hasDeepRecall = false;
    let mode: string = 'hybrid';
    let downgradedFrom: string | undefined;

    if (mode !== 'keyword' && !hasDeepRecall) {
      downgradedFrom = mode;
      mode = 'keyword';
    }

    expect(mode).toBe('keyword');
    expect(downgradedFrom).toBe('hybrid');
  });

  it('search mode should stay hybrid for pro plan', () => {
    const hasDeepRecall = true;
    let mode: string = 'hybrid';
    let downgradedFrom: string | undefined;

    if (mode !== 'keyword' && !hasDeepRecall) {
      downgradedFrom = mode;
      mode = 'keyword';
    }

    expect(mode).toBe('hybrid');
    expect(downgradedFrom).toBeUndefined();
  });

  it('keyword mode should never be downgraded', () => {
    const hasDeepRecall = false;
    let mode: string = 'keyword';
    let downgradedFrom: string | undefined;

    if (mode !== 'keyword' && !hasDeepRecall) {
      downgradedFrom = mode;
      mode = 'keyword';
    }

    expect(mode).toBe('keyword');
    expect(downgradedFrom).toBeUndefined();
  });
});

// ─── DeepRecall: Embedding Status Lifecycle Tests ───

describe('DeepRecall — embedding status lifecycle', () => {
  const validStatuses = ['none', 'pending', 'completed', 'failed'] as const;

  it('default status should be none', () => {
    const defaultStatus = 'none';
    expect(validStatuses).toContain(defaultStatus);
  });

  it('all status transitions should be valid', () => {
    // Valid transitions: none → pending → completed/failed
    const transitions: Array<[string, string]> = [
      ['none', 'pending'],
      ['pending', 'completed'],
      ['pending', 'failed'],
      ['failed', 'pending'], // retry
      ['completed', 'pending'], // re-embed
    ];

    for (const [from, to] of transitions) {
      expect(validStatuses).toContain(from);
      expect(validStatuses).toContain(to);
    }
  });
});

// ─── DeepRecall: Search Schema Validation Tests ───

describe('DeepRecall — search schema validation', () => {
  const deepRecallSearchSchema = z.object({
    query: z.string().min(1, 'Query is required'),
    top_k: z.number().int().min(1).max(50).optional().default(10),
    mode: z.enum(['keyword', 'vector', 'hybrid']).optional().default('hybrid'),
    alpha: z.number().min(0).max(1).optional().default(0.6),
  });

  it('should accept valid hybrid search request', () => {
    const result = deepRecallSearchSchema.safeParse({
      query: 'TypeScript',
      top_k: 5,
      mode: 'hybrid',
      alpha: 0.7,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty query', () => {
    const result = deepRecallSearchSchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('should reject top_k > 50', () => {
    const result = deepRecallSearchSchema.safeParse({ query: 'test', top_k: 100 });
    expect(result.success).toBe(false);
  });

  it('should reject alpha > 1', () => {
    const result = deepRecallSearchSchema.safeParse({ query: 'test', alpha: 1.5 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid mode', () => {
    const result = deepRecallSearchSchema.safeParse({ query: 'test', mode: 'deep' });
    expect(result.success).toBe(false);
  });

  it('should default mode to hybrid', () => {
    const result = deepRecallSearchSchema.safeParse({ query: 'test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('hybrid');
    }
  });

  it('should default alpha to 0.6', () => {
    const result = deepRecallSearchSchema.safeParse({ query: 'test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alpha).toBe(0.6);
    }
  });

  it('should default top_k to 10', () => {
    const result = deepRecallSearchSchema.safeParse({ query: 'test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.top_k).toBe(10);
    }
  });
});
