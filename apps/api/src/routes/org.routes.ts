import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createOrgSchema, addMemberSchema } from '@onebrain/schemas';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import {
  createOrg,
  listOrgs,
  getOrg,
  addOrgMember,
  removeOrgMember,
  listOrgMembers,
} from '../services/org.service.js';

const uuidParam = z.object({ id: z.string().uuid() });
const memberParams = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

export async function orgRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/orgs', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createOrgSchema.safeParse(request.body);
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

    const org = await createOrg(request.userId, parsed.data);
    return reply.status(201).send(success(org));
  });

  app.get('/v1/orgs', { preHandler: requireAuth }, async (_request, reply) => {
    const orgs = await listOrgs(_request.userId);
    return reply.status(200).send(success(orgs));
  });

  app.get('/v1/orgs/:id', { preHandler: requireAuth }, async (request, reply) => {
    const params = uuidParam.safeParse(request.params);
    if (!params.success) {
      const res = error('VALIDATION_ERROR', 'Invalid organization ID', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const org = await getOrg(request.userId, params.data.id);
    if (!org) {
      const res = error('NOT_FOUND', 'Organization not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }
    return reply.status(200).send(success(org));
  });

  app.post('/v1/orgs/:id/members', { preHandler: requireAuth }, async (request, reply) => {
    const params = uuidParam.safeParse(request.params);
    if (!params.success) {
      const res = error('VALIDATION_ERROR', 'Invalid organization ID', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const parsed = addMemberSchema.safeParse(request.body);
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

    const member = await addOrgMember(
      request.userId,
      params.data.id,
      parsed.data.userId,
      parsed.data.role,
    );
    if (!member) {
      const res = error('FORBIDDEN', 'Admin access required or member already exists', 403);
      return reply.status(res.statusCode).send(res.body);
    }

    return reply.status(201).send(success(member));
  });

  app.delete(
    '/v1/orgs/:id/members/:userId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = memberParams.safeParse(request.params);
      if (!params.success) {
        const res = error('VALIDATION_ERROR', 'Invalid parameters', 400);
        return reply.status(res.statusCode).send(res.body);
      }

      const removed = await removeOrgMember(request.userId, params.data.id, params.data.userId);
      if (!removed) {
        const res = error('FORBIDDEN', 'Admin access required or member not found', 403);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );

  app.get('/v1/orgs/:id/members', { preHandler: requireAuth }, async (request, reply) => {
    const params = uuidParam.safeParse(request.params);
    if (!params.success) {
      const res = error('VALIDATION_ERROR', 'Invalid organization ID', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const members = await listOrgMembers(request.userId, params.data.id);
    return reply.status(200).send(success(members));
  });
}
