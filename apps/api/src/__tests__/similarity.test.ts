import { describe, it, expect } from 'vitest';
import { diceCoefficient, isSimilar } from '../lib/similarity.js';

describe('similarity', () => {
  describe('diceCoefficient', () => {
    it('should return 1.0 for identical strings', () => {
      expect(diceCoefficient('hello', 'hello')).toBe(1.0);
    });

    it('should return 0.0 for completely different strings', () => {
      expect(diceCoefficient('abc', 'xyz')).toBe(0.0);
    });

    it('should return value between 0 and 1 for partial matches', () => {
      const score = diceCoefficient('night', 'nacht');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('should be case-insensitive', () => {
      expect(diceCoefficient('Hello', 'hello')).toBe(1.0);
    });

    it('should handle empty strings', () => {
      expect(diceCoefficient('', '')).toBe(1.0);
      expect(diceCoefficient('hello', '')).toBe(0.0);
      expect(diceCoefficient('', 'hello')).toBe(0.0);
    });

    it('should handle single character strings', () => {
      expect(diceCoefficient('a', 'a')).toBe(1.0);
      expect(diceCoefficient('a', 'b')).toBe(0.0);
    });

    it('should score similar strings higher than dissimilar ones', () => {
      const similar = diceCoefficient('user prefers coffee', 'user prefers tea');
      const different = diceCoefficient('user prefers coffee', 'the sky is blue');
      expect(similar).toBeGreaterThan(different);
    });
  });

  describe('isSimilar', () => {
    it('should return true for identical strings', () => {
      expect(isSimilar('hello world', 'hello world')).toBe(true);
    });

    it('should return true for very similar strings', () => {
      expect(isSimilar('User likes coffee', 'User likes coffees')).toBe(true);
    });

    it('should return false for completely different strings', () => {
      expect(isSimilar('User likes coffee', 'The weather is nice')).toBe(false);
    });

    it('should respect custom threshold', () => {
      const a = 'user prefers dark mode';
      const b = 'user prefers light mode';
      // With a very low threshold, these should match
      expect(isSimilar(a, b, 0.3)).toBe(true);
      // With a very high threshold, these should not match
      expect(isSimilar(a, b, 0.95)).toBe(false);
    });
  });
});
