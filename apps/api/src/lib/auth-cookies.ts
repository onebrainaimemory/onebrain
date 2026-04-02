import type { FastifyReply } from 'fastify';
import { config } from '../config.js';

const IS_PROD = process.env['NODE_ENV'] === 'production';

/**
 * Parses a duration string like '7d', '15m', '1h' into seconds.
 */
function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60; // fallback: 7 days
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 7 * 24 * 60 * 60;
  }
}

/** Derive cookie path from API_PUBLIC_URL (e.g. "/api/eu") or fall back to "/" */
function cookieBasePath(): string {
  const publicUrl = process.env['API_PUBLIC_URL'];
  if (publicUrl) {
    try {
      return new URL(publicUrl).pathname.replace(/\/+$/, '') || '/';
    } catch {
      // invalid URL — fall back
    }
  }
  return '/';
}

const BASE_PATH = cookieBasePath();

/** Exported for reuse in routes that set their own cookies (e.g. 2FA). */
export { BASE_PATH as COOKIE_BASE_PATH };

export function setAccessTokenCookie(reply: FastifyReply, token: string): void {
  reply.setCookie('accessToken', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    path: `${BASE_PATH}/v1`,
    maxAge: 900, // 15 minutes — matches default JWT_EXPIRY
  });
}

export function setRefreshTokenCookie(reply: FastifyReply, token: string): void {
  reply.setCookie('refreshToken', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    path: `${BASE_PATH}/v1/auth`,
    maxAge: parseExpiryToSeconds(config.auth.refreshTokenExpiry),
  });
}
