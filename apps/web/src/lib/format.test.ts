import { describe, it, expect } from 'vitest';
import { formatDate, formatNumber, formatRelativeTime } from './format';

describe('formatDate', () => {
  it('should format a Date object with locale', () => {
    const date = new Date('2026-03-15T10:30:00Z');
    const result = formatDate(date, 'en');
    expect(result).toContain('2026');
    expect(result).toContain('15');
  });

  it('should format a string date with locale', () => {
    const result = formatDate('2026-06-20', 'en');
    expect(result).toContain('2026');
  });

  it('should accept custom format options', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const result = formatDate(date, 'en', {
      year: 'numeric',
      month: 'long',
    });
    expect(result).toContain('January');
    expect(result).toContain('2026');
  });

  it('should format for German locale', () => {
    const date = new Date('2026-03-15');
    const result = formatDate(date, 'de');
    expect(result).toContain('2026');
  });

  it('should format for Spanish locale', () => {
    const date = new Date('2026-03-15');
    const result = formatDate(date, 'es');
    expect(result).toContain('2026');
  });
});

describe('formatNumber', () => {
  it('should format numbers with locale', () => {
    const result = formatNumber(1234567, 'en');
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('567');
  });

  it('should format zero', () => {
    expect(formatNumber(0, 'en')).toBe('0');
  });

  it('should format negative numbers', () => {
    const result = formatNumber(-42, 'en');
    expect(result).toContain('42');
  });

  it('should accept custom number format options', () => {
    const result = formatNumber(0.5, 'en', { style: 'percent' });
    expect(result).toContain('50');
    expect(result).toContain('%');
  });
});

describe('formatRelativeTime', () => {
  it('should return a string for a recent date', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinutesAgo, 'en');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle string dates', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(yesterday.toISOString(), 'en');
    expect(typeof result).toBe('string');
  });

  it('should handle future dates', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(tomorrow, 'en');
    expect(typeof result).toBe('string');
  });
});
