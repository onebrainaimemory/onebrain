import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { hybridSearch, keywordSearch, semanticSearch } from '../services/embedding.service.js';
import { consolidateMemories, expireMemories } from '../services/consolidation.service.js';
import { getUsageForPeriod, getCurrentPlanDetails } from '../middleware/usage-middleware.js';
import { canUseDeepRecall } from '../lib/feature-gate.js';
import { getEmbeddingStatus, batchReindex } from '../services/embedding-admin.service.js';

const deepRecallSearchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  top_k: z.number().int().min(1).max(50).optional().default(10),
  mode: z.enum(['keyword', 'vector', 'hybrid']).optional().default('hybrid'),
  alpha: z.number().min(0).max(1).optional().default(0.6),
  type: z.string().optional(),
});

const consolidateSchema = z.object({
  type: z.string().optional(),
  threshold: z.number().min(0.1).max(1.0).optional(),
  dryRun: z.boolean().optional().default(false),
});

const expireSchema = z.object({
  ttlDays: z.number().int().min(1).optional().default(365),
});

export async function searchAndConsolidationRoutes(app: FastifyInstance): Promise<void> {
  // DeepRecall search endpoint
  app.post('/v1/memory/search', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = deepRecallSearchSchema.safeParse(request.body);
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

    const { query, top_k, alpha } = parsed.data;
    let { mode } = parsed.data;

    // Plan gating: check if user can use DeepRecall (vector/hybrid)
    let downgradedFrom: string | undefined;
    if (mode !== 'keyword') {
      const hasDeepRecall = await canUseDeepRecall(request.userId);
      if (!hasDeepRecall) {
        downgradedFrom = mode;
        mode = 'keyword';
      }
    }

    // Execute search based on resolved mode
    if (mode === 'keyword') {
      const results = await keywordSearch(request.userId, query, top_k);
      return reply.status(200).send(
        success({
          results: results.map((r) => ({
            id: r.memoryItemId,
            title: r.title,
            body: r.body,
            type: r.type,
            confidence: r.confidence,
            score: r.score,
            diceScore: r.diceScore,
            vectorScore: 0,
          })),
          searchMode: 'keyword',
          ...(downgradedFrom ? { downgradedFrom } : {}),
        }),
      );
    }

    if (mode === 'vector') {
      const results = await semanticSearch(request.userId, query, top_k);
      return reply.status(200).send(
        success({
          results: results.map((r) => ({
            id: r.memoryItemId,
            title: r.title,
            body: r.body,
            type: r.type,
            confidence: r.confidence,
            score: r.score,
            diceScore: 0,
            vectorScore: r.score,
          })),
          searchMode: 'vector',
        }),
      );
    }

    // hybrid mode (default)
    const results = await hybridSearch(request.userId, query, top_k, alpha);
    return reply.status(200).send(
      success({
        results: results.map((r) => ({
          id: r.memoryItemId,
          title: r.title,
          body: r.body,
          type: r.type,
          confidence: r.confidence,
          score: r.score,
          diceScore: r.diceScore,
          vectorScore: r.vectorScore,
        })),
        searchMode: 'hybrid',
      }),
    );
  });

  // Memory consolidation endpoint
  app.post('/v1/memory/consolidate', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = consolidateSchema.safeParse(request.body ?? {});
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

    const result = await consolidateMemories(request.userId, {
      type: parsed.data.type,
      threshold: parsed.data.threshold,
      dryRun: parsed.data.dryRun,
    });

    return reply.status(200).send(success(result));
  });

  // Memory expiration endpoint
  app.post('/v1/memory/expire', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = expireSchema.safeParse(request.body ?? {});
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

    const count = await expireMemories(request.userId, parsed.data.ttlDays);
    return reply.status(200).send(success({ expired: count }));
  });

  // Usage endpoint
  app.get('/v1/billing/usage', { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const validPeriods = ['daily', 'weekly', 'monthly'] as const;
    type Period = (typeof validPeriods)[number];
    const rawPeriod = query['period'] ?? 'monthly';
    const period: Period = validPeriods.includes(rawPeriod as Period)
      ? (rawPeriod as Period)
      : 'monthly';
    const usage = await getUsageForPeriod(request.userId, period);
    return reply.status(200).send(success({ period, usage }));
  });

  // Current plan details
  app.get('/v1/billing/plan', { preHandler: requireAuth }, async (request, reply) => {
    const plan = await getCurrentPlanDetails(request.userId);
    return reply.status(200).send(success(plan));
  });

  // ─── DeepRecall: Embedding Status ───
  app.get('/v1/memory/embeddings/status', { preHandler: requireAuth }, async (request, reply) => {
    const stats = await getEmbeddingStatus(request.userId);
    return reply.status(200).send(success(stats));
  });

  // ─── DeepRecall: Batch Re-Embedding ───
  const reindexSchema = z.object({
    status: z.enum(['failed', 'missing']).optional(),
    maxItems: z.number().int().min(1).max(1000).optional().default(500),
  });

  app.post('/v1/memory/embeddings/reindex', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = reindexSchema.safeParse(request.body ?? {});
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

    const result = await batchReindex(request.userId, parsed.data);

    if (result.error) {
      return reply.status(200).send(success({ ...result, warning: result.error }));
    }

    return reply.status(200).send(success(result));
  });
}
