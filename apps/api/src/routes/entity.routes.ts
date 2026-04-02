import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createEntitySchema,
  updateEntitySchema,
  createEntityLinkSchema,
  paginationSchema,
} from '@onebrain/schemas';
import { requireAuth, requireScope } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/require-verified-email.js';
import { success, error } from '../lib/response.js';
import {
  listEntities,
  listEntitiesWithLinks,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  addEntityLink,
  removeEntityLink,
  findDuplicateEntities,
  mergeEntities,
} from '../services/entity.service.js';
import { autoExtractFromMemory } from '../services/entity-extract.service.js';

const writeRateLimit = {
  rateLimit: { max: 30, timeWindow: '1 minute' },
};

export async function entityRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/entities',
    { preHandler: [requireAuth, requireScope('entity.read')] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const pagination = paginationSchema.parse({
        cursor: query['cursor'],
        limit: query['limit'],
      });

      const result = await listEntities(request.userId, {
        cursor: pagination.cursor,
        limit: pagination.limit,
        type: query['type'],
      });

      return reply.status(200).send({
        data: result.items,
        meta: {
          requestId: crypto.randomUUID(),
          pagination: {
            cursor: result.cursor,
            hasMore: result.hasMore,
            total: result.total,
          },
        },
      });
    },
  );

  app.get(
    '/v1/entities/:id',
    { preHandler: [requireAuth, requireScope('entity.read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const entity = await getEntity(request.userId, id);

      if (!entity) {
        const res = error('NOT_FOUND', 'Entity not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(entity));
    },
  );

  app.post(
    '/v1/entities',
    {
      preHandler: [requireAuth, requireVerifiedEmail, requireScope('entity.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = createEntitySchema.safeParse(request.body);
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

      const entity = await createEntity(request.userId, parsed.data);
      return reply.status(201).send(success(entity));
    },
  );

  app.patch(
    '/v1/entities/:id',
    {
      preHandler: [requireAuth, requireVerifiedEmail, requireScope('entity.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateEntitySchema.safeParse(request.body);
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

      const entity = await updateEntity(request.userId, id, parsed.data);
      if (!entity) {
        const res = error('NOT_FOUND', 'Entity not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(entity));
    },
  );

  app.delete(
    '/v1/entities/:id',
    {
      preHandler: [requireAuth, requireVerifiedEmail, requireScope('entity.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await deleteEntity(request.userId, id);

      if (!deleted) {
        const res = error('NOT_FOUND', 'Entity not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );

  app.post(
    '/v1/entities/:id/links',
    {
      preHandler: [requireAuth, requireVerifiedEmail, requireScope('entity.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createEntityLinkSchema.safeParse(request.body);
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

      const link = await addEntityLink(request.userId, id, parsed.data);
      if (!link) {
        const res = error('NOT_FOUND', 'Entity or memory item not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(201).send(success(link));
    },
  );

  app.delete(
    '/v1/entities/:entityId/links/:linkId',
    {
      preHandler: [requireAuth, requireVerifiedEmail, requireScope('entity.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { entityId, linkId } = request.params as {
        entityId: string;
        linkId: string;
      };
      const deleted = await removeEntityLink(request.userId, entityId, linkId);

      if (!deleted) {
        const res = error('NOT_FOUND', 'Entity link not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );

  // GET /v1/entities/graph — all entities with links for graph view
  app.get(
    '/v1/entities/graph',
    { preHandler: [requireAuth, requireScope('entity.read')] },
    async (request, reply) => {
      const result = await listEntitiesWithLinks(request.userId);
      return reply.status(200).send(success(result));
    },
  );

  // GET /v1/entities/duplicates — find potential duplicate entities
  app.get(
    '/v1/entities/duplicates',
    { preHandler: [requireAuth, requireScope('entity.read')] },
    async (request, reply) => {
      const result = await findDuplicateEntities(request.userId);
      return reply.status(200).send(success(result));
    },
  );

  // POST /v1/entities/merge — merge two entities
  app.post(
    '/v1/entities/merge',
    {
      preHandler: [requireAuth, requireVerifiedEmail, requireScope('entity.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const schema = z.object({
        keepId: z.string().uuid(),
        removeId: z.string().uuid(),
      });

      const parsed = schema.safeParse(request.body);
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

      if (parsed.data.keepId === parsed.data.removeId) {
        const res = error('VALIDATION_ERROR', 'Cannot merge an entity with itself', 400);
        return reply.status(res.statusCode).send(res.body);
      }

      const result = await mergeEntities(request.userId, parsed.data.keepId, parsed.data.removeId);

      if (!result.merged) {
        const res = error('NOT_FOUND', 'One or both entities not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(result));
    },
  );

  // POST /v1/entities/auto-extract — extract entities from a memory
  app.post(
    '/v1/entities/auto-extract',
    {
      preHandler: [requireAuth, requireVerifiedEmail, requireScope('entity.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const schema = z.object({
        memoryId: z.string().uuid(),
      });

      const parsed = schema.safeParse(request.body);
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

      const extracted = await autoExtractFromMemory(request.userId, parsed.data.memoryId);

      return reply.status(201).send(
        success({
          memoryId: parsed.data.memoryId,
          extracted,
          count: extracted.length,
        }),
      );
    },
  );
}
