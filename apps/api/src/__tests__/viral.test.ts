import { describe, it, expect } from 'vitest';
import {
  generateReferralCode,
  generateShareToken,
  stripSensitiveFields,
  formatBrainExportMarkdown,
  generateAiExportPrompt,
} from '../services/viral.service.js';

describe('viral & growth', () => {
  describe('generateReferralCode', () => {
    it('should generate a code with ob-ref- prefix', () => {
      const code = generateReferralCode();
      expect(code.startsWith('ob-ref-')).toBe(true);
    });

    it('should generate unique codes', () => {
      const codes = new Set(Array.from({ length: 50 }, () => generateReferralCode()));
      expect(codes.size).toBe(50);
    });

    it('should generate codes of consistent length', () => {
      const code = generateReferralCode();
      expect(code.length).toBeGreaterThanOrEqual(15);
      expect(code.length).toBeLessThanOrEqual(30);
    });
  });

  describe('generateShareToken', () => {
    it('should generate a token with ob-share- prefix', () => {
      const token = generateShareToken();
      expect(token.startsWith('ob-share-')).toBe(true);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()));
      expect(tokens.size).toBe(50);
    });
  });

  describe('stripSensitiveFields', () => {
    it('should remove id, userId, and timestamps from objects', () => {
      const input = {
        id: 'abc-123',
        userId: 'user-456',
        title: 'My Memory',
        body: 'Some content',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      };
      const result = stripSensitiveFields(input);
      expect(result).toEqual({ title: 'My Memory', body: 'Some content' });
    });

    it('should handle arrays of objects', () => {
      const input = [
        { id: '1', title: 'First', createdAt: '2026-01-01' },
        { id: '2', title: 'Second', updatedAt: '2026-01-02' },
      ];
      const result = input.map(stripSensitiveFields);
      expect(result).toEqual([{ title: 'First' }, { title: 'Second' }]);
    });

    it('should preserve non-sensitive fields', () => {
      const input = {
        type: 'fact',
        title: 'Test',
        confidence: 0.9,
        status: 'active',
      };
      const result = stripSensitiveFields(input);
      expect(result).toEqual(input);
    });
  });

  describe('formatBrainExportMarkdown', () => {
    it('should format profile section', () => {
      const md = formatBrainExportMarkdown({
        profile: { summary: 'A developer', traits: { focused: true }, preferences: {} },
        memories: [],
        entities: [],
        projects: [],
      });
      expect(md).toContain('# Brain Export');
      expect(md).toContain('## Profile');
      expect(md).toContain('A developer');
    });

    it('should format memories grouped by type', () => {
      const md = formatBrainExportMarkdown({
        profile: { summary: null, traits: {}, preferences: {} },
        memories: [
          { type: 'fact', title: 'Knows TypeScript', body: 'Expert level', status: 'active' },
          { type: 'goal', title: 'Learn Rust', body: 'Systems programming', status: 'active' },
        ],
        entities: [],
        projects: [],
      });
      expect(md).toContain('## Memories');
      expect(md).toContain('### fact');
      expect(md).toContain('- **Knows TypeScript**: Expert level');
      expect(md).toContain('### goal');
      expect(md).toContain('- **Learn Rust**: Systems programming');
    });

    it('should format entities', () => {
      const md = formatBrainExportMarkdown({
        profile: { summary: null, traits: {}, preferences: {} },
        memories: [],
        entities: [{ name: 'Alice', type: 'person', description: 'Colleague' }],
        projects: [],
      });
      expect(md).toContain('## Entities');
      expect(md).toContain('- **Alice** (person): Colleague');
    });

    it('should format projects', () => {
      const md = formatBrainExportMarkdown({
        profile: { summary: null, traits: {}, preferences: {} },
        memories: [],
        entities: [],
        projects: [{ name: 'OneBrain', description: 'AI memory layer', status: 'active' }],
      });
      expect(md).toContain('## Projects');
      expect(md).toContain('- **OneBrain** [active]: AI memory layer');
    });

    it('should omit empty sections', () => {
      const md = formatBrainExportMarkdown({
        profile: { summary: null, traits: {}, preferences: {} },
        memories: [],
        entities: [],
        projects: [],
      });
      expect(md).toContain('# Brain Export');
      expect(md).not.toContain('## Memories');
      expect(md).not.toContain('## Entities');
      expect(md).not.toContain('## Projects');
    });
  });

  describe('generateAiExportPrompt', () => {
    it('should generate a system prompt with brain context', () => {
      const prompt = generateAiExportPrompt({
        profile: { summary: 'Senior developer', traits: {}, preferences: {} },
        memories: [
          { type: 'fact', title: 'Uses TypeScript', body: 'Primary language', status: 'active' },
        ],
        entities: [],
        projects: [],
      });
      expect(prompt).toContain('Senior developer');
      expect(prompt).toContain('Uses TypeScript');
      expect(prompt).toContain('system prompt');
    });

    it('should include instruction to personalize responses', () => {
      const prompt = generateAiExportPrompt({
        profile: { summary: null, traits: {}, preferences: {} },
        memories: [],
        entities: [],
        projects: [],
      });
      expect(prompt.toLowerCase()).toContain('personali');
    });
  });
});
