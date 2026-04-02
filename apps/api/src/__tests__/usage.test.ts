import { describe, it, expect, vi } from 'vitest';

// Mock the DB client before importing service
vi.mock('@onebrain/db', () => ({
  getClient: vi.fn(() => ({
    usageEvent: {
      create: vi.fn(({ data }) =>
        Promise.resolve({
          id: 'evt-1',
          userId: data.userId,
          type: data.type,
          tokensUsed: data.tokensUsed ?? 0,
          createdAt: new Date(),
        }),
      ),
      count: vi.fn(() => Promise.resolve(5)),
      groupBy: vi.fn(() =>
        Promise.resolve([
          { type: 'api_call', _count: { id: 3 }, _sum: { tokensUsed: 1500 } },
          { type: 'memory_create', _count: { id: 2 }, _sum: { tokensUsed: 200 } },
        ]),
      ),
    },
  })),
}));

vi.mock('../services/plan.service.js', () => ({
  getPeriodStart: vi.fn(() => new Date('2025-01-01')),
}));

vi.mock('../lib/prisma-json.js', () => ({
  nullableJson: vi.fn((v) => v),
}));

import { trackUsage, getUsageCount, getUsageSummary } from '../services/usage.service.js';

describe('usage service', () => {
  describe('trackUsage', () => {
    it('should create a usage event with correct fields', async () => {
      const result = await trackUsage('user-1', 'api_call', 500, { endpoint: '/memories' });
      expect(result.userId).toBe('user-1');
      expect(result.type).toBe('api_call');
      expect(result.tokensUsed).toBe(500);
    });

    it('should default tokensUsed to 0', async () => {
      const result = await trackUsage('user-1', 'login');
      expect(result.tokensUsed).toBe(0);
    });

    it('should work without metadata', async () => {
      const result = await trackUsage('user-2', 'page_view');
      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
    });
  });

  describe('getUsageCount', () => {
    it('should return count for a given type and period', async () => {
      const count = await getUsageCount('user-1', 'api_call', 'monthly');
      expect(typeof count).toBe('number');
    });
  });

  describe('getUsageSummary', () => {
    it('should return aggregated stats per type', async () => {
      const summary = await getUsageSummary('user-1', 'monthly');
      expect(Array.isArray(summary)).toBe(true);
      expect(summary.length).toBeGreaterThan(0);
      expect(summary[0]).toHaveProperty('type');
      expect(summary[0]).toHaveProperty('count');
      expect(summary[0]).toHaveProperty('tokensUsed');
    });
  });
});
