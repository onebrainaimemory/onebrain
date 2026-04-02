import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getClient } from '@onebrain/db';
import { signAccessToken, signRefreshToken, parseExpiry } from '../lib/tokens.js';
import { config } from '../config.js';
import { AuthError } from './auth.service.js';
import { audit } from '../lib/audit.js';
import { maskIp } from '../lib/pii-mask.js';

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';

const googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));
const appleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URI));

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface OAuthResult {
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

interface GoogleIdTokenPayload {
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  sub: string;
}

interface AppleIdTokenPayload {
  email: string;
  email_verified: string | boolean;
  sub: string;
}

/**
 * Verifies a Google ID token and returns the claims.
 */
async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
  const clientId = config.oauth.google.clientId;
  if (!clientId) {
    throw new AuthError('OAUTH_NOT_CONFIGURED', 'auth.oauth.error', 400);
  }

  try {
    const { payload } = await jwtVerify(idToken, googleJWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });

    const email = payload['email'] as string | undefined;
    if (!email) {
      throw new AuthError('OAUTH_MISSING_EMAIL', 'auth.oauth.error', 400);
    }

    return {
      email,
      email_verified: (payload['email_verified'] as boolean) ?? false,
      name: payload['name'] as string | undefined,
      picture: payload['picture'] as string | undefined,
      sub: payload.sub as string,
    };
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }
    throw new AuthError('OAUTH_INVALID_TOKEN', 'auth.oauth.error', 401);
  }
}

/**
 * Verifies an Apple ID token and returns the claims.
 */
async function verifyAppleIdToken(idToken: string): Promise<AppleIdTokenPayload> {
  const clientId = config.oauth.apple.clientId;
  if (!clientId) {
    throw new AuthError('OAUTH_NOT_CONFIGURED', 'auth.oauth.error', 400);
  }

  try {
    const { payload } = await jwtVerify(idToken, appleJWKS, {
      issuer: 'https://appleid.apple.com',
      audience: clientId,
    });

    const email = payload['email'] as string | undefined;
    if (!email) {
      throw new AuthError('OAUTH_MISSING_EMAIL', 'auth.oauth.error', 400);
    }

    return {
      email,
      email_verified: (payload['email_verified'] as string | boolean) ?? false,
      sub: payload.sub as string,
    };
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }
    throw new AuthError('OAUTH_INVALID_TOKEN', 'auth.oauth.error', 401);
  }
}

/**
 * Creates or finds a user by email, creates a session,
 * and returns tokens. Shared logic for all OAuth providers.
 */
async function findOrCreateUserAndSession(opts: {
  email: string;
  emailVerified: boolean;
  displayName?: string;
  locale: string;
  provider: 'google' | 'apple' | 'github';
  providerSub: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<OAuthResult> {
  const prisma = getClient();

  let user = await prisma.user.findUnique({
    where: { email: opts.email },
  });

  let isNewUser = false;

  if (user) {
    if (!user.isActive || user.deletedAt) {
      throw new AuthError('ACCOUNT_DISABLED', 'auth.oauth.error', 401);
    }

    if (opts.emailVerified && !user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
      user = { ...user, emailVerified: true };
    }
  } else {
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        email: opts.email,
        displayName: opts.displayName ?? null,
        locale: (opts.locale as 'de' | 'en' | 'es') || 'en',
        region: 'EU',
        isActive: true,
        emailVerified: opts.emailVerified,
      },
    });

    const freePlan = await prisma.plan.findUnique({
      where: { name: 'free' },
    });
    if (freePlan) {
      await prisma.userPlan.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          isActive: true,
        },
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
  }

  const refreshExpiry = parseExpiry(config.auth.refreshTokenExpiry);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      region: user.region,
      expiresAt: new Date(Date.now() + refreshExpiry),
      deviceName: opts.deviceName ?? null,
      ipAddress: opts.ipAddress ? maskIp(opts.ipAddress) : null,
      userAgent: opts.userAgent ?? null,
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

  audit(
    user.id,
    isNewUser ? 'oauth_register' : 'oauth_login',
    'user',
    user.id,
    { provider: opts.provider },
    opts.ipAddress,
    opts.userAgent,
  );

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
    isNewUser,
  };
}

/**
 * Authenticates a user via Google OAuth ID token.
 * Creates the user if they do not exist.
 */
export async function loginWithGoogle(opts: {
  idToken: string;
  locale: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<OAuthResult> {
  const claims = await verifyGoogleIdToken(opts.idToken);

  return findOrCreateUserAndSession({
    email: claims.email,
    emailVerified: claims.email_verified,
    displayName: claims.name,
    locale: opts.locale,
    provider: 'google',
    providerSub: claims.sub,
    deviceName: opts.deviceName,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  });
}

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

interface GitHubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Exchanges a GitHub OAuth code for an access token,
 * then fetches the user's email from the GitHub API.
 */
async function exchangeGitHubCode(code: string): Promise<{
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  sub: string;
}> {
  const clientId = config.oauth.github.clientId;
  const clientSecret = config.oauth.github.clientSecret;
  if (!clientId || !clientSecret) {
    throw new AuthError('OAUTH_NOT_CONFIGURED', 'auth.oauth.error', 400);
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    throw new AuthError('OAUTH_INVALID_TOKEN', 'auth.oauth.error', 401);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    throw new AuthError('OAUTH_INVALID_TOKEN', 'auth.oauth.error', 401);
  }

  const headers = {
    Authorization: `Bearer ${tokenData.access_token}`,
    Accept: 'application/json',
    'User-Agent': 'OneBrain',
  };

  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers }),
    fetch('https://api.github.com/user/emails', { headers }),
  ]);

  if (!userRes.ok || !emailsRes.ok) {
    throw new AuthError('OAUTH_INVALID_TOKEN', 'auth.oauth.error', 401);
  }

  const userData = (await userRes.json()) as GitHubUserResponse;
  const emailsData = (await emailsRes.json()) as GitHubEmailResponse[];

  const primaryEmail = emailsData.find((e) => e.primary && e.verified);
  const email = primaryEmail?.email ?? userData.email;

  if (!email) {
    throw new AuthError('OAUTH_MISSING_EMAIL', 'auth.oauth.error', 400);
  }

  return {
    email,
    emailVerified: primaryEmail?.verified ?? false,
    displayName: userData.name ?? userData.login,
    sub: String(userData.id),
  };
}

/**
 * Authenticates a user via GitHub OAuth code exchange.
 * Creates the user if they do not exist.
 */
export async function loginWithGitHub(opts: {
  code: string;
  locale: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<OAuthResult> {
  const claims = await exchangeGitHubCode(opts.code);

  return findOrCreateUserAndSession({
    email: claims.email,
    emailVerified: claims.emailVerified,
    displayName: claims.displayName ?? undefined,
    locale: opts.locale,
    provider: 'github',
    providerSub: claims.sub,
    deviceName: opts.deviceName,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  });
}

/**
 * Authenticates a user via Apple OAuth ID token.
 * Creates the user if they do not exist.
 */
export async function loginWithApple(opts: {
  idToken: string;
  locale: string;
  displayName?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<OAuthResult> {
  const claims = await verifyAppleIdToken(opts.idToken);

  const isVerified = claims.email_verified === true || claims.email_verified === 'true';

  return findOrCreateUserAndSession({
    email: claims.email,
    emailVerified: isVerified,
    displayName: opts.displayName,
    locale: opts.locale,
    provider: 'apple',
    providerSub: claims.sub,
    deviceName: opts.deviceName,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  });
}
