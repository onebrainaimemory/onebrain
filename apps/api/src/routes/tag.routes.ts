import type { FastifyInstance } from 'fastify';
import { createTagSchema, addTagToMemorySchema } from '@onebrain/schemas';
import { requireAuth, requireScope } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import {
  listTags,
  createTag,
  deleteTag,
  addTagToMemory,
  removeTagFromMemory,
} from '../services/tag.service.js';

const writeRateLimit = {
  rateLimit: { max: 30, timeWindow: '1 minute' },
};

export async function tagRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/tags',
    { preHandler: [requireAuth, requireScope('brain.read')] },
    async (request, reply) => {
      const tags = await listTags(request.userId);
      return reply.status(200).send(success(tags));
    },
  );

  app.post(
    '/v1/tags',
    {
      preHandler: [requireAuth, requireScope('brain.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = createTagSchema.safeParse(request.body);
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

      const tag = await createTag(request.userId, parsed.data);
      return reply.status(201).send(success(tag));
    },
  );

  app.delete(
    '/v1/tags/:id',
    {
      preHandler: [requireAuth, requireScope('brain.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await deleteTag(request.userId, id);

      if (!deleted) {
        const res = error('NOT_FOUND', 'Tag not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );

  app.post(
    '/v1/memory/:id/tags',
    {
      preHandler: [requireAuth, requireScope('brain.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = addTagToMemorySchema.safeParse(request.body);
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

      const result = await addTagToMemory(request.userId, id, parsed.data.tagId);

      if (!result) {
        const res = error('NOT_FOUND', 'Memory or tag not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(201).send(success(result));
    },
  );

  app.delete(
    '/v1/memory/:memoryId/tags/:tagId',
    {
      preHandler: [requireAuth, requireScope('brain.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { memoryId, tagId } = request.params as {
        memoryId: string;
        tagId: string;
      };

      const removed = await removeTagFromMemory(request.userId, memoryId, tagId);

      if (!removed) {
        const res = error('NOT_FOUND', 'Memory-tag association not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );
}
