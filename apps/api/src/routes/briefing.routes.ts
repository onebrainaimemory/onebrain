import type { FastifyInstance } from 'fastify';
import {
  updateBriefingConfigSchema,
  createBriefingScheduleSchema,
  createBriefingTriggerSchema,
  briefingListQuerySchema,
  briefingEngagementSchema,
} from '@onebrain/schemas';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { getBrainPulseTier } from '../lib/feature-gate.js';
import {
  getOrCreateConfig,
  updateConfig,
  addSchedule,
  listSchedules,
  removeSchedule,
  addTrigger,
  removeTrigger,
  listBriefings,
  getBriefing,
  trackEngagement,
  getBriefingAnalytics,
} from '../services/briefing.service.js';

export async function briefingRoutes(app: FastifyInstance): Promise<void> {
  // ─── Plan Gate ───
  const requireBrainPulse = async (
    request: { userId: string },
    reply: { status: (code: number) => { send: (body: unknown) => void } },
  ) => {
    const tier = await getBrainPulseTier(request.userId);
    if (!tier) {
      const res = error(
        'PLAN_LIMIT_EXCEEDED',
        'BrainPulse requires at least a Free plan with brain_pulse enabled',
        403,
      );
      return reply.status(res.statusCode).send(res.body);
    }
  };

  // ─── Config ───
  app.get(
    '/v1/briefings/config',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const config = await getOrCreateConfig(request.userId);
      return reply.status(200).send(success(config));
    },
  );

  app.patch(
    '/v1/briefings/config',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const parsed = updateBriefingConfigSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid config',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const config = await updateConfig(request.userId, parsed.data);
      return reply.status(200).send(success(config));
    },
  );

  // ─── Schedules ───
  app.get(
    '/v1/briefings/schedules',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const schedules = await listSchedules(request.userId);
      return reply.status(200).send(success(schedules));
    },
  );

  app.post(
    '/v1/briefings/schedules',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const parsed = createBriefingScheduleSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid schedule',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        const schedule = await addSchedule(request.userId, parsed.data);
        return reply.status(201).send(success(schedule));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create schedule';
        const res = error('INTERNAL_ERROR', message, 500);
        return reply.status(res.statusCode).send(res.body);
      }
    },
  );

  app.delete(
    '/v1/briefings/schedules/:id',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await removeSchedule(request.userId, id);
      if (!deleted) {
        const res = error('NOT_FOUND', 'Schedule not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }
      return reply.status(204).send();
    },
  );

  // ─── Triggers ───
  app.get(
    '/v1/briefings/triggers',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      // Inline list for now
      const { getClient } = await import('@onebrain/db');
      const prisma = getClient();
      const triggers = await prisma.briefingTrigger.findMany({
        where: { userId: request.userId },
        orderBy: { createdAt: 'asc' },
      });
      return reply.status(200).send(
        success(
          triggers.map((t) => ({
            id: t.id,
            eventType: t.eventType,
            threshold: t.threshold,
            channels: t.channels,
            isActive: t.isActive,
            cooldownMinutes: t.cooldownMinutes,
          })),
        ),
      );
    },
  );

  app.post(
    '/v1/briefings/triggers',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const parsed = createBriefingTriggerSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid trigger',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      // Check if smart triggers are available for this plan
      const tier = await getBrainPulseTier(request.userId);
      if (tier === 'weekly_email') {
        const res = error('PLAN_LIMIT_EXCEEDED', 'Smart triggers require a Pro plan', 403);
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        const trigger = await addTrigger(request.userId, parsed.data);
        return reply.status(201).send(success(trigger));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create trigger';
        const res = error('INTERNAL_ERROR', message, 500);
        return reply.status(res.statusCode).send(res.body);
      }
    },
  );

  app.delete(
    '/v1/briefings/triggers/:id',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await removeTrigger(request.userId, id);
      if (!deleted) {
        const res = error('NOT_FOUND', 'Trigger not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }
      return reply.status(204).send();
    },
  );

  // ─── Briefing History ───
  app.get(
    '/v1/briefings',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const parsed = briefingListQuerySchema.safeParse({
        type: query['type'],
        status: query['status'],
        cursor: query['cursor'],
        limit: query['limit'] ? parseInt(query['limit'], 10) : undefined,
      });

      if (!parsed.success) {
        const res = error('VALIDATION_ERROR', 'Invalid query', 400, undefined, parsed.error.issues);
        return reply.status(res.statusCode).send(res.body);
      }

      const result = await listBriefings(request.userId, parsed.data);
      return reply.status(200).send(
        success({
          items: result.items,
          pagination: { cursor: result.cursor, hasMore: result.hasMore },
        }),
      );
    },
  );

  app.get(
    '/v1/briefings/:id',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const briefing = await getBriefing(request.userId, id);

      if (!briefing) {
        const res = error('NOT_FOUND', 'Briefing not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(briefing));
    },
  );

  // ─── Analytics ───
  app.get(
    '/v1/briefings/analytics',
    { preHandler: [requireAuth, requireBrainPulse] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const days = query['days'] ? parseInt(query['days'], 10) : 30;
      const analytics = await getBriefingAnalytics(request.userId, days);
      return reply.status(200).send(success(analytics));
    },
  );

  // ─── Engagement ───
  app.post('/v1/briefings/:id/engagement', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = briefingEngagementSchema.safeParse(request.body);
    if (!parsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid input', 400, undefined, parsed.error.issues);
      return reply.status(res.statusCode).send(res.body);
    }

    await trackEngagement(request.userId, id, parsed.data);
    return reply.status(200).send(success({ tracked: true }));
  });
}
