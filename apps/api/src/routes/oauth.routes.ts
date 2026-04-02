import type { FastifyInstance } from 'fastify';
import { googleOAuthSchema, appleOAuthSchema, githubOAuthSchema } from '@onebrain/schemas';
import { getTranslations, t } from '@onebrain/i18n';
import { loginWithGoogle, loginWithApple, loginWithGitHub } from '../services/oauth.service.js';
import { AuthError } from '../services/auth.service.js';
import { success, error } from '../lib/response.js';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../lib/auth-cookies.js';
import { parseDeviceName } from '../services/session.service.js';

export async function oauthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/auth/oauth/google',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = googleOAuthSchema.safeParse(request.body);
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

      const { idToken, locale } = parsed.data;
      const userAgent = request.headers['user-agent'];
      const deviceName = parseDeviceName(userAgent);

      try {
        const result = await loginWithGoogle({
          idToken,
          locale,
          deviceName,
          ipAddress: request.ip,
          userAgent,
        });

        const translations = await getTranslations(locale);

        setAccessTokenCookie(reply, result.tokens.accessToken);
        setRefreshTokenCookie(reply, result.tokens.refreshToken);

        const statusCode = result.isNewUser ? 201 : 200;
        return reply.status(statusCode).send(
          success({
            accessToken: result.tokens.accessToken,
            user: result.user,
            isNewUser: result.isNewUser,
            message: t(translations, 'auth.oauth.success'),
          }),
        );
      } catch (err) {
        if (err instanceof AuthError) {
          const translations = await getTranslations(locale ?? 'en');
          const res = error(err.code, t(translations, err.translationKey), err.statusCode);
          return reply.status(res.statusCode).send(res.body);
        }
        throw err;
      }
    },
  );

  app.post(
    '/v1/auth/oauth/apple',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = appleOAuthSchema.safeParse(request.body);
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

      const { idToken, locale, displayName } = parsed.data;
      const userAgent = request.headers['user-agent'];
      const deviceName = parseDeviceName(userAgent);

      try {
        const result = await loginWithApple({
          idToken,
          locale,
          displayName,
          deviceName,
          ipAddress: request.ip,
          userAgent,
        });

        const translations = await getTranslations(locale);

        setAccessTokenCookie(reply, result.tokens.accessToken);
        setRefreshTokenCookie(reply, result.tokens.refreshToken);

        const statusCode = result.isNewUser ? 201 : 200;
        return reply.status(statusCode).send(
          success({
            accessToken: result.tokens.accessToken,
            user: result.user,
            isNewUser: result.isNewUser,
            message: t(translations, 'auth.oauth.success'),
          }),
        );
      } catch (err) {
        if (err instanceof AuthError) {
          const translations = await getTranslations(locale ?? 'en');
          const res = error(err.code, t(translations, err.translationKey), err.statusCode);
          return reply.status(res.statusCode).send(res.body);
        }
        throw err;
      }
    },
  );

  app.post(
    '/v1/auth/oauth/github',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = githubOAuthSchema.safeParse(request.body);
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

      const { code, locale } = parsed.data;
      const userAgent = request.headers['user-agent'];
      const deviceName = parseDeviceName(userAgent);

      try {
        const result = await loginWithGitHub({
          code,
          locale,
          deviceName,
          ipAddress: request.ip,
          userAgent,
        });

        const translations = await getTranslations(locale);

        setAccessTokenCookie(reply, result.tokens.accessToken);
        setRefreshTokenCookie(reply, result.tokens.refreshToken);

        const statusCode = result.isNewUser ? 201 : 200;
        return reply.status(statusCode).send(
          success({
            accessToken: result.tokens.accessToken,
            user: result.user,
            isNewUser: result.isNewUser,
            message: t(translations, 'auth.oauth.success'),
          }),
        );
      } catch (err) {
        if (err instanceof AuthError) {
          const translations = await getTranslations(locale ?? 'en');
          const res = error(err.code, t(translations, err.translationKey), err.statusCode);
          return reply.status(res.statusCode).send(res.body);
        }
        throw err;
      }
    },
  );
}
