import type { FastifyInstance } from 'fastify';
import { provisionAgentSchema } from '@onebrain/schemas';
import {
  provisionAgent,
  verifyProvisioningKey,
  AgentProvisionError,
} from '../services/agent-provision.service.js';
import { success, error } from '../lib/response.js';

export async function agentProvisionRoutes(app: FastifyInstance): Promise<void> {
  // Rate limit: 3 requests per hour per IP
  app.post(
    '/v1/agent-provision',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
          keyGenerator: (request: { ip: string }) => request.ip,
        },
      },
    },
    async (request, reply) => {
      const authHeader = request.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const res = error(
          'UNAUTHORIZED',
          'Missing or invalid Authorization header. Use: Bearer <AGENT_PROVISIONING_KEY>',
          401,
          request.id,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const key = authHeader.slice(7);
      if (!verifyProvisioningKey(key)) {
        const res = error('FORBIDDEN', 'Invalid provisioning key', 403, request.id);
        return reply.status(res.statusCode).send(res.body);
      }

      const parsed = provisionAgentSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request body',
          400,
          request.id,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        const result = await provisionAgent(parsed.data, request.ip);
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
