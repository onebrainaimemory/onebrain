import { describe, it, expect } from 'vitest';
import { maskEmail, maskIp, maskUrl, requestSerializer } from '../lib/pii-mask.js';

describe('pii-mask', () => {
  describe('maskEmail', () => {
    it('should mask a standard email', () => {
      const masked = maskEmail('user@example.com');
      expect(masked).toBe('u***@e***.com');
    });

    it('should mask a long local part', () => {
      const masked = maskEmail('john.doe@company.org');
      expect(masked).toBe('j***@c***.org');
    });

    it('should handle short email', () => {
      const masked = maskEmail('a@b.de');
      expect(masked).toBe('a***@b***.de');
    });

    it('should handle missing @ symbol', () => {
      const masked = maskEmail('invalid');
      expect(masked).toBe('***');
    });

    it('should not expose the full domain', () => {
      const masked = maskEmail('admin@onebrain.rocks');
      expect(masked).not.toContain('onebrain');
    });
  });

  describe('maskIp', () => {
    it('should mask IPv4 last two octets', () => {
      const masked = maskIp('192.168.1.100');
      expect(masked).toBe('192.168.x.x');
    });

    it('should mask 10.x network', () => {
      const masked = maskIp('10.0.0.1');
      expect(masked).toBe('10.0.x.x');
    });

    it('should handle IPv6 loopback', () => {
      const masked = maskIp('::1');
      expect(masked).toBe('::x');
    });

    it('should mask full IPv6', () => {
      const masked = maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      expect(masked).not.toContain('7334');
    });

    it('should handle empty string', () => {
      expect(maskIp('')).toBe('***');
    });
  });

  describe('maskUrl', () => {
    it('should mask API key in connect URL', () => {
      const masked = maskUrl('/v1/connect/ob_abc12345_secretvalue123');
      expect(masked).toBe('/v1/connect/ob_abc1***');
      expect(masked).not.toContain('secretvalue');
    });

    it('should mask long API key', () => {
      const masked = maskUrl('/v1/connect/ob_abcdef1234567890_longsecrethere');
      expect(masked).toBe('/v1/connect/ob_abcd***');
    });

    it('should not modify non-connect URLs', () => {
      const url = '/v1/context/assistant';
      expect(maskUrl(url)).toBe(url);
    });

    it('should not modify connect URL without ob_ prefix', () => {
      const url = '/v1/connect/invalid_key';
      expect(maskUrl(url)).toBe(url);
    });
  });

  describe('requestSerializer', () => {
    it('should mask IP in serialized request', () => {
      const result = requestSerializer({
        method: 'GET',
        url: '/v1/auth/me',
        hostname: 'localhost',
        ip: '192.168.1.50',
      });

      expect(result.method).toBe('GET');
      expect(result.url).toBe('/v1/auth/me');
      expect(result.remoteAddress).toBe('192.168.x.x');
    });

    it('should mask API key in connect URL', () => {
      const result = requestSerializer({
        method: 'GET',
        url: '/v1/connect/ob_abc12345_secretvalue',
        hostname: 'localhost',
        ip: '10.0.0.1',
      });

      expect(result.url).toBe('/v1/connect/ob_abc1***');
      expect(result.url).not.toContain('secretvalue');
    });

    it('should handle missing IP', () => {
      const result = requestSerializer({
        method: 'POST',
        url: '/v1/auth/login',
      });

      expect(result.remoteAddress).toBeUndefined();
    });
  });
});
