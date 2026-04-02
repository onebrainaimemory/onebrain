import type { FastifyInstance } from 'fastify';
import { requireAuth, requireScope } from '../middleware/auth.js';
import { enforcePlanLimit } from '../middleware/limit-enforcement.js';
import { success, error } from '../lib/response.js';
import { getOptimizedContext, isValidScope } from '../services/context.service.js';

export async function contextRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /v1/context/:scope — get optimized LLM context
  // Scopes: brief, assistant, project, deep
  app.get(
    '/v1/context/:scope',
    {
      preHandler: [requireScope('brain.read'), enforcePlanLimit('context_call')],
    },
    async (request, reply) => {
      const { scope } = request.params as { scope: string };

      if (!isValidScope(scope)) {
        const res = error(
          'INVALID_SCOPE',
          'Invalid context scope. Valid: brief, assistant, project, deep',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { userId } = request;
      const result = await getOptimizedContext(userId, scope);

      // Choose format based on Accept header
      const accept = request.headers.accept ?? '';
      if (accept.includes('text/plain')) {
        return reply
          .status(200)
          .header('Content-Type', 'text/plain')
          .header('X-Token-Estimate', String(result.meta.tokenEstimate))
          .header('X-Truncated', String(result.meta.truncated))
          .send(result.formatted);
      }

      return reply.status(200).send(success(result));
    },
  );
}
