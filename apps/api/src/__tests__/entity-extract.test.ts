import { describe, it, expect } from 'vitest';
import { extractEntitiesFromText } from '../services/entity-extract.service.js';

describe('entity-extract', () => {
  describe('extractEntitiesFromText', () => {
    it('should return empty array for empty text', () => {
      expect(extractEntitiesFromText('')).toEqual([]);
      expect(extractEntitiesFromText('   ')).toEqual([]);
    });

    it('should extract labeled entities', () => {
      const result = extractEntitiesFromText(
        'My friend person: John Smith works at organization: Acme Corp',
      );
      const names = result.map((e) => e.name);
      expect(names).toContain('John Smith');
      expect(names.some((n) => n.includes('Acme Corp'))).toBe(true);
    });

    it('should extract proper nouns as person entities', () => {
      const result = extractEntitiesFromText('Alice Johnson and Bob Williams met yesterday');
      const names = result.map((e) => e.name);
      expect(names).toContain('Alice Johnson');
      expect(names).toContain('Bob Williams');
    });

    it('should classify known cities as places via labeled extraction', () => {
      const result = extractEntitiesFromText('Moving to place: Berlin. Next month.');
      const places = result.filter((e) => e.type === 'place');
      expect(places).toHaveLength(1);
      expect(places[0]!.name).toBe('Berlin');
    });

    it('should extract URLs as tool entities', () => {
      const result = extractEntitiesFromText('Check out https://example.com/tool for details');
      const tools = result.filter((e) => e.type === 'tool');
      expect(tools).toHaveLength(1);
      expect(tools[0]!.name).toContain('example.com');
    });

    it('should deduplicate entities that appear multiple times', () => {
      const result = extractEntitiesFromText(
        'Alice Johnson called. Alice Johnson said she will call again.',
      );
      const aliceCount = result.filter((e) => e.name.includes('Alice Johnson')).length;
      expect(aliceCount).toBe(1);
    });
  });
});
