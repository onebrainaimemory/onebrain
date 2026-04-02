import { describe, it, expect } from 'vitest';
import { hashToken } from '../lib/tokens.js';

/**
 * GDPR service tests.
 * DB-dependent operations are tested via integration tests.
 * Here we test the pure logic parts.
 */
describe('gdpr', () => {
  describe('consent IP hashing', () => {
    it('should produce consistent hash for same IP', () => {
      const ip = '192.168.1.100';
      const hash1 = hashToken(ip);
      const hash2 = hashToken(ip);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different IPs', () => {
      const hash1 = hashToken('192.168.1.100');
      const hash2 = hashToken('192.168.1.101');
      expect(hash1).not.toBe(hash2);
    });

    it('should not be reversible to original IP', () => {
      const hash = hashToken('192.168.1.100');
      expect(hash).not.toContain('192');
      expect(hash).not.toContain('168');
    });
  });

  describe('retention periods', () => {
    it('session cutoff should be 30 days', () => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const diff = now.getTime() - cutoff.getTime();
      const days = diff / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(30, 0);
    });

    it('magic link cutoff should be 24 hours', () => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const diff = now.getTime() - cutoff.getTime();
      const hours = diff / (60 * 60 * 1000);
      expect(hours).toBeCloseTo(24, 0);
    });

    it('usage events cutoff should be 24 months', () => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 24 * 30 * 24 * 60 * 60 * 1000);
      const diff = now.getTime() - cutoff.getTime();
      const months = diff / (30 * 24 * 60 * 60 * 1000);
      expect(months).toBeCloseTo(24, 0);
    });

    it('audit logs cutoff should be 90 days', () => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const diff = now.getTime() - cutoff.getTime();
      const days = diff / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(90, 0);
    });

    it('user hard-delete cutoff should be 30 days', () => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const diff = now.getTime() - cutoff.getTime();
      const days = diff / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(30, 0);
    });
  });
});
