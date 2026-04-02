import type { FastifyInstance } from 'fastify';
import { registerAgentSchema } from '@onebrain/schemas';
import { registerAgent } from '../services/agent-register.service.js';
import { AgentProvisionError } from '../services/agent-provision.service.js';
import { success, error } from '../lib/response.js';

export async function agentRegisterRoutes(app: FastifyInstance): Promise<void> {
  // Public self-registration: 5 requests per hour per IP
  app.post(
    '/v1/agents/register',
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
      const parsed = registerAgentSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid registration data. Provide name (2-100 chars), description (10-1000 chars), and optional contactUrl.',
          400,
          request.id,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        const result = await registerAgent(parsed.data, request.ip);
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
