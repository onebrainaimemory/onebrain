import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKeyTrustLevel,
} from '../services/api-key.service.js';
import { createApiKeySchema, paginationSchema } from '@onebrain/schemas';

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // POST /v1/api-keys — create a new API key
  app.post('/v1/api-keys', async (request, reply) => {
    const { userId } = request;
    const parsed = createApiKeySchema.safeParse(request.body);

    if (!parsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid input', 400, undefined, parsed.error.issues);
      return reply.status(res.statusCode).send(res.body);
    }

    const key = await createApiKey(userId, parsed.data);
    return reply.status(201).send(success(key));
  });

  // GET /v1/api-keys — list API keys
  app.get('/v1/api-keys', async (request, reply) => {
    const { userId } = request;
    const query = paginationSchema.parse(request.query);

    const result = await listApiKeys(userId, {
      cursor: query.cursor,
      limit: query.limit,
    });

    return reply.status(200).send(
      success({
        items: result.items,
        cursor: result.cursor,
        hasMore: result.hasMore,
        total: result.total,
      }),
    );
  });

  // PATCH /v1/api-keys/:id/trust — update trust level
  app.patch('/v1/api-keys/:id/trust', async (request, reply) => {
    const { userId } = request;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        trustLevel: z.enum(['review', 'trusted']),
      })
      .safeParse(request.body);

    if (!body.success) {
      const res = error('VALIDATION_ERROR', 'trustLevel must be "review" or "trusted"', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const updated = await updateApiKeyTrustLevel(userId, id, body.data.trustLevel);
    if (!updated) {
      const res = error('NOT_FOUND', 'API key not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    return reply.status(200).send(success(updated));
  });

  // DELETE /v1/api-keys/:id — revoke an API key
  app.delete('/v1/api-keys/:id', async (request, reply) => {
    const { userId } = request;
    const { id } = request.params as { id: string };

    const deleted = await revokeApiKey(userId, id);
    if (!deleted) {
      const res = error('NOT_FOUND', 'API key not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    return reply.status(204).send();
  });
}
