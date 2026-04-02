import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  requestMagicLinkSchema,
  verifyMagicLinkSchema,
  selectRegionSchema,
} from '@onebrain/schemas';
import { getTranslations, t } from '@onebrain/i18n';
import {
  requestMagicLink,
  verifyMagicLink,
  refreshSession,
  logout,
  logoutAll,
  selectRegion,
  AuthError,
} from '../services/auth.service.js';
import { verifyToken } from '../lib/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  COOKIE_BASE_PATH,
} from '../lib/auth-cookies.js';
import { parseDeviceName } from '../services/session.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/auth/magic-link',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const parsed = requestMagicLinkSchema.safeParse(request.body);
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

      const { email, locale } = parsed.data;

      try {
        await requestMagicLink(email, locale);
      } catch (err) {
        request.log.error(err, 'Failed to send magic link');
      }

      const translations = await getTranslations(locale);
      return reply.status(200).send(success({ message: t(translations, 'auth.magic_link.sent') }));
    },
  );

  app.post(
    '/v1/auth/verify',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const parsed = verifyMagicLinkSchema.safeParse(request.body);
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
        const userAgent = request.headers['user-agent'];
        const deviceName = parseDeviceName(userAgent);
        const result = await verifyMagicLink(parsed.data.token, deviceName, request.ip, userAgent);

        // 2FA required — set temp token cookie, no session
        if ('requires2fa' in result) {
          const IS_PROD = process.env['NODE_ENV'] === 'production';
          reply.setCookie('2fa_token', result.tempToken, {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'strict',
            path: `${COOKIE_BASE_PATH}/v1/auth/2fa`,
            maxAge: 300,
          });
          return reply.status(200).send(success({ requires2fa: true }));
        }

        const translations = await getTranslations(result.user.locale);

        setAccessTokenCookie(reply, result.tokens.accessToken);
        setRefreshTokenCookie(reply, result.tokens.refreshToken);

        return reply.status(200).send(
          success({
            accessToken: result.tokens.accessToken,
            user: result.user,
            isNewUser: result.isNewUser,
            requiresSetup2fa: result.requiresSetup2fa,
            message: t(translations, 'auth.magic_link.success'),
          }),
        );
      } catch (err) {
        if (err instanceof AuthError) {
          const translations = await getTranslations('en');
          const res = error(err.code, t(translations, err.translationKey), err.statusCode);
          return reply.status(res.statusCode).send(res.body);
        }
        throw err;
      }
    },
  );

  app.post(
    '/v1/auth/refresh',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const cookieToken = (request.cookies as Record<string, string>)['refreshToken'];
      const refreshTokenValue = cookieToken;

      if (!refreshTokenValue) {
        const res = error('MISSING_REFRESH_TOKEN', 'No refresh token provided', 401);
        return reply.status(res.statusCode).send(res.body);
      }

      // CSRF protection: cookie-based refresh requires X-Requested-With header
      const xRequestedWith = request.headers['x-requested-with'];
      if (!xRequestedWith) {
        const res = error('CSRF_VALIDATION', 'Missing X-Requested-With header', 403);
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        const payload = await verifyToken(refreshTokenValue);

        if (payload.type !== 'refresh') {
          const res = error('INVALID_TOKEN_TYPE', 'Expected refresh token', 401);
          return reply.status(res.statusCode).send(res.body);
        }

        const tokens = await refreshSession(payload.sessionId, payload.sub, payload.region);

        setAccessTokenCookie(reply, tokens.accessToken);
        setRefreshTokenCookie(reply, tokens.refreshToken);

        return reply.status(200).send(success({ accessToken: tokens.accessToken }));
      } catch (err) {
        if (err instanceof AuthError) {
          const res = error(err.code, err.code, err.statusCode);
          return reply.status(res.statusCode).send(res.body);
        }
        const res = error('TOKEN_EXPIRED', 'Refresh token expired or invalid', 401);
        return reply.status(res.statusCode).send(res.body);
      }
    },
  );

  app.post('/v1/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    await logout(request.sessionId, request.userId);

    reply.clearCookie('accessToken', { path: '/v1' });
    reply.clearCookie('refreshToken', { path: '/v1/auth' });

    const translations = await getTranslations('en');
    return reply.status(200).send(success({ message: t(translations, 'auth.logout.success') }));
  });

  app.post('/v1/auth/logout-all', { preHandler: requireAuth }, async (request, reply) => {
    await logoutAll(request.userId);

    reply.clearCookie('accessToken', { path: '/v1' });
    reply.clearCookie('refreshToken', { path: '/v1/auth' });

    return reply.status(200).send(success({ message: 'All sessions terminated' }));
  });

  app.post('/v1/auth/region', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = selectRegionSchema.safeParse(request.body);
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
      await selectRegion(request.userId, parsed.data.region);
      return reply.status(200).send(success({ region: parsed.data.region }));
    } catch (err) {
      if (err instanceof AuthError) {
        const res = error(err.code, err.code, err.statusCode);
        return reply.status(res.statusCode).send(res.body);
      }
      throw err;
    }
  });

  /**
   * Demo login — development only.
   * Route is not registered in production at all.
   */
  if (process.env['NODE_ENV'] !== 'production') {
    const demoLogin = async (
      reply: FastifyReply,
      opts: {
        email: string;
        displayName: string;
        role: 'admin' | 'user';
        summary: string;
      },
    ) => {
      const { getClient } = await import('@onebrain/db');
      const { signAccessToken, signRefreshToken } = await import('../lib/tokens.js');
      const prisma = getClient();

      let user = await prisma.user.findUnique({
        where: { email: opts.email },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: opts.email,
            displayName: opts.displayName,
            locale: 'en',
            region: 'EU',
            role: opts.role,
            isActive: true,
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
            summary: opts.summary,
            traits: {},
            preferences: {},
          },
        });
      }

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          region: user.region,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

      setAccessTokenCookie(reply, accessToken);
      setRefreshTokenCookie(reply, refreshToken);

      return reply.status(200).send(
        success({
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            region: user.region,
            locale: user.locale,
            role: user.role,
          },
          isNewUser: false,
        }),
      );
    };

    app.post(
      '/v1/auth/demo-login',
      { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
      async (_request, reply) => {
        return demoLogin(reply, {
          email: 'admin@onebrain.demo',
          displayName: 'Demo Admin',
          role: 'admin',
          summary: 'Demo admin user for OneBrain development.',
        });
      },
    );

    app.post(
      '/v1/auth/demo-user-login',
      { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
      async (_request, reply) => {
        return demoLogin(reply, {
          email: 'user@onebrain.demo',
          displayName: 'Demo User',
          role: 'user',
          summary:
            'Full Stack Entwickler mit 30 Jahren Programmiererfahrung. Spezialisiert auf TypeScript, React und Node.js. Bevorzugt pragmatische Lösungen und sauberen Code.',
        });
      },
    );
  } // end demo-login production guard

  app.get('/v1/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const { getClient } = await import('@onebrain/db');
    const prisma = getClient();

    const user = await prisma.user.findUnique({
      where: { id: request.userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        displayName: true,
        region: true,
        locale: true,
        role: true,
        createdAt: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      const res = error('USER_NOT_FOUND', 'User not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    return reply.status(200).send(success(user));
  });
}
