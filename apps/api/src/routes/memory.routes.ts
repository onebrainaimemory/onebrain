import type { FastifyInstance } from 'fastify';
import {
  createMemorySchema,
  createMemoryBatchSchema,
  updateMemorySchema,
  paginationSchema,
} from '@onebrain/schemas';
import { requireAuth, requireScope } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/require-verified-email.js';
import { enforcePlanLimit } from '../middleware/limit-enforcement.js';
import { success, error } from '../lib/response.js';
import {
  listMemories,
  getMemory,
  createMemory,
  updateMemory,
  deleteMemory,
  extractMemory,
} from '../services/memory.service.js';

const writeRateLimit = {
  rateLimit: { max: 30, timeWindow: '1 minute' },
};

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/memory',
    { preHandler: [requireAuth, requireScope('brain.read')] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const pagination = paginationSchema.parse({
        cursor: query['cursor'],
        limit: query['limit'],
      });

      const result = await listMemories(request.userId, {
        cursor: pagination.cursor,
        limit: pagination.limit,
        type: query['type'],
        status: query['status'],
        search: query['search'],
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
    '/v1/memory/:id',
    { preHandler: [requireAuth, requireScope('brain.read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = await getMemory(request.userId, id);

      if (!item) {
        const res = error('NOT_FOUND', 'Memory item not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(item));
    },
  );

  app.post(
    '/v1/memory',
    {
      preHandler: [
        requireAuth,
        requireVerifiedEmail,
        requireScope('brain.write'),
        enforcePlanLimit('memory_write'),
      ],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = createMemorySchema.safeParse(request.body);
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

      const item = await createMemory(request.userId, parsed.data);
      return reply.status(201).send(success(item));
    },
  );

  app.patch(
    '/v1/memory/:id',
    {
      preHandler: [requireAuth, requireScope('brain.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateMemorySchema.safeParse(request.body);
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

      const item = await updateMemory(request.userId, id, parsed.data);
      if (!item) {
        const res = error('NOT_FOUND', 'Memory item not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(item));
    },
  );

  app.delete(
    '/v1/memory/:id',
    {
      preHandler: [requireAuth, requireScope('brain.write')],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await deleteMemory(request.userId, id);

      if (!deleted) {
        const res = error('NOT_FOUND', 'Memory item not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );

  app.post(
    '/v1/memory/extract',
    {
      preHandler: [
        requireAuth,
        requireScope('memory.extract.write'),
        enforcePlanLimit('extract_call'),
      ],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = createMemorySchema.safeParse(request.body);
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

      const item = await extractMemory(request.userId, parsed.data);
      return reply.status(201).send(success(item));
    },
  );

  // Batch extract: POST /v1/memory/batch (1-10 items)
  app.post(
    '/v1/memory/batch',
    {
      preHandler: [
        requireAuth,
        requireScope('memory.extract.write'),
        enforcePlanLimit('extract_call'),
      ],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = createMemoryBatchSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Expected array of 1-10 memory objects',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const items = await Promise.all(
        parsed.data.map((item) => extractMemory(request.userId, item)),
      );

      return reply.status(201).send(
        success({
          created: items.length,
          duplicates: 0,
          items,
        }),
      );
    },
  );
}
