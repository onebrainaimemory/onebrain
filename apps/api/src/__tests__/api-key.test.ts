import { describe, it, expect } from 'vitest';
import { hashToken } from '../lib/tokens.js';
import {
  generateApiKeySecret,
  parseApiKeyHeader,
  parseFullApiKey,
  isValidScope,
  hasScope,
} from '../services/api-key.service.js';

describe('api-key', () => {
  describe('generateApiKeySecret', () => {
    it('should return a prefix and secret', () => {
      const result = generateApiKeySecret();
      expect(result.prefix).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.hash).toBeDefined();
    });

    it('should create a prefix starting with ob_', () => {
      const result = generateApiKeySecret();
      expect(result.prefix).toMatch(/^ob_/);
    });

    it('should create a full key as prefix_secret', () => {
      const result = generateApiKeySecret();
      const fullKey = `${result.prefix}_${result.secret}`;
      expect(fullKey).toContain(result.prefix);
    });

    it('should hash the secret with SHA-256', () => {
      const result = generateApiKeySecret();
      const expectedHash = hashToken(result.secret);
      expect(result.hash).toBe(expectedHash);
    });

    it('should generate unique keys each time', () => {
      const a = generateApiKeySecret();
      const b = generateApiKeySecret();
      expect(a.secret).not.toBe(b.secret);
      expect(a.prefix).not.toBe(b.prefix);
    });
  });

  describe('parseApiKeyHeader', () => {
    it('should parse a valid API key header', () => {
      const result = parseApiKeyHeader('ApiKey ob_abc123_secretvalue');
      expect(result).toEqual({ prefix: 'ob_abc123', secret: 'secretvalue' });
    });

    it('should return null for missing ApiKey prefix', () => {
      expect(parseApiKeyHeader('Bearer some-token')).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseApiKeyHeader('ApiKey invalid')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseApiKeyHeader('')).toBeNull();
    });
  });

  describe('parseFullApiKey', () => {
    it('should parse a valid full API key', () => {
      const result = parseFullApiKey('ob_abc123_secretvalue');
      expect(result).toEqual({ prefix: 'ob_abc123', secret: 'secretvalue' });
    });

    it('should parse a generated key', () => {
      const { prefix, secret } = generateApiKeySecret();
      const fullKey = `${prefix}_${secret}`;
      const result = parseFullApiKey(fullKey);
      expect(result).toEqual({ prefix, secret });
    });

    it('should return null for non-ob_ prefix', () => {
      expect(parseFullApiKey('sk_abc123_secret')).toBeNull();
    });

    it('should return null for missing second underscore', () => {
      expect(parseFullApiKey('ob_nosecret')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseFullApiKey('')).toBeNull();
    });
  });

  describe('isValidScope', () => {
    it('should accept valid scopes', () => {
      expect(isValidScope('brain.read')).toBe(true);
      expect(isValidScope('brain.write')).toBe(true);
      expect(isValidScope('memory.extract.write')).toBe(true);
      expect(isValidScope('entity.read')).toBe(true);
      expect(isValidScope('entity.write')).toBe(true);
      expect(isValidScope('connect.read')).toBe(true);
    });

    it('should reject invalid scopes', () => {
      expect(isValidScope('admin.all')).toBe(false);
      expect(isValidScope('invalid')).toBe(false);
      expect(isValidScope('')).toBe(false);
    });
  });

  describe('hasScope', () => {
    it('should return true when scope is present', () => {
      expect(hasScope(['brain.read', 'brain.write'], 'brain.read')).toBe(true);
    });

    it('should return false when scope is missing', () => {
      expect(hasScope(['brain.read'], 'brain.write')).toBe(false);
    });

    it('should return false for empty scopes array', () => {
      expect(hasScope([], 'brain.read')).toBe(false);
    });
  });
});
