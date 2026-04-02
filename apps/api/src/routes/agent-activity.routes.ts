import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import {
  getAgentList,
  getAgentSummary,
  getAgentActivities,
  bulkUpdateCandidates,
} from '../services/agent-activity.service.js';
import {
  agentActivityQuerySchema,
  updateApiKeyConfigSchema,
  bulkMemoryActionSchema,
} from '@onebrain/schemas';
import { getClient } from '@onebrain/db';
import { audit } from '../lib/audit.js';

export async function agentActivityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /v1/agents — list agents with stats
  app.get('/v1/agents', async (request, reply) => {
    const { userId } = request;
    const agents = await getAgentList(userId);
    return reply.status(200).send(success(agents));
  });

  // GET /v1/agents/summary — cross-agent summary
  app.get('/v1/agents/summary', async (request, reply) => {
    const { userId } = request;
    const query = agentActivityQuerySchema.safeParse(request.query);

    if (!query.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        400,
        undefined,
        query.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    const summary = await getAgentSummary(userId, undefined, query.data.days);
    return reply.status(200).send(success(summary));
  });

  // GET /v1/agents/activity — all-agent activity feed
  app.get('/v1/agents/activity', async (request, reply) => {
    const { userId } = request;
    const query = agentActivityQuerySchema.safeParse(request.query);

    if (!query.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        400,
        undefined,
        query.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    const result = await getAgentActivities(userId, {
      cursor: query.data.cursor,
      limit: query.data.limit,
      days: query.data.days,
    });

    return reply.status(200).send(
      success({
        data: result.data,
        meta: {
          cursor: result.cursor,
          hasMore: result.hasMore,
        },
      }),
    );
  });

  // GET /v1/agents/:id/summary — single-agent summary
  app.get('/v1/agents/:id/summary', async (request, reply) => {
    const { userId } = request;
    const { id } = request.params as { id: string };

    const uuidParsed = z.string().uuid().safeParse(id);
    if (!uuidParsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid agent ID', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const query = agentActivityQuerySchema.safeParse(request.query);
    if (!query.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        400,
        undefined,
        query.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    // Verify the API key belongs to the user
    const prisma = getClient();
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!apiKey) {
      const res = error('NOT_FOUND', 'Agent not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    const summary = await getAgentSummary(userId, id, query.data.days);
    return reply.status(200).send(success(summary));
  });

  // GET /v1/agents/:id/activity — single-agent activity feed
  app.get('/v1/agents/:id/activity', async (request, reply) => {
    const { userId } = request;
    const { id } = request.params as { id: string };

    const uuidParsed = z.string().uuid().safeParse(id);
    if (!uuidParsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid agent ID', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const query = agentActivityQuerySchema.safeParse(request.query);
    if (!query.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        400,
        undefined,
        query.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    // Verify the API key belongs to the user
    const prisma = getClient();
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!apiKey) {
      const res = error('NOT_FOUND', 'Agent not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    const result = await getAgentActivities(userId, {
      apiKeyId: id,
      cursor: query.data.cursor,
      limit: query.data.limit,
      days: query.data.days,
    });

    return reply.status(200).send(
      success({
        data: result.data,
        meta: {
          cursor: result.cursor,
          hasMore: result.hasMore,
        },
      }),
    );
  });

  // POST /v1/agents/:id/candidates — bulk approve/dismiss
  app.post('/v1/agents/:id/candidates', async (request, reply) => {
    const { userId } = request;
    const { id } = request.params as { id: string };

    const uuidParsed = z.string().uuid().safeParse(id);
    if (!uuidParsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid agent ID', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const body = bulkMemoryActionSchema.safeParse(request.body);
    if (!body.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid request body',
        400,
        undefined,
        body.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    // Verify the API key belongs to the user
    const prisma = getClient();
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!apiKey) {
      const res = error('NOT_FOUND', 'Agent not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    const count = await bulkUpdateCandidates(userId, id, body.data.action);

    audit(userId, 'bulk_update', 'agent_candidates', id, {
      action: body.data.action,
      count,
    });

    return reply.status(200).send(success({ action: body.data.action, updated: count }));
  });

  // PATCH /v1/api-keys/:id — update agent config
  app.patch('/v1/api-keys/:id', async (request, reply) => {
    const { userId } = request;
    const { id } = request.params as { id: string };

    const uuidParsed = z.string().uuid().safeParse(id);
    if (!uuidParsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid API key ID', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const body = updateApiKeyConfigSchema.safeParse(request.body);
    if (!body.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid request body',
        400,
        undefined,
        body.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    const prisma = getClient();
    const existing = await prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      const res = error('NOT_FOUND', 'API key not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    const updateData: Record<string, unknown> = {};
    if (body.data.name !== undefined) {
      updateData['name'] = body.data.name;
    }
    if (body.data.description !== undefined) {
      updateData['description'] = body.data.description;
    }
    if (body.data.trustLevel !== undefined) {
      updateData['trustLevel'] = body.data.trustLevel;
    }
    if (body.data.rateLimitPerMin !== undefined) {
      updateData['rateLimitPerMin'] = body.data.rateLimitPerMin;
    }
    if (body.data.scopes !== undefined) {
      updateData['scopes'] = body.data.scopes;
    }
    if (body.data.isActive !== undefined) {
      updateData['isActive'] = body.data.isActive;
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        trustLevel: true,
        description: true,
        rateLimitPerMin: true,
        isActive: true,
        lastUsedAt: true,
        lastSyncedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    audit(userId, 'update', 'api_key', id, body.data);

    return reply.status(200).send(
      success({
        ...updated,
        lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
        lastSyncedAt: updated.lastSyncedAt?.toISOString() ?? null,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      }),
    );
  });
}
