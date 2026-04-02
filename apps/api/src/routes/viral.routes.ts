import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { audit } from '../lib/audit.js';

const createShareSchema = z.object({
  scope: z.string().min(1).max(100),
  expiresInHours: z.number().int().min(1).max(8760).optional(),
});

const uuidParam = z.string().uuid();
const shareTokenParam = z.string().min(1).max(128);
const referralCodeParam = z.string().min(1).max(64);
import {
  createReferralCode,
  completeReferral,
  getUserReferrals,
  createBrainShare,
  getBrainShare,
  getUserShares,
  revokeBrainShare,
  getBrainExportData,
  formatBrainExportMarkdown,
  generateAiExportPrompt,
  grantReferralReward,
} from '../services/viral.service.js';

export async function viralRoutes(app: FastifyInstance) {
  // ── Public: view a brain share ─────────────────────────────

  app.get(
    '/v1/shares/:token',
    async (request: FastifyRequest<{ Params: { token: string } }>, reply) => {
      const tokenParsed = shareTokenParam.safeParse(request.params.token);
      if (!tokenParsed.success) {
        const res = error('VALIDATION_ERROR', 'Invalid share token', 400);
        return reply.status(res.statusCode).send(res.body);
      }
      const share = await getBrainShare(tokenParsed.data);

      if (!share) {
        const res = error('NOT_FOUND', 'Share not found or expired', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      return success({
        scope: share.scope,
        snapshot: share.snapshot,
        viewCount: share.viewCount + 1,
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt?.toISOString() ?? null,
      });
    },
  );

  // ── Authenticated routes ───────────────────────────────────

  app.register(async (authed) => {
    authed.addHook('onRequest', requireAuth);

    // ── Referrals ──────────────────────────────────────────

    /** Create a referral code */
    authed.post('/v1/referrals', async (request, reply) => {
      const referral = await createReferralCode(request.userId);
      audit(request.userId, 'create', 'referral', referral.id);

      return reply.status(201).send(
        success({
          id: referral.id,
          code: referral.code,
          status: referral.status,
          createdAt: referral.createdAt.toISOString(),
        }),
      );
    });

    /** Complete a referral and grant reward to referrer */
    authed.post(
      '/v1/referrals/:code/complete',
      async (request: FastifyRequest<{ Params: { code: string } }>, reply) => {
        const codeParsed = referralCodeParam.safeParse(request.params.code);
        if (!codeParsed.success) {
          const res = error('VALIDATION_ERROR', 'Invalid referral code', 400);
          return reply.status(res.statusCode).send(res.body);
        }
        const result = await completeReferral(codeParsed.data, request.userId);

        if (!result.success) {
          const res = error('REFERRAL_ERROR', result.error!, 400);
          return reply.status(res.statusCode).send(res.body);
        }

        // Grant referral reward: extend referrer plan by 30 days
        const rewardResult = await grantReferralReward(codeParsed.data);
        if (rewardResult.granted) {
          audit(rewardResult.referrerUserId!, 'grant', 'referral_reward', codeParsed.data, {
            extensionDays: 30,
          });
        }

        audit(request.userId, 'complete', 'referral', codeParsed.data);
        return success({
          completed: true,
          rewardGranted: rewardResult.granted,
        });
      },
    );

    /** List my referrals */
    authed.get(
      '/v1/referrals',
      async (
        request: FastifyRequest<{
          Querystring: { cursor?: string; limit?: string };
        }>,
      ) => {
        const limit = Math.min(Number(request.query.limit) || 20, 100);
        const result = await getUserReferrals(request.userId, request.query.cursor, limit);

        return success({
          items: result.items.map((r) => ({
            id: r.id,
            code: r.code,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            completedAt: r.completedAt?.toISOString() ?? null,
          })),
          cursor: result.cursor,
          hasMore: result.hasMore,
        });
      },
    );

    // ── Brain Shares ───────────────────────────────────────

    /** List my shares */
    authed.get(
      '/v1/shares',
      async (
        request: FastifyRequest<{
          Querystring: { cursor?: string; limit?: string };
        }>,
      ) => {
        const limit = Math.min(Number(request.query.limit) || 20, 100);
        const result = await getUserShares(request.userId, request.query.cursor, limit);

        return success({
          items: result.items.map((s) => ({
            id: s.id,
            shareToken: s.shareToken,
            scope: s.scope,
            viewCount: s.viewCount,
            createdAt: s.createdAt.toISOString(),
            expiresAt: s.expiresAt?.toISOString() ?? null,
          })),
          cursor: result.cursor,
          hasMore: result.hasMore,
        });
      },
    );

    /** Revoke a brain share */
    authed.delete(
      '/v1/shares/:id',
      async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const idParsed = uuidParam.safeParse(request.params.id);
        if (!idParsed.success) {
          const res = error('VALIDATION_ERROR', 'Invalid share ID', 400);
          return reply.status(res.statusCode).send(res.body);
        }
        const deleted = await revokeBrainShare(request.userId, idParsed.data);

        if (!deleted) {
          const res = error('NOT_FOUND', 'Share not found', 404);
          return reply.status(res.statusCode).send(res.body);
        }

        audit(request.userId, 'delete', 'brain_share', idParsed.data);
        return reply.status(204).send();
      },
    );

    /** Create a brain share */
    authed.post('/v1/shares', async (request, reply) => {
      const parsed = createShareSchema.safeParse(request.body);
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

      const { scope, expiresInHours } = parsed.data;
      const data = await getBrainExportData(request.userId);
      const share = await createBrainShare(request.userId, scope, data, expiresInHours);

      audit(request.userId, 'create', 'brain_share', share.id);

      return reply.status(201).send(
        success({
          id: share.id,
          shareToken: share.shareToken,
          scope: share.scope,
          expiresAt: share.expiresAt?.toISOString() ?? null,
          createdAt: share.createdAt.toISOString(),
        }),
      );
    });

    // ── Brain Export ────────────────────────────────────────

    /** Export brain as JSON */
    authed.get('/v1/export/json', async (request) => {
      const data = await getBrainExportData(request.userId);
      audit(request.userId, 'export', 'brain', undefined, { format: 'json' });
      return success(data);
    });

    /** Export brain as Markdown */
    authed.get('/v1/export/markdown', async (request, reply) => {
      const data = await getBrainExportData(request.userId);
      const md = formatBrainExportMarkdown(data);

      audit(request.userId, 'export', 'brain', undefined, { format: 'markdown' });

      return reply.header('Content-Type', 'text/markdown; charset=utf-8').send(md);
    });

    /** Generate AI system prompt from brain */
    authed.get('/v1/export/ai-prompt', async (request) => {
      const data = await getBrainExportData(request.userId);
      const prompt = generateAiExportPrompt(data);

      audit(request.userId, 'export', 'brain', undefined, { format: 'ai-prompt' });

      return success({ prompt });
    });
  });
}
