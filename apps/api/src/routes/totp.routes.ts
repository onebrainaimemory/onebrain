import type { FastifyInstance } from 'fastify';
import { verifyTotpSchema, disableTotpSchema, validateTotpLoginSchema } from '@onebrain/schemas';
import { getTranslations, t } from '@onebrain/i18n';
import {
  setupTotp,
  enableTotp,
  disableTotp,
  validateTotpForLogin,
} from '../services/totp.service.js';
import { createSessionAndTokens } from '../services/password.service.js';
import { AuthError } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  COOKIE_BASE_PATH,
} from '../lib/auth-cookies.js';
import { config } from '../config.js';
import { parseDeviceName } from '../services/session.service.js';

export async function totpRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/auth/2fa/setup',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // Guard: if middleware failed to set userId, return 401 immediately
      if (!request.userId) {
        const res = error('UNAUTHORIZED', 'Authentication required', 401);
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        const result = await setupTotp(request.userId);
        return reply.status(200).send(
          success({
            secret: result.secret,
            otpauthUrl: result.otpauthUrl,
          }),
        );
      } catch (err) {
        if (reply.sent) return reply;
        try {
          if (err instanceof AuthError) {
            const translations = await getTranslations('en');
            const res = error(err.code, t(translations, err.translationKey), err.statusCode);
            return reply.status(res.statusCode).send(res.body);
          }
        } catch {
          // getTranslations failed — continue to fallback
        }
        if (reply.sent) return reply;
        request.log.error(err, '2FA setup failed');
        const msg = err instanceof Error ? err.message : '2FA setup failed';
        return reply.status(500).send({
          error: { code: 'TOTP_SETUP_FAILED', message: msg },
          meta: { requestId: request.id },
        });
      }
    },
  );

  app.post(
    '/v1/auth/2fa/verify',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      if (!request.userId) {
        const res = error('UNAUTHORIZED', 'Authentication required', 401);
        return reply.status(res.statusCode).send(res.body);
      }

      const parsed = verifyTotpSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request body',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        await enableTotp(request.userId, parsed.data.code);
        const translations = await getTranslations('en');
        return reply.status(200).send(
          success({
            message: t(translations, 'auth.2fa.enabled'),
          }),
        );
      } catch (err) {
        if (reply.sent) return reply;
        try {
          if (err instanceof AuthError) {
            const translations = await getTranslations('en');
            const res = error(err.code, t(translations, err.translationKey), err.statusCode);
            return reply.status(res.statusCode).send(res.body);
          }
        } catch {
          // translation failed
        }
        if (reply.sent) return reply;
        request.log.error(err, '2FA verify failed');
        const msg = err instanceof Error ? err.message : '2FA verification failed';
        return reply.status(500).send({
          error: { code: 'TOTP_VERIFY_FAILED', message: msg },
          meta: { requestId: request.id },
        });
      }
    },
  );

  app.post(
    '/v1/auth/2fa/disable',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      if (!request.userId) {
        const res = error('UNAUTHORIZED', 'Authentication required', 401);
        return reply.status(res.statusCode).send(res.body);
      }

      const parsed = disableTotpSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request body',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        await disableTotp(request.userId, parsed.data.code);
        const translations = await getTranslations('en');
        return reply.status(200).send(
          success({
            message: t(translations, 'auth.2fa.disabled'),
          }),
        );
      } catch (err) {
        if (reply.sent) return reply;
        try {
          if (err instanceof AuthError) {
            const translations = await getTranslations('en');
            const res = error(err.code, t(translations, err.translationKey), err.statusCode);
            return reply.status(res.statusCode).send(res.body);
          }
        } catch {
          // translation failed
        }
        if (reply.sent) return reply;
        request.log.error(err, '2FA disable failed');
        const msg = err instanceof Error ? err.message : '2FA disable failed';
        return reply.status(500).send({
          error: { code: 'TOTP_DISABLE_FAILED', message: msg },
          meta: { requestId: request.id },
        });
      }
    },
  );

  app.post(
    '/v1/auth/2fa/validate',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = validateTotpLoginSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request body',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { code } = parsed.data;

      // Read 2FA token from httpOnly cookie (preferred) or body (backward compat)
      const cookieToken = (request.cookies as Record<string, string | undefined>)['2fa_token'];
      const tempToken = cookieToken ?? parsed.data.tempToken;

      if (!tempToken) {
        const res = error('MISSING_2FA_TOKEN', 'No 2FA token provided', 401);
        return reply.status(res.statusCode).send(res.body);
      }

      // CSRF protection when using cookie-based token
      if (cookieToken) {
        const xRequestedWith = request.headers['x-requested-with'];
        if (!xRequestedWith) {
          const res = error('CSRF_VALIDATION', 'Missing X-Requested-With header', 403);
          return reply.status(res.statusCode).send(res.body);
        }
      }

      try {
        const { jwtVerify } = await import('jose');
        const secret = new TextEncoder().encode(config.auth.jwtSecret);
        const { payload } = await jwtVerify(tempToken, secret, {
          issuer: 'onebrain',
          audience: 'onebrain-2fa',
        });

        if (payload['type'] !== '2fa_pending') {
          const res = error('INVALID_TOKEN_TYPE', 'Expected 2FA pending token', 401);
          return reply.status(res.statusCode).send(res.body);
        }

        const userId = payload.sub as string;
        await validateTotpForLogin(userId, code);

        const { getClient } = await import('@onebrain/db');
        const prisma = getClient();
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            displayName: true,
            region: true,
            locale: true,
            role: true,
            emailVerified: true,
          },
        });

        if (!user) {
          const res = error('USER_NOT_FOUND', 'User not found', 404);
          return reply.status(res.statusCode).send(res.body);
        }

        const userAgent = request.headers['user-agent'];
        const deviceName = parseDeviceName(userAgent);

        const result = await createSessionAndTokens(user, deviceName, request.ip, userAgent);

        // Clear 2FA cookie after successful validation
        reply.clearCookie('2fa_token', { path: `${COOKIE_BASE_PATH}/v1/auth/2fa` });

        setAccessTokenCookie(reply, result.tokens.accessToken);
        setRefreshTokenCookie(reply, result.tokens.refreshToken);

        return reply.status(200).send(
          success({
            accessToken: result.tokens.accessToken,
            user: result.user,
            isNewUser: false,
          }),
        );
      } catch (err) {
        if (err instanceof AuthError) {
          const translations = await getTranslations('en');
          const res = error(err.code, t(translations, err.translationKey), err.statusCode);
          return reply.status(res.statusCode).send(res.body);
        }

        const res = error('INVALID_2FA_TOKEN', 'Invalid or expired 2FA token', 401);
        return reply.status(res.statusCode).send(res.body);
      }
    },
  );
}
