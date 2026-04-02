import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@onebrain/db', () => ({
  getClient: () => ({
    memoryItem: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: '1',
          title: 'test',
          body: 'test body',
          type: 'fact',
          confidence: 1.0,
          userId: 'u1',
        },
      ]),
      findFirst: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    usageEvent: {
      groupBy: vi
        .fn()
        .mockResolvedValue([{ type: 'api_call', _count: { id: 5 }, _sum: { tokensUsed: 100 } }]),
      count: vi.fn().mockResolvedValue(5),
      create: vi.fn().mockResolvedValue({
        id: 'ue1',
        userId: 'u1',
        type: 'api_call',
        tokensUsed: 0,
        createdAt: new Date(),
      }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]), // kept for legacy compat in mocks
    plan: { findUnique: vi.fn() },
    userPlan: { findFirst: vi.fn() },
  }),
}));

describe('Embedding Service', () => {
  beforeEach(() => {
    process.env['OPENAI_API_KEY'] = '';
    vi.resetModules();
  });

  it('isEmbeddingEnabled returns false without API key', async () => {
    const { isEmbeddingEnabled } = await import('../services/embedding.service.js');
    expect(isEmbeddingEnabled()).toBe(false);
  });

  it('isEmbeddingEnabled returns true with API key', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-test';
    const { isEmbeddingEnabled } = await import('../services/embedding.service.js');
    expect(isEmbeddingEnabled()).toBe(true);
  });

  it('semanticSearch returns empty array when disabled', async () => {
    const { semanticSearch } = await import('../services/embedding.service.js');
    const results = await semanticSearch('u1', 'test query');
    expect(results).toEqual([]);
  });

  it('hybridSearch returns text results when embedding disabled', async () => {
    const { hybridSearch } = await import('../services/embedding.service.js');
    const results = await hybridSearch('u1', 'test');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.title).toBe('test');
  });
});

describe('Consolidation Service', () => {
  it('consolidateMemories returns empty groups for unique items', async () => {
    const { consolidateMemories } = await import('../services/consolidation.service.js');
    const result = await consolidateMemories('u1', { dryRun: true });
    expect(result.merged).toBe(0);
    expect(result.groups).toEqual([]);
  });

  it('expireMemories returns count', async () => {
    const { expireMemories } = await import('../services/consolidation.service.js');
    const count = await expireMemories('u1', 365);
    expect(typeof count).toBe('number');
  });
});

describe('Usage Service', () => {
  it('getUsageSummary returns aggregated stats', async () => {
    const { getUsageSummary } = await import('../services/usage.service.js');
    const summary = await getUsageSummary('u1', 'monthly');
    expect(summary).toHaveLength(1);
    expect(summary[0]!.count).toBe(5);
  });

  it('getUsageCount returns number', async () => {
    const { getUsageCount } = await import('../services/usage.service.js');
    const count = await getUsageCount('u1', 'api_call', 'daily');
    expect(typeof count).toBe('number');
  });
});

describe('Env Validation', () => {
  it('validates required env vars in production', async () => {
    process.env['JWT_SECRET'] = 'test-secret-key-at-least-32-chars-long!!';
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
    const mod = await import('../lib/env-validation.js');
    const report = mod.validateEnv(true);
    expect(report.valid).toBe(true);
  });
});

describe('Prometheus Metrics', () => {
  it('generates prometheus format text', async () => {
    const { getPrometheusMetrics } = await import('../lib/prometheus.js');
    const output = await getPrometheusMetrics();
    expect(output).toContain('onebrain_request_count');
    expect(output).toContain('onebrain_request_duration_seconds');
    expect(output).toContain('# TYPE');
  });
});
