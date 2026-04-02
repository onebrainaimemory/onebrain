import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../lib/tokens.js';
import { error } from '../lib/response.js';
import { parseApiKeyHeader, verifyApiKey, hasScope } from '../services/api-key.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    region: string;
    sessionId: string;
    userRole?: string;
    /** Set when authenticated via API key */
    apiKeyScopes?: string[];
  }
}

/**
 * Auth middleware: supports Bearer JWT, ApiKey, and httpOnly cookie.
 * Wrapped in try-catch so errors NEVER reach the global error handler.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | void> {
  try {
    return await doAuth(request, reply);
  } catch (err) {
    request.log.error({ err, url: request.url }, 'AUTH MIDDLEWARE CRASH');
    if (reply.sent) return reply;
    const res = error(
      'AUTH_ERROR',
      'Authentication failed. Get a valid token at https://onebrain.rocks',
      401,
      undefined,
      [{ tokenUrl: 'https://onebrain.rocks', register: 'POST /v1/agents/register' }],
    );
    return reply.status(res.statusCode).send(res.body);
  }
}

async function doAuth(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> {
  const authHeader = request.headers.authorization;

  // Try API key auth first
  if (authHeader?.startsWith('ApiKey ')) {
    const parsed = parseApiKeyHeader(authHeader);
    if (!parsed) {
      const res = error(
        'INVALID_API_KEY',
        'Malformed API key. Get a valid token at https://onebrain.rocks',
        401,
        undefined,
        [
          {
            tokenUrl: 'https://onebrain.rocks',
            register: 'POST /v1/agents/register',
            hint: 'API key format: "ApiKey ob_<prefix>_<secret>"',
          },
        ],
      );
      return reply.status(res.statusCode).send(res.body);
    }

    const keyResult = await verifyApiKey(parsed.prefix, parsed.secret);
    if (!keyResult) {
      const res = error(
        'INVALID_API_KEY',
        'Invalid or expired API key. Generate a new one at https://onebrain.rocks',
        401,
        undefined,
        [
          {
            tokenUrl: 'https://onebrain.rocks',
            register: 'POST /v1/agents/register',
            hint: 'Sign in to manage your API keys',
          },
        ],
      );
      return reply.status(res.statusCode).send(res.body);
    }

    request.userId = keyResult.userId;
    request.sessionId = `apikey:${keyResult.keyId}`;

    // Derive region from user record instead of hardcoding
    const { getClient } = await import('@onebrain/db');
    const prisma = getClient();
    const apiKeyUser = await prisma.user.findUnique({
      where: { id: keyResult.userId },
      select: { region: true },
    });
    request.region = apiKeyUser?.region ?? 'EU';
    request.apiKeyScopes = keyResult.scopes;
    return;
  }

  // Detect common mistake: Bearer used with API key format
  if (authHeader?.startsWith('Bearer ob_')) {
    const res = error(
      'WRONG_AUTH_SCHEME',
      'You are using "Bearer" with an API key. Use "Authorization: ApiKey ob_..." instead of "Authorization: Bearer ob_..."',
      401,
      undefined,
      [
        {
          hint: 'Replace "Bearer" with "ApiKey" in your Authorization header',
          example: `Authorization: ApiKey ${authHeader.slice(7)}`,
        },
      ],
    );
    return reply.status(res.statusCode).send(res.body);
  }

  // Bearer JWT from header
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return authenticateJwt(request, reply, token);
  }

  // httpOnly cookie fallback (browser sessions)
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  const cookieToken = cookies?.['accessToken'];
  if (cookieToken) {
    // CSRF protection: browser requests must include X-Requested-With
    const xRequestedWith = request.headers['x-requested-with'];
    if (!xRequestedWith) {
      const res = error('CSRF_VALIDATION', 'Missing X-Requested-With header', 403);
      return reply.status(res.statusCode).send(res.body);
    }
    return authenticateJwt(request, reply, cookieToken);
  }

  // No auth provided — direct agents to token registration
  if (!authHeader) {
    const res = error(
      'TOKEN_REQUIRED',
      'No API token provided. Get your token at https://onebrain.rocks',
      401,
      undefined,
      [
        {
          tokenUrl: 'https://onebrain.rocks',
          register: 'POST /v1/agents/register',
          hint: 'Register or sign in to generate an API key',
        },
      ],
    );
    return reply.status(res.statusCode).send(res.body);
  }

  const res = error(
    'INVALID_AUTH_SCHEME',
    'Invalid authorization scheme. Get a valid token at https://onebrain.rocks',
    401,
    undefined,
    [
      {
        tokenUrl: 'https://onebrain.rocks',
        register: 'POST /v1/agents/register',
        hint: 'Use "ApiKey <key>" or "Bearer <jwt>" format',
      },
    ],
  );
  return reply.status(res.statusCode).send(res.body);
}

async function authenticateJwt(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string,
): Promise<FastifyReply | void> {
  try {
    const payload = await verifyToken(token);

    if (payload.type !== 'access') {
      const res = error('INVALID_TOKEN_TYPE', 'Expected access token', 401);
      return reply.status(res.statusCode).send(res.body);
    }

    request.userId = payload.sub;
    request.region = payload.region;
    request.sessionId = payload.sessionId;
    request.userRole = payload.role;
  } catch {
    const res = error(
      'TOKEN_EXPIRED',
      'Token expired or invalid. Get a new token at https://onebrain.rocks',
      401,
      undefined,
      [
        {
          tokenUrl: 'https://onebrain.rocks',
          register: 'POST /v1/agents/register',
          hint: 'Sign in to refresh your access token',
        },
      ],
    );
    return reply.status(res.statusCode).send(res.body);
  }
}

/**
 * Scope enforcement middleware factory.
 * JWT-authenticated requests pass through (full access).
 */
export function requireScope(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    if (!request.apiKeyScopes) return;

    if (!hasScope(request.apiKeyScopes, scope)) {
      const res = error('INSUFFICIENT_SCOPE', `API key missing required scope: ${scope}`, 403);
      return reply.status(res.statusCode).send(res.body);
    }
  };
}

/**
 * Admin role enforcement. Must be used after requireAuth.
 * Checks role from JWT claim, falls back to DB lookup.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | void> {
  try {
    // API key auth is not allowed on admin routes
    if (request.apiKeyScopes) {
      const res = error('FORBIDDEN', 'Admin routes require interactive session', 403);
      return reply.status(res.statusCode).send(res.body);
    }

    // First check JWT role claim for fast path
    if (request.userRole === 'admin') return;

    // Fallback: check DB
    const { getClient } = await import('@onebrain/db');
    const prisma = getClient();
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { role: true },
    });

    if (!user || user.role !== 'admin') {
      const res = error('FORBIDDEN', 'Admin access required', 403);
      return reply.status(res.statusCode).send(res.body);
    }

    request.userRole = 'admin';
  } catch (err) {
    request.log.error({ err }, 'ADMIN MIDDLEWARE CRASH');
    if (reply.sent) return reply;
    const res = error('AUTH_ERROR', 'Authorization check failed', 500);
    return reply.status(res.statusCode).send(res.body);
  }
}
