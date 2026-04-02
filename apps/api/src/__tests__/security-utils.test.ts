import { describe, it, expect } from 'vitest';
import { sanitizeFilename, isPrivateIp } from '../lib/security-utils.js';

describe('sanitizeFilename', () => {
  it('should strip directory traversal sequences', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
  });

  it('should strip absolute paths', () => {
    expect(sanitizeFilename('/etc/shadow')).toBe('shadow');
  });

  it('should strip Windows-style paths', () => {
    // On Unix, basename doesn't handle \, but backslashes are replaced by _
    const result = sanitizeFilename('C:\\Users\\admin\\evil.exe');
    expect(result).not.toContain('\\');
    expect(result).toContain('evil.exe');
  });

  it('should replace non-alphanumeric chars except dot, dash, underscore', () => {
    expect(sanitizeFilename('file name (1).txt')).toBe('file_name__1_.txt');
  });

  it('should preserve normal filenames', () => {
    expect(sanitizeFilename('my-document.pdf')).toBe('my-document.pdf');
    expect(sanitizeFilename('report_2026.csv')).toBe('report_2026.csv');
  });

  it('should truncate to 200 characters', () => {
    const longName = 'a'.repeat(300) + '.txt';
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('should handle empty string', () => {
    const result = sanitizeFilename('');
    expect(result).toBe('');
  });

  it('should handle filenames with only special chars', () => {
    const result = sanitizeFilename('$%^&*()');
    expect(result).toBe('_______');
  });

  it('should handle unicode filenames', () => {
    const result = sanitizeFilename('dokument-über-résumé.txt');
    // Non-ASCII chars replaced with underscore
    expect(result).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(result).toContain('.txt');
  });

  it('should handle null bytes', () => {
    const result = sanitizeFilename('file\x00.txt');
    expect(result).not.toContain('\x00');
  });
});

describe('isPrivateIp', () => {
  describe('IPv4 private ranges', () => {
    it('should block 10.0.0.0/8', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
    });

    it('should block 172.16.0.0/12', () => {
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
    });

    it('should allow 172.15.x.x and 172.32.x.x', () => {
      expect(isPrivateIp('172.15.0.1')).toBe(false);
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });

    it('should block 192.168.0.0/16', () => {
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.255.255')).toBe(true);
    });

    it('should block 127.0.0.0/8 (loopback)', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.255.255.255')).toBe(true);
    });

    it('should block 169.254.0.0/16 (link-local / cloud metadata)', () => {
      expect(isPrivateIp('169.254.0.1')).toBe(true);
      expect(isPrivateIp('169.254.169.254')).toBe(true);
    });

    it('should block 0.0.0.0/8', () => {
      expect(isPrivateIp('0.0.0.0')).toBe(true);
      expect(isPrivateIp('0.255.255.255')).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('93.184.216.34')).toBe(false);
    });
  });

  describe('IPv6 private ranges', () => {
    it('should block ::1 (loopback)', () => {
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('should block fc00::/7 (unique local)', () => {
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd12:3456::1')).toBe(true);
    });

    it('should block fe80:: (link-local)', () => {
      expect(isPrivateIp('fe80::1')).toBe(true);
    });

    it('should block :: (unspecified)', () => {
      expect(isPrivateIp('::')).toBe(true);
    });
  });
});
