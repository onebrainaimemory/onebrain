import type { FastifyInstance } from 'fastify';
import {
  registerWithPasswordSchema,
  loginWithPasswordSchema,
  verifyEmailSchema,
} from '@onebrain/schemas';
import { getTranslations, t } from '@onebrain/i18n';
import {
  registerWithPassword,
  loginWithPassword,
  verifyEmailToken,
  resendVerificationEmail,
} from '../services/password.service.js';
import { AuthError } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  COOKIE_BASE_PATH,
} from '../lib/auth-cookies.js';
import { parseDeviceName } from '../services/session.service.js';

export async function passwordAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/auth/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = registerWithPasswordSchema.safeParse(request.body);
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

      const { email, password, displayName, locale } = parsed.data;

      try {
        const result = await registerWithPassword(email, password, locale, displayName);

        const translations = await getTranslations(locale);

        setAccessTokenCookie(reply, result.tokens.accessToken);
        setRefreshTokenCookie(reply, result.tokens.refreshToken);

        return reply.status(201).send(
          success({
            accessToken: result.tokens.accessToken,
            user: result.user,
            isNewUser: result.isNewUser,
            message: t(translations, 'auth.register.success'),
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
    '/v1/auth/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = loginWithPasswordSchema.safeParse(request.body);
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

      const { email, password } = parsed.data;
      const userAgent = request.headers['user-agent'];
      const deviceName = parseDeviceName(userAgent);
      const ipAddress = request.ip;

      try {
        const result = await loginWithPassword(email, password, deviceName, ipAddress, userAgent);

        if ('requires2fa' in result) {
          const IS_PROD = process.env['NODE_ENV'] === 'production';
          reply.setCookie('2fa_token', result.tempToken, {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'strict',
            path: `${COOKIE_BASE_PATH}/v1/auth/2fa`,
            maxAge: 300, // 5 minutes — matches JWT expiry
          });
          return reply.status(200).send(
            success({
              requires2fa: true,
            }),
          );
        }

        setAccessTokenCookie(reply, result.tokens.accessToken);
        setRefreshTokenCookie(reply, result.tokens.refreshToken);

        return reply.status(200).send(
          success({
            accessToken: result.tokens.accessToken,
            user: result.user,
            isNewUser: result.isNewUser,
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
    '/v1/auth/verify-email',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const parsed = verifyEmailSchema.safeParse(request.body);
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
        await verifyEmailToken(parsed.data.token);
        const translations = await getTranslations('en');
        return reply.status(200).send(
          success({
            message: t(translations, 'auth.email_verify.success'),
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
    '/v1/auth/resend-verification',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 3, timeWindow: '5 minutes' } },
    },
    async (request, reply) => {
      try {
        await resendVerificationEmail(request.userId);
        const translations = await getTranslations('en');
        return reply.status(200).send(
          success({
            message: t(translations, 'auth.email_verify.resent'),
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
}
