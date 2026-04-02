import type { FastifyInstance } from 'fastify';
import { uuidSchema } from '@onebrain/schemas';
import { getTranslations, t } from '@onebrain/i18n';
import { listSessions, revokeSession } from '../services/session.service.js';
import { AuthError } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/auth/sessions', { preHandler: requireAuth }, async (request, reply) => {
    const sessions = await listSessions(request.userId, request.sessionId);

    return reply.status(200).send(success(sessions));
  });

  app.delete('/v1/auth/sessions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id: string };
    const parsed = uuidSchema.safeParse(params.id);

    if (!parsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid session ID', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    try {
      await revokeSession(request.userId, parsed.data, request.sessionId);

      const translations = await getTranslations('en');
      return reply.status(200).send(
        success({
          message: t(translations, 'auth.sessions.revoked'),
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
  });
}
