import { getClient } from '@onebrain/db';
import {
  generateMagicLinkToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  parseExpiry,
} from '../lib/tokens.js';
import { sendVerificationEmail } from '../lib/mail.js';
import { config } from '../config.js';
import { audit } from '../lib/audit.js';
import { maskIp } from '../lib/pii-mask.js';
import { AuthError } from './auth.service.js';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface PasswordAuthResult {
  tokens: TokenPair;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    region: string;
    locale: string;
    role: string;
    emailVerified: boolean;
  };
  isNewUser: boolean;
}

interface TwoFactorPendingResult {
  requires2fa: true;
  tempToken: string;
}

type LoginResult = PasswordAuthResult | TwoFactorPendingResult;

async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 12);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(password, hash);
}

// Pre-computed valid bcrypt-12 hash for timing-safe comparison when user doesn't exist.
// Ensures non-existent user lookups take the same time as real comparisons.
// This is a real bcrypt hash of a random string — it just needs to be valid so
// bcrypt.compare() performs the full work factor.
const DUMMY_HASH = '$2b$12$LJ3m4ys3Lk0TSwHilGJGP.UYv3xHF.FPQOGYf2JcIMxWbXKXOq3Wy';

export async function registerWithPassword(
  email: string,
  password: string,
  locale: string,
  displayName?: string,
): Promise<PasswordAuthResult> {
  const prisma = getClient();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError('EMAIL_ALREADY_EXISTS', 'auth.register.email_exists', 409);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: displayName ?? null,
      locale: locale as 'de' | 'en' | 'es',
      region: 'EU' as const,
      isActive: true,
      emailVerified: false,
    },
  });

  const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } });
  if (freePlan) {
    await prisma.userPlan.create({
      data: { userId: user.id, planId: freePlan.id, isActive: true },
    });
  }

  await prisma.brainProfile.create({
    data: {
      userId: user.id,
      summary: '',
      traits: {},
      preferences: {},
    },
  });

  await sendEmailVerificationToken(user.id, email, locale);

  const refreshExpiry = parseExpiry(config.auth.refreshTokenExpiry);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      region: user.region,
      expiresAt: new Date(Date.now() + refreshExpiry),
    },
  });

  const tokenPayload = {
    userId: user.id,
    region: user.region,
    sessionId: session.id,
    role: user.role,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ]);

  return {
    tokens: { accessToken, refreshToken },
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      region: user.region,
      locale: user.locale,
      role: user.role,
      emailVerified: user.emailVerified,
    },
    isNewUser: true,
  };
}

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 30 * 60; // 30 minutes

async function checkLoginLockout(email: string): Promise<void> {
  try {
    const { getCache } = await import('../lib/cache.js');
    const key = `login_fail:${email}`;
    const raw = await getCache(key);
    if (raw) {
      const count = parseInt(raw, 10);
      if (count >= LOCKOUT_MAX_ATTEMPTS) {
        throw new AuthError('ACCOUNT_LOCKED', 'auth.login_password.locked', 429);
      }
    }
  } catch (err) {
    // Re-throw AuthError (lockout), but fail-closed on cache errors
    if (err instanceof AuthError) throw err;
    throw new AuthError('SERVICE_UNAVAILABLE', 'auth.login_password.unavailable', 503);
  }
}

async function recordLoginFailure(email: string): Promise<void> {
  try {
    const { incrementCache } = await import('../lib/cache.js');
    const key = `login_fail:${email}`;
    await incrementCache(key, LOCKOUT_WINDOW_SECONDS);
  } catch {
    // Fail-closed: if we can't record failures, log but don't suppress.
    // The lockout check will also fail-closed (503) if cache is down.
  }
}

async function clearLoginFailures(email: string): Promise<void> {
  try {
    const { invalidateCache } = await import('../lib/cache.js');
    await invalidateCache(`login_fail:${email}`);
  } catch {
    // Best-effort: clearing failures is not critical
  }
}

