import { describe, it, expect } from 'vitest';
import { normalize, normalizeForComparison } from '../lib/text-normalize.js';

describe('text-normalize', () => {
  describe('normalize', () => {
    it('should trim leading and trailing whitespace', () => {
      expect(normalize('  hello world  ')).toBe('hello world');
    });

    it('should collapse multiple spaces into one', () => {
      expect(normalize('hello   world   foo')).toBe('hello world foo');
    });

    it('should collapse newlines and tabs into single space', () => {
      expect(normalize('hello\n\n\tworld')).toBe('hello world');
    });

    it('should preserve original casing', () => {
      expect(normalize('  Hello World  ')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(normalize('')).toBe('');
    });

    it('should handle string with only whitespace', () => {
      expect(normalize('   \n\t  ')).toBe('');
    });
  });

  describe('normalizeForComparison', () => {
    it('should lowercase the result', () => {
      expect(normalizeForComparison('Hello World')).toBe('hello world');
    });

    it('should trim and collapse whitespace', () => {
      expect(normalizeForComparison('  Hello   World  ')).toBe('hello world');
    });

    it('should make comparison case-insensitive', () => {
      const a = normalizeForComparison('User prefers Coffee');
      const b = normalizeForComparison('user prefers coffee');
      expect(a).toBe(b);
    });
  });
});
