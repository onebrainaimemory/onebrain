import { describe, it, expect } from 'vitest';
import {
  detectSensitiveData,
  filterSensitiveData,
  containsSensitiveData,
} from '../lib/sensitive-data-filter.js';

describe('sensitive-data-filter', () => {
  describe('detectSensitiveData', () => {
    it('detects OneBrain API keys', () => {
      const text = 'Use key ob_7f0f44e5c4411779_1d8252714b2244403c418d62eeee20895e3c4b92a7faf2a7';
      const matches = detectSensitiveData(text);
      expect(matches.length).toBe(1);
      expect(matches[0]?.pattern).toBe('onebrain_api_key');
    });

    it('detects JWT tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiMTIz.abc123def456ghi';
      const matches = detectSensitiveData(text);
      expect(matches.some((m) => m.pattern === 'bearer_token')).toBe(true);
    });

    it('detects AWS access keys', () => {
      const text = 'aws_access_key_id = AKIAIOSFODNN7EXAMPLE';
      const matches = detectSensitiveData(text);
      expect(matches.some((m) => m.pattern === 'aws_access_key')).toBe(true);
    });

    it('detects Stripe keys', () => {
      const text = 'STRIPE_SECRET_KEY=sk_live_51ABC123DEF456GHI789JKL';
      const matches = detectSensitiveData(text);
      expect(matches.some((m) => m.pattern === 'stripe_key')).toBe(true);
    });

    it('detects GitHub tokens', () => {
      const text = 'token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh1234';
      const matches = detectSensitiveData(text);
      expect(matches.some((m) => m.pattern === 'github_token')).toBe(true);
    });

    it('detects private keys', () => {
      const text = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg==\n-----END PRIVATE KEY-----';
      const matches = detectSensitiveData(text);
      expect(matches.some((m) => m.pattern === 'private_key')).toBe(true);
    });

    it('detects connection strings with credentials', () => {
      const text = 'DATABASE_URL=postgres://admin:supersecret@db.example.com:5432/mydb';
      const matches = detectSensitiveData(text);
      expect(matches.some((m) => m.pattern === 'connection_string')).toBe(true);
    });

    it('detects password assignments', () => {
      const text = 'password="MySecretPass123"';
      const matches = detectSensitiveData(text);
      expect(matches.some((m) => m.pattern === 'password_assignment')).toBe(true);
    });

    it('returns empty array for clean text', () => {
      const text = 'The user prefers dark mode and speaks German.';
      const matches = detectSensitiveData(text);
      expect(matches).toEqual([]);
    });
  });

  describe('filterSensitiveData', () => {
    it('redacts OneBrain API keys', () => {
      const text =
        'Connect via ob_7f0f44e5c4411779_1d8252714b2244403c418d62eeee20895e3c4b92a7faf2a7 endpoint';
      const result = filterSensitiveData(text);
      expect(result.filtered).toBe(true);
      expect(result.text).toBe('Connect via [REDACTED] endpoint');
      expect(result.text).not.toContain('ob_7f0f44');
    });

    it('redacts multiple patterns in same text', () => {
      const text = 'key: sk_live_ABC123DEF456GHI789JKL and password="secret123"';
      const result = filterSensitiveData(text);
      expect(result.filtered).toBe(true);
      expect(result.text).not.toContain('sk_live_');
      expect(result.text).not.toContain('secret123');
      expect(result.matches.length).toBeGreaterThanOrEqual(2);
    });

    it('returns unchanged text when no secrets found', () => {
      const text = 'User enjoys hiking and cooking Italian food.';
      const result = filterSensitiveData(text);
      expect(result.filtered).toBe(false);
      expect(result.text).toBe(text);
      expect(result.matches).toEqual([]);
    });
  });

  describe('containsSensitiveData', () => {
    it('returns true for text with secrets', () => {
      expect(containsSensitiveData('Use ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh1234')).toBe(true);
    });

    it('returns false for clean text', () => {
      expect(containsSensitiveData('Favorite color is blue')).toBe(false);
    });
  });
});
