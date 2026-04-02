import { describe, it, expect } from 'vitest';
import {
  getPeriodStart,
  isWithinLimit,
  resolveFeatureValue,
  isFeatureEnabled,
} from '../services/plan.service.js';

describe('monetization', () => {
  describe('getPeriodStart', () => {
    it('should return start of current month for monthly period', () => {
      const start = getPeriodStart('monthly');
      const now = new Date();
      expect(start.getFullYear()).toBe(now.getFullYear());
      expect(start.getMonth()).toBe(now.getMonth());
      expect(start.getDate()).toBe(1);
      expect(start.getHours()).toBe(0);
    });

    it('should return start of current day for daily period', () => {
      const start = getPeriodStart('daily');
      const now = new Date();
      expect(start.getFullYear()).toBe(now.getFullYear());
      expect(start.getMonth()).toBe(now.getMonth());
      expect(start.getDate()).toBe(now.getDate());
      expect(start.getHours()).toBe(0);
    });

    it('should return start of current week for weekly period', () => {
      const start = getPeriodStart('weekly');
      expect(start.getDay()).toBe(1); // Monday
      expect(start.getHours()).toBe(0);
    });
  });

  describe('isWithinLimit', () => {
    it('should return true when usage is below limit', () => {
      expect(isWithinLimit(5, 10)).toBe(true);
    });

    it('should return false when usage equals limit', () => {
      expect(isWithinLimit(10, 10)).toBe(false);
    });

    it('should return false when usage exceeds limit', () => {
      expect(isWithinLimit(15, 10)).toBe(false);
    });

    it('should return true for unlimited (-1)', () => {
      expect(isWithinLimit(9999, -1)).toBe(true);
    });
  });

  describe('resolveFeatureValue', () => {
    const features = [
      { key: 'max_context_depth', value: 'assistant' },
      { key: 'allow_deep_context', value: 'true' },
      { key: 'max_entities_in_context', value: '10' },
    ];

    it('should return value for existing key', () => {
      expect(resolveFeatureValue(features, 'max_context_depth')).toBe('assistant');
    });

    it('should return default for missing key', () => {
      expect(resolveFeatureValue(features, 'nonexistent', 'fallback')).toBe('fallback');
    });

    it('should return undefined for missing key without default', () => {
      expect(resolveFeatureValue(features, 'nonexistent')).toBeUndefined();
    });
  });

  describe('isFeatureEnabled', () => {
    const features = [
      { key: 'allow_deep_context', value: 'true' },
      { key: 'priority_processing', value: 'false' },
    ];

    it('should return true for "true" value', () => {
      expect(isFeatureEnabled(features, 'allow_deep_context')).toBe(true);
    });

    it('should return false for "false" value', () => {
      expect(isFeatureEnabled(features, 'priority_processing')).toBe(false);
    });

    it('should return false for missing key', () => {
      expect(isFeatureEnabled(features, 'nonexistent')).toBe(false);
    });
  });
});
