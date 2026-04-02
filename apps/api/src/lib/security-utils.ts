import { basename } from 'node:path';

/**
 * Sanitizes a filename to prevent path traversal and injection.
 * - Strips directory components (basename)
 * - Replaces non-safe characters with underscores
 * - Truncates to 200 characters
 */
export function sanitizeFilename(filename: string): string {
  const base = basename(filename);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

/**
 * Checks whether an IP address is in a private/reserved range.
 * Covers RFC 1918, loopback, link-local, cloud metadata, and IPv6 equivalents.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }

  // IPv6 private ranges
  if (ip === '::1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80')) return true;
  if (ip === '::') return true;

  return false;
}
