import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import {
  getTodayQuestion,
  answerQuestion,
  listQuestions,
} from '../services/daily-question.service.js';
import { paginationSchema } from '@onebrain/schemas';
import { z } from 'zod';

const answerSchema = z.object({
  answer: z.string().min(1),
});

export async function dailyQuestionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /v1/daily-question/today — get or generate today's question
  app.get('/v1/daily-question/today', async (request, reply) => {
    const { userId } = request;
    const question = await getTodayQuestion(userId);
    return reply.status(200).send(success(question));
  });

  // POST /v1/daily-question/:id/answer — submit an answer
  app.post('/v1/daily-question/:id/answer', async (request, reply) => {
    const { userId } = request;
    const { id } = request.params as { id: string };
    const parsed = answerSchema.safeParse(request.body);

    if (!parsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid input', 400, undefined, parsed.error.issues);
      return reply.status(res.statusCode).send(res.body);
    }

    const result = await answerQuestion(userId, id, parsed.data.answer);

    if (!result) {
      const res = error('NOT_FOUND', 'Question not found or already answered', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    return reply.status(200).send(success(result));
  });

  // GET /v1/daily-question — list past questions
  app.get('/v1/daily-question', async (request, reply) => {
    const { userId } = request;
    const query = paginationSchema.parse(request.query);

    const result = await listQuestions(userId, {
      cursor: query.cursor,
      limit: query.limit,
    });

    return reply.status(200).send(
      success({
        items: result.items,
        cursor: result.cursor,
        hasMore: result.hasMore,
        total: result.total,
      }),
    );
  });
}
