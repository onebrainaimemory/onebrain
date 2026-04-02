/**
 * PII masking utilities for log sanitization.
 * Ensures no personal data appears in plain text in logs.
 */

/**
 * Masks an email address: "user@example.com" → "u***@e***.com"
 */
export function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 1) return '***';

  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const dotIdx = domain.lastIndexOf('.');

  if (dotIdx < 1) return `${local[0]}***@***`;

  const domainName = domain.slice(0, dotIdx);
  const tld = domain.slice(dotIdx);

  return `${local[0]}***@${domainName[0]}***${tld}`;
}

/**
 * Masks an IP address: "192.168.1.100" → "192.168.x.x"
 * IPv6: "::1" → "::x"
 */
export function maskIp(ip: string): string {
  if (!ip) return '***';

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`;
    }
    return '***';
  }

  // IPv6 — mask last segments
  if (ip.includes(':')) {
    const parts = ip.split(':');
    // Short IPv6 like ::1
    if (ip.startsWith('::') && parts.length <= 3) return '::x';
    if (parts.length <= 2) return '::x';
    return parts.slice(0, Math.ceil(parts.length / 2)).join(':') + ':x:x';
  }

  return '***';
}

/**
 * Masks API key in URL paths: "/v1/connect/ob_abc123_secret" → "/v1/connect/ob_abc***"
 */
export function maskUrl(url: string): string {
  return url.replace(/\/v1\/connect\/ob_([a-f0-9]{1,4})[^\s?#]*/i, '/v1/connect/ob_$1***');
}

/**
 * Fastify logger serializer for request objects.
 * Masks IP address and API keys in logged request data.
 */
export function requestSerializer(request: {
  method?: string;
  url?: string;
  hostname?: string;
  remoteAddress?: string;
  ip?: string;
}) {
  return {
    method: request.method,
    url: request.url ? maskUrl(request.url) : request.url,
    hostname: request.hostname,
    remoteAddress: request.ip
      ? maskIp(request.ip)
      : request.remoteAddress
        ? maskIp(request.remoteAddress)
        : undefined,
  };
}
