import type { FastifyInstance } from 'fastify';
import { updateBrainProfileSchema } from '@onebrain/schemas';
import { requireAuth, requireScope } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/require-verified-email.js';
import { success, error } from '../lib/response.js';
import { getProfile, updateProfile, getContext } from '../services/brain.service.js';
import { getCache, setCache, invalidateCache } from '../lib/cache.js';

export async function brainRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/brain/profile',
    { preHandler: [requireAuth, requireScope('brain.read')] },
    async (request, reply) => {
      const profile = await getProfile(request.userId);
      return reply.status(200).send(success(profile));
    },
  );

  app.put(
    '/v1/brain/profile',
    { preHandler: [requireAuth, requireVerifiedEmail, requireScope('brain.write')] },
    async (request, reply) => {
      const parsed = updateBrainProfileSchema.safeParse(request.body);
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

      const profile = await updateProfile(request.userId, parsed.data);

      // Invalidate brain context cache on write
      const cacheKey = `brain:context:${request.userId}`;
      await invalidateCache(cacheKey);

      return reply.status(200).send(success(profile));
    },
  );

  app.get(
    '/v1/brain/context',
    { preHandler: [requireAuth, requireScope('brain.read')] },
    async (request, reply) => {
      const cacheKey = `brain:context:${request.userId}`;
      const cached = await getCache(cacheKey);
      if (cached) {
        return reply.status(200).send(JSON.parse(cached));
      }

      const context = await getContext(request.userId);
      const response = success(context);

      await setCache(cacheKey, JSON.stringify(response), 60);

      return reply.status(200).send(response);
    },
  );
}
