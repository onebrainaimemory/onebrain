import { getClient } from '@onebrain/db';
import {
  generateMagicLinkToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  parseExpiry,
} from '../lib/tokens.js';
import { sendMagicLinkEmail } from '../lib/mail.js';
import { config } from '../config.js';
import { maskIp } from '../lib/pii-mask.js';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  tokens: TokenPair;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    region: string;
    locale: string;
    role: string;
  };
  isNewUser: boolean;
}

interface MagicLinkAuthResult extends AuthResult {
  requiresSetup2fa: boolean;
}

interface TwoFactorPendingResult {
  requires2fa: true;
  tempToken: string;
}

export type MagicLinkResult = MagicLinkAuthResult | TwoFactorPendingResult;

export async function requestMagicLink(email: string, locale: string): Promise<void> {
  const prisma = getClient();

  // Check if user exists and is active — silently skip disabled/deleted accounts
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { isActive: true, deletedAt: true },
  });

  if (existingUser && (!existingUser.isActive || existingUser.deletedAt)) {
    return;
  }

  // Invalidate any pending magic links for this email
  await prisma.magicLinkToken.updateMany({
    where: {
      email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  const { raw, hash } = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + config.auth.magicLinkExpiry);

  // Create token with email only — NO user creation.
  // User is created on verify, after email ownership is proven.
  await prisma.magicLinkToken.create({
    data: {
      email,
      tokenHash: hash,
      expiresAt,
    },
  });

  await sendMagicLinkEmail(email, raw, locale);
}

export async function verifyMagicLink(
  token: string,
  deviceName?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<MagicLinkResult> {
  const prisma = getClient();
  const tokenHash = hashToken(token);

  // Atomic compare-and-swap: find token WHERE usedAt IS NULL and mark used in one step.
  // Prevents double-use from concurrent requests (e.g., user double-clicking magic link).
  const now = new Date();
  const consumed = await prisma.magicLinkToken.updateMany({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  if (consumed.count === 0) {
    throw new AuthError('INVALID_TOKEN', 'auth.magic_link.invalid', 401);
  }

  // Fetch the token record for the email
  const magicLink = await prisma.magicLinkToken.findFirst({
    where: { tokenHash },
  });

  if (!magicLink) {
    throw new AuthError('INVALID_TOKEN', 'auth.magic_link.invalid', 401);
  }

  // Find or create user — email ownership is now proven
  let user = await prisma.user.findUnique({
    where: { email: magicLink.email },
  });

  let isNewUser = false;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: magicLink.email,
        locale: 'en',
        region: 'EU',
        isActive: true,
        emailVerified: true,
      },
    });
    isNewUser = true;
  } else {
    // Block deleted users
    if (user.deletedAt) {
      throw new AuthError('ACCOUNT_DELETED', 'auth.magic_link.invalid', 401);
    }

    // Mark email as verified if not already
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    isNewUser = !user.displayName;
  }

  // Link token to user for audit trail
  await prisma.magicLinkToken.update({
    where: { id: magicLink.id },
    data: { userId: user.id },
  });

  // 2FA check: if user has TOTP enabled, require verification before session
  if (user.totpEnabled) {
    const { SignJWT } = await import('jose');
    const jwtSecret = new TextEncoder().encode(config.auth.jwtSecret);
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
      .sign(jwtSecret);

    return { requires2fa: true, tempToken };
  }

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
    },
    isNewUser,
    requiresSetup2fa: !user.totpEnabled,
  };
}

export async function refreshSession(
  sessionId: string,
  userId: string,
  region: string,
): Promise<TokenPair> {
  const prisma = getClient();

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) {
    throw new AuthError('SESSION_EXPIRED', 'auth.session.expired', 401);
  }

  // Verify user is still active — prevents disabled/deleted accounts from refreshing
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, deletedAt: true },
  });

  if (!user || !user.isActive || user.deletedAt) {
    // Revoke all sessions for disabled/deleted accounts
    await prisma.session.deleteMany({ where: { userId } });
    throw new AuthError('ACCOUNT_DISABLED', 'auth.account.disabled', 401);
  }

  // Rotate: invalidate old session, create new one (prevents token reuse)
  // Wrapped in transaction to prevent race condition on concurrent refresh
  const refreshExpiry = parseExpiry(config.auth.refreshTokenExpiry);

  const newSession = await prisma.$transaction(async (tx) => {
    await tx.session.delete({ where: { id: session.id } });

    return tx.session.create({
      data: {
        userId,
        region: session.region,
        expiresAt: new Date(Date.now() + refreshExpiry),
        deviceName: session.deviceName,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    });
  });

  const tokenPayload = { userId, region, sessionId: newSession.id };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ]);

  return { accessToken, refreshToken };
}

export async function logout(sessionId: string, userId: string): Promise<void> {
  const prisma = getClient();

  await prisma.session.deleteMany({
    where: { id: sessionId, userId },
  });
}

export async function logoutAll(userId: string): Promise<void> {
  const prisma = getClient();

  await prisma.session.deleteMany({
    where: { userId },
  });
}

export async function selectRegion(userId: string, region: 'EU' | 'GLOBAL'): Promise<void> {
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'common.error', 404);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { region },
  });

  await prisma.session.updateMany({
    where: { userId },
    data: { region },
  });
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly translationKey: string,
    public readonly statusCode: number,
  ) {
    super(code);
    this.name = 'AuthError';
  }
}
