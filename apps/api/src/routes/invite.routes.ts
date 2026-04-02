import type { FastifyInstance } from 'fastify';
import { inviteRegisterSchema } from '@onebrain/schemas';
import { getInviteLinkInfo, registerViaInvite } from '../services/invite-register.service.js';
import { AgentProvisionError } from '../services/agent-provision.service.js';
import { success, error } from '../lib/response.js';

/**
 * Public invite routes — no auth required.
 * POST /v1/invite/register — register agent via invite code
 * GET  /v1/invite/:code/info — validate invite code
 */
export async function inviteRoutes(app: FastifyInstance): Promise<void> {
  // Validate invite code (public)
  app.get(
    '/v1/invite/:code/info',
    {
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };

      try {
        const info = await getInviteLinkInfo(code);
        return reply.status(200).send(success(info, request.id));
      } catch (err) {
        if (err instanceof AgentProvisionError) {
          const res = error(err.code, err.message, err.statusCode, request.id);
          return reply.status(res.statusCode).send(res.body);
        }
        throw err;
      }
    },
  );

  // Register via invite code (public, rate-limited)
  app.post(
    '/v1/invite/register',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
          keyGenerator: (request: { ip: string }) => request.ip,
        },
      },
    },
    async (request, reply) => {
      const parsed = inviteRegisterSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid registration data.',
          400,
          request.id,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        const result = await registerViaInvite(parsed.data, request.ip);
        return reply.status(201).send(success(result, request.id));
      } catch (err) {
        if (err instanceof AgentProvisionError) {
          const res = error(err.code, err.message, err.statusCode, request.id);
          return reply.status(res.statusCode).send(res.body);
        }
        throw err;
      }
    },
  );
}
