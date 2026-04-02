import type { FastifyInstance } from 'fastify';
import {
  createSkillSchema,
  updateSkillSchema,
  skillFeedbackSchema,
  skillListQuerySchema,
} from '@onebrain/schemas';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { canUseSkillForge } from '../lib/feature-gate.js';
import {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  recordSkillFeedback,
} from '../services/skill.service.js';

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  // ─── Plan Gate Middleware ───
  const requireSkillForge = async (
    request: { userId: string },
    reply: { status: (code: number) => { send: (body: unknown) => void } },
  ) => {
    const hasAccess = await canUseSkillForge(request.userId);
    if (!hasAccess) {
      const res = error('PLAN_LIMIT_EXCEEDED', 'SkillForge requires a Pro or Team plan', 403);
      return reply.status(res.statusCode).send(res.body);
    }
  };

  // ─── List Skills ───
  app.get(
    '/v1/skills',
    { preHandler: [requireAuth, requireSkillForge] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const parsed = skillListQuerySchema.safeParse({
        status: query['status'],
        minConfidence: query['minConfidence'] ? parseFloat(query['minConfidence']) : undefined,
        sortBy: query['sortBy'],
        cursor: query['cursor'],
        limit: query['limit'] ? parseInt(query['limit'], 10) : undefined,
      });

      if (!parsed.success) {
        const res = error('VALIDATION_ERROR', 'Invalid query', 400, undefined, parsed.error.issues);
        return reply.status(res.statusCode).send(res.body);
      }

      const result = await listSkills(request.userId, parsed.data);
      return reply.status(200).send(
        success({
          items: result.items,
          pagination: { cursor: result.cursor, hasMore: result.hasMore },
        }),
      );
    },
  );

  // ─── Get Skill ───
  app.get(
    '/v1/skills/:id',
    { preHandler: [requireAuth, requireSkillForge] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const skill = await getSkill(request.userId, id);

      if (!skill) {
        const res = error('NOT_FOUND', 'Skill not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(skill));
    },
  );

  // ─── Create Skill ───
  app.post(
    '/v1/skills',
    { preHandler: [requireAuth, requireSkillForge] },
    async (request, reply) => {
      const parsed = createSkillSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const skill = await createSkill(request.userId, parsed.data);
      return reply.status(201).send(success(skill));
    },
  );

  // ─── Update Skill ───
  app.patch(
    '/v1/skills/:id',
    { preHandler: [requireAuth, requireSkillForge] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSkillSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const skill = await updateSkill(request.userId, id, parsed.data);
      if (!skill) {
        const res = error('NOT_FOUND', 'Skill not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(200).send(success(skill));
    },
  );

  // ─── Delete (Dismiss) Skill ───
  app.delete(
    '/v1/skills/:id',
    { preHandler: [requireAuth, requireSkillForge] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await deleteSkill(request.userId, id);

      if (!deleted) {
        const res = error('NOT_FOUND', 'Skill not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return reply.status(204).send();
    },
  );

  // ─── Record Skill Feedback ───
  app.post('/v1/skills/:id/feedback', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = skillFeedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid request', 400, undefined, parsed.error.issues);
      return reply.status(res.statusCode).send(res.body);
    }

    // Use apiKeyId as agentId if available, fallback to userId
    const agentId = (request as unknown as { apiKeyId?: string }).apiKeyId ?? request.userId;

    await recordSkillFeedback(id, agentId, parsed.data.eventType, parsed.data.context);
    return reply.status(200).send(success({ recorded: true }));
  });
}
