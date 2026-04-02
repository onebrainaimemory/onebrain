import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  calculateSkillScore,
  applyDecay,
  applyBoost,
  shouldArchive,
  shouldPromote,
} from '../services/skill.service.js';

// ─── SkillForge: Scoring Engine Tests ───

describe('SkillForge — scoring engine', () => {
  const baseSkill = {
    confidenceScore: 0.7,
    usageCount: 5,
    decayScore: 0.9,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    lastUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  };

  it('should produce score between 0 and 1', () => {
    const score = calculateSkillScore(baseSkill);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should give higher score to frequently used skills', () => {
    const lowUsage = calculateSkillScore({ ...baseSkill, usageCount: 1 });
    const highUsage = calculateSkillScore({ ...baseSkill, usageCount: 20 });
    expect(highUsage).toBeGreaterThan(lowUsage);
  });

  it('should give higher score to recently used skills', () => {
    const oldUsage = calculateSkillScore({
      ...baseSkill,
      lastUsedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });
    const recentUsage = calculateSkillScore({
      ...baseSkill,
      lastUsedAt: new Date(),
    });
    expect(recentUsage).toBeGreaterThan(oldUsage);
  });

  it('should give higher score to confident skills', () => {
    const lowConf = calculateSkillScore({ ...baseSkill, confidenceScore: 0.3 });
    const highConf = calculateSkillScore({ ...baseSkill, confidenceScore: 0.95 });
    expect(highConf).toBeGreaterThan(lowConf);
  });

  it('should handle skill with no usage', () => {
    const score = calculateSkillScore({
      ...baseSkill,
      usageCount: 0,
      lastUsedAt: null,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should handle very new skill (created today)', () => {
    const score = calculateSkillScore({
      ...baseSkill,
      createdAt: new Date(),
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── SkillForge: Decay Tests ───

describe('SkillForge — decay', () => {
  it('should decrease decay by 0.05 per application', () => {
    expect(applyDecay(1.0)).toBe(0.95);
    expect(applyDecay(0.5)).toBe(0.45);
  });

  it('should not go below 0', () => {
    expect(applyDecay(0.03)).toBe(0);
    expect(applyDecay(0)).toBe(0);
  });

  it('should handle float precision correctly', () => {
    const result = applyDecay(0.95);
    expect(result).toBe(0.9);
  });
});

// ─── SkillForge: Boost Tests ───

describe('SkillForge — boost', () => {
  it('should boost by 0.05 on applied event', () => {
    expect(applyBoost(0.5, 'applied')).toBe(0.55);
  });

  it('should boost by 0.01 on referenced event', () => {
    expect(applyBoost(0.5, 'referenced')).toBe(0.51);
  });

  it('should not boost on served event', () => {
    expect(applyBoost(0.5, 'served')).toBe(0.5);
  });

  it('should cap at 0.95', () => {
    expect(applyBoost(0.93, 'applied')).toBe(0.95);
    expect(applyBoost(0.95, 'applied')).toBe(0.95);
  });
});

// ─── SkillForge: Archival/Promotion Logic Tests ───

describe('SkillForge — lifecycle decisions', () => {
  describe('shouldArchive', () => {
    it('should archive stale, unused, decayed skill', () => {
      expect(
        shouldArchive({
          decayScore: 0.1,
          usageCount: 1,
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        }),
      ).toBe(true);
    });

    it('should NOT archive recently created skill', () => {
      expect(
        shouldArchive({
          decayScore: 0.1,
          usageCount: 1,
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        }),
      ).toBe(false);
    });

    it('should NOT archive frequently used skill', () => {
      expect(
        shouldArchive({
          decayScore: 0.1,
          usageCount: 10,
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        }),
      ).toBe(false);
    });

    it('should NOT archive skill with healthy decay', () => {
      expect(
        shouldArchive({
          decayScore: 0.5,
          usageCount: 0,
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        }),
      ).toBe(false);
    });
  });

  describe('shouldPromote', () => {
    it('should promote confident, used candidate', () => {
      expect(
        shouldPromote({
          status: 'candidate',
          confidenceScore: 0.85,
          usageCount: 7,
        }),
      ).toBe(true);
    });

    it('should NOT promote already active skill', () => {
      expect(
        shouldPromote({
          status: 'active',
          confidenceScore: 0.85,
          usageCount: 7,
        }),
      ).toBe(false);
    });

    it('should NOT promote low-confidence candidate', () => {
      expect(
        shouldPromote({
          status: 'candidate',
          confidenceScore: 0.6,
          usageCount: 10,
        }),
      ).toBe(false);
    });

    it('should NOT promote low-usage candidate', () => {
      expect(
        shouldPromote({
          status: 'candidate',
          confidenceScore: 0.9,
          usageCount: 2,
        }),
      ).toBe(false);
    });
  });
});

// ─── SkillForge: Schema Validation Tests ───

describe('SkillForge — schema validation', () => {
  const createSkillSchema = z.object({
    title: z.string().min(1).max(500),
    body: z.string().min(1).max(10000),
    triggerConditions: z
      .array(
        z.object({
          type: z.string().min(1),
          pattern: z.string().min(1),
          description: z.string().optional(),
        }),
      )
      .max(10)
      .optional()
      .default([]),
    verificationSteps: z
      .array(
        z.object({
          order: z.number().int().min(1),
          instruction: z.string().min(1),
          expectedOutcome: z.string().optional(),
        }),
      )
      .max(10)
      .optional()
      .default([]),
    confidenceScore: z.number().min(0).max(1).optional().default(0.5),
  });

  it('should accept valid skill creation', () => {
    const result = createSkillSchema.safeParse({
      title: 'Debugging Promise rejections',
      body: 'When encountering unhandled promise rejections, check the async call chain...',
      triggerConditions: [{ type: 'error', pattern: 'UnhandledPromiseRejection' }],
      confidenceScore: 0.75,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty title', () => {
    const result = createSkillSchema.safeParse({ title: '', body: 'some body' });
    expect(result.success).toBe(false);
  });

  it('should reject too many trigger conditions', () => {
    const conditions = Array.from({ length: 11 }, (_, i) => ({
      type: 'test',
      pattern: `pattern-${i}`,
    }));
    const result = createSkillSchema.safeParse({
      title: 'Test',
      body: 'Body',
      triggerConditions: conditions,
    });
    expect(result.success).toBe(false);
  });

  it('should default confidenceScore to 0.5', () => {
    const result = createSkillSchema.safeParse({ title: 'Test', body: 'Body' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidenceScore).toBe(0.5);
    }
  });
});
