import type { FastifyInstance } from 'fastify';
import {
  createProjectSchema,
  updateProjectSchema,
  createProjectMemoryLinkSchema,
  paginationSchema,
} from '@onebrain/schemas';
import { requireAuth } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/require-verified-email.js';
import { success, error } from '../lib/response.js';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addProjectMemoryLink,
  removeProjectMemoryLink,
} from '../services/project.service.js';

const writeRateLimit = {
  rateLimit: { max: 30, timeWindow: '1 minute' },
};

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/projects', { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const pagination = paginationSchema.parse({
      cursor: query['cursor'],
      limit: query['limit'],
    });

    const result = await listProjects(request.userId, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      status: query['status'],
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
  });

  app.get('/v1/projects/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await getProject(request.userId, id);

    if (!project) {
      const res = error('NOT_FOUND', 'Project not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    return reply.status(200).send(success(project));
  });

  app.post(
    '/v1/projects',
    { preHandler: [requireAuth, requireVerifiedEmail], config: writeRateLimit },
    async (request, reply) => {
      const parsed = createProjectSchema.safeParse(request.body);
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

      const project = await createProject(request.userId, parsed.data);
      return reply.status(201).send(success(project));
    },
  );

  app.patch(
    '/v1/projects/:id',
    { preHandler: [requireAuth, requireVerifiedEmail], config: writeRateLimit },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateProjectSchema.safeParse(request.body);
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

      const project = await updateProject(request.userId, id, parsed.data);
      if (!project) {
        const res = error('NOT_FOUND', 'Project not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(project));
    },
  );

  app.delete(
    '/v1/projects/:id',
    { preHandler: [requireAuth, requireVerifiedEmail], config: writeRateLimit },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await deleteProject(request.userId, id);

      if (!deleted) {
        const res = error('NOT_FOUND', 'Project not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );

  app.post(
    '/v1/projects/:id/memory-links',
    { preHandler: [requireAuth, requireVerifiedEmail], config: writeRateLimit },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createProjectMemoryLinkSchema.safeParse(request.body);
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

      const link = await addProjectMemoryLink(request.userId, id, parsed.data);
      if (!link) {
        const res = error('NOT_FOUND', 'Project or memory item not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(201).send(success(link));
    },
  );

  app.delete(
    '/v1/projects/:projectId/memory-links/:linkId',
    { preHandler: [requireAuth, requireVerifiedEmail], config: writeRateLimit },
    async (request, reply) => {
      const { projectId, linkId } = request.params as {
        projectId: string;
        linkId: string;
      };
      const deleted = await removeProjectMemoryLink(request.userId, projectId, linkId);

      if (!deleted) {
        const res = error('NOT_FOUND', 'Project memory link not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );
}
