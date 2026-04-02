import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const JWT_SECRET = new TextEncoder().encode(config.auth.jwtSecret);

export function generateMagicLinkToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface JwtPayload {
  sub: string;
  region: string;
  sessionId: string;
  type: 'access' | 'refresh';
  role?: string;
}

export async function signAccessToken(payload: {
  userId: string;
  region: string;
  sessionId: string;
  role?: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    region: payload.region,
    sessionId: payload.sessionId,
    type: 'access',
    role: payload.role ?? 'user',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.auth.jwtExpiry)
    .setIssuer('onebrain')
    .setAudience('onebrain-api')
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: {
  userId: string;
  region: string;
  sessionId: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    region: payload.region,
    sessionId: payload.sessionId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.auth.refreshTokenExpiry)
    .setIssuer('onebrain')
    .setAudience('onebrain-api')
    .sign(JWT_SECRET);
}

/**
 * Parses a duration string like '7d', '15m', '1h' into milliseconds.
 * Shared across all auth services to prevent divergence.
 */
export function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] ?? 24 * 60 * 60 * 1000);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: 'onebrain',
    audience: 'onebrain-api',
  });

  return {
    sub: payload.sub as string,
    region: payload['region'] as string,
    sessionId: payload['sessionId'] as string,
    type: payload['type'] as 'access' | 'refresh',
    role: (payload['role'] as string) ?? 'user',
  };
}