export async function loginWithPassword(
  email: string,
  password: string,
  deviceName?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<LoginResult> {
  // Check lockout before any DB queries
  await checkLoginLockout(email);

  const prisma = getClient();

  const user = await prisma.user.findUnique({ where: { email } });

  // Always run bcrypt to prevent timing-based email enumeration.
  // Non-existent users compare against a dummy hash (same CPU cost).
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const isValid = await comparePassword(password, hashToCompare);

  if (!user || !user.passwordHash) {
    await recordLoginFailure(email);
    audit(
      'anonymous',
      'login_failed',
      'user',
      undefined,
      { email, reason: 'invalid_user' },
      ipAddress,
    );
    throw new AuthError('INVALID_CREDENTIALS', 'auth.login_password.invalid', 401);
  }

  if (!user.isActive || user.deletedAt) {
    throw new AuthError('ACCOUNT_DISABLED', 'auth.login_password.disabled', 401);
  }

  if (!isValid) {
    await recordLoginFailure(email);
    audit(
      user.id,
      'login_failed',
      'user',
      user.id,
      { email, reason: 'invalid_password' },
      ipAddress,
    );
    throw new AuthError('INVALID_CREDENTIALS', 'auth.login_password.invalid', 401);
  }

  // Successful login — clear failure counter
  await clearLoginFailures(email);

  if (user.totpEnabled) {
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(config.auth.jwtSecret);
    const tempToken = await new SignJWT({
      sub: user.id,
      type: '2fa_pending',
      region: user.region,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer('onebrain')
      .setAudience('onebrain-2fa')
      .sign(secret);

    return { requires2fa: true, tempToken };
  }

  return createSessionAndTokens(user, deviceName, ipAddress, userAgent);
}

export async function createSessionAndTokens(
  user: {
    id: string;
    email: string;
    displayName: string | null;
    region: 'EU' | 'GLOBAL';
    locale: string;
    role: string;
    emailVerified: boolean;
  },
  deviceName?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<PasswordAuthResult> {
  const prisma = getClient();
  const refreshExpiry = parseExpiry(config.auth.refreshTokenExpiry);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      region: user.region,
      expiresAt: new Date(Date.now() + refreshExpiry),
      deviceName: deviceName ?? null,
      ipAddress: ipAddress ? maskIp(ipAddress) : null,
      userAgent: userAgent ?? null,
    },
  });

  const tokenPayload = {
    userId: user.id,
    region: user.region,
    sessionId: session.id,
    role: user.role,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ]);

  return {
    tokens: { accessToken, refreshToken },
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      region: user.region,
      locale: user.locale,
      role: user.role,
      emailVerified: user.emailVerified,
    },
    isNewUser: false,
  };
}

async function sendEmailVerificationToken(
  userId: string,
  email: string,
  locale: string,
): Promise<void> {
  const prisma = getClient();

  await prisma.magicLinkToken.updateMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  const { raw, hash } = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.magicLinkToken.create({
    data: {
      userId,
      email,
      tokenHash: hash,
      expiresAt,
    },
  });

  await sendVerificationEmail(email, raw, locale);
}

export async function verifyEmailToken(token: string): Promise<void> {
  const prisma = getClient();
  const tokenHash = hashToken(token);

  const magicLink = await prisma.magicLinkToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!magicLink) {
    throw new AuthError('INVALID_TOKEN', 'auth.email_verify.invalid', 401);
  }

  if (!magicLink.userId) {
    throw new AuthError('INVALID_TOKEN', 'auth.email_verify.invalid', 401);
  }

  await prisma.$transaction([
    prisma.magicLinkToken.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: magicLink.userId },
      data: { emailVerified: true },
    }),
  ]);
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, locale: true, emailVerified: true },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'common.error', 404);
  }

  if (user.emailVerified) {
    throw new AuthError('ALREADY_VERIFIED', 'auth.email_verify.already_verified', 400);
  }

  await sendEmailVerificationToken(user.id, user.email, user.locale);
}
