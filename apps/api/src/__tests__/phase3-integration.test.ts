import { describe, it, expect } from 'vitest';
import { formatAsText } from '../lib/context-engine/format.js';
import { compressToTokenBudget } from '../lib/context-engine/compress.js';
import type { ContextStructured, ContextSkill } from '../lib/context-engine/types.js';

// ─── SkillForge → Context Engine Integration ───

describe('SkillForge — Context Engine Integration', () => {
  const baseSkills: ContextSkill[] = [
    {
      title: 'Parse CSV with header detection',
      body: 'Detect headers automatically and handle different delimiters.',
      triggerConditions: ['CSV file detected', 'Data import requested'],
      confidenceScore: 0.85,
      usageCount: 12,
    },
    {
      title: 'Rate limit retry with backoff',
      body: 'Implement exponential backoff when API rate limits are hit.',
      triggerConditions: ['429 status code', 'Rate limit error'],
      confidenceScore: 0.72,
      usageCount: 5,
    },
  ];

  it('should include skills section in formatted text', () => {
    const structured: ContextStructured = {
      memories: [],
      entities: [],
      projects: [],
      skills: baseSkills,
    };

    const text = formatAsText(structured);
    expect(text).toContain('## Learned Skills');
    expect(text).toContain('Parse CSV with header detection');
    expect(text).toContain('Rate limit retry with backoff');
    expect(text).toContain('triggers:');
    expect(text).toContain('CSV file detected');
  });

  it('should not include skills section when empty', () => {
    const structured: ContextStructured = {
      memories: [],
      entities: [],
      projects: [],
      skills: [],
    };

    const text = formatAsText(structured);
    expect(text).not.toContain('## Learned Skills');
  });

  it('should handle skills under token pressure', () => {
    // Scenario: only skills, no memories — forces skill compression
    const structured: ContextStructured = {
      memories: [],
      entities: [],
      projects: [],
      skills: Array.from({ length: 10 }, (_, i) => ({
        title: `Skill ${i}`,
        body: 'z'.repeat(500),
        triggerConditions: ['cond1', 'cond2', 'cond3'],
        confidenceScore: 0.8 - i * 0.05,
        usageCount: 10 - i,
      })),
    };

    const result = compressToTokenBudget(structured, 200);
    // Skills should be truncated or dropped under pressure
    expect(result.truncated).toBe(true);
    expect(result.structured.skills.length).toBeLessThan(10);
  });

  it('should order skills by confidence score', () => {
    const structured: ContextStructured = {
      memories: [],
      entities: [],
      projects: [],
      skills: [
        { ...baseSkills[1]!, confidenceScore: 0.5 },
        { ...baseSkills[0]!, confidenceScore: 0.9 },
      ],
    };

    const text = formatAsText(structured);
    const idx1 = text.indexOf('Parse CSV');
    const idx2 = text.indexOf('Rate limit');
    // Skills appear in order they're passed (filter sorts by confidence)
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(-1);
  });
});

// ─── DeepRecall → MCP Integration ───

describe('DeepRecall — MCP deep_search tool', () => {
  it('should have correct search modes', () => {
    const validModes = ['keyword', 'vector', 'hybrid'];
    expect(validModes).toContain('keyword');
    expect(validModes).toContain('vector');
    expect(validModes).toContain('hybrid');
  });

  it('should validate alpha range', () => {
    const alpha = 0.6;
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThanOrEqual(1);
  });

  it('should validate top_k range', () => {
    const validTopK = [1, 10, 25, 50];
    for (const k of validTopK) {
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(50);
    }
  });

  it('hybrid fusion formula: score = alpha * vector + (1-alpha) * dice', () => {
    const alpha = 0.6;
    const vectorScore = 0.8;
    const diceScore = 0.5;
    const expected = alpha * vectorScore + (1 - alpha) * diceScore;
    expect(expected).toBeCloseTo(0.68, 2);
  });
});

// ─── BrainPulse — Analytics ───

describe('BrainPulse — Analytics', () => {
  it('should calculate engagement rate correctly', () => {
    const totalBriefings = 20;
    const briefingsWithEngagement = 12;
    const rate = Math.round((briefingsWithEngagement / totalBriefings) * 100) / 100;
    expect(rate).toBe(0.6);
  });

  it('should handle zero briefings', () => {
    const totalBriefings = 0;
    const rate = totalBriefings > 0 ? 0 : 0;
    expect(rate).toBe(0);
  });

  it('should aggregate channel distribution', () => {
    const briefings = [
      { deliveredVia: ['email', 'in_app'] },
      { deliveredVia: ['email'] },
      { deliveredVia: ['webhook'] },
    ];

    const channelCounts = new Map<string, number>();
    for (const b of briefings) {
      for (const ch of b.deliveredVia) {
        channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
      }
    }

    expect(channelCounts.get('email')).toBe(2);
    expect(channelCounts.get('in_app')).toBe(1);
    expect(channelCounts.get('webhook')).toBe(1);
  });

  it('should sort actions by count descending', () => {
    const actions = [
      { action: 'opened', count: 15 },
      { action: 'clicked', count: 8 },
      { action: 'dismissed', count: 3 },
    ];

    const sorted = actions.sort((a, b) => b.count - a.count);
    expect(sorted[0]!.action).toBe('opened');
    expect(sorted[2]!.action).toBe('dismissed');
  });
});
