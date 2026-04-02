import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { runMerge, getMergeHistory, rollbackToVersion } from '../services/merge.service.js';
import { paginationSchema } from '@onebrain/schemas';

export async function mergeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // POST /v1/merge/run — trigger merge engine
  app.post('/v1/merge/run', async (request, reply) => {
    const { userId } = request;

    const result = await runMerge(userId);

    return reply.status(200).send(success(result));
  });

  // GET /v1/merge/history — list brain version snapshots
  app.get('/v1/merge/history', async (request, reply) => {
    const { userId } = request;
    const query = paginationSchema.parse(request.query);

    const result = await getMergeHistory(userId, {
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

  // POST /v1/merge/rollback/:version — rollback to a specific version
  app.post('/v1/merge/rollback/:version', async (request, reply) => {
    const { userId } = request;
    const schema = z.object({
      version: z.coerce.number().int().min(1),
    });

    const parsed = schema.safeParse(request.params);
    if (!parsed.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid version number',
        400,
        undefined,
        parsed.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    const result = await rollbackToVersion(userId, parsed.data.version);

    if (!result.success) {
      const res = error('NOT_FOUND', result.error ?? 'Version not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    return reply.status(200).send(success(result));
  });
}
