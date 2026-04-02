import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import {
  softDeleteUser,
  restoreUser,
  exportUserData,
  storeConsent,
} from '../services/gdpr.service.js';

export async function gdprRoutes(app: FastifyInstance): Promise<void> {
  /**
   * DELETE /v1/user — Soft-delete account (DSGVO Art. 17)
   * 30-day grace period, then hard-delete via retention job.
   */
  app.delete('/v1/user', { preHandler: requireAuth }, async (request, reply) => {
    await softDeleteUser(request.userId);

    audit(request.userId, 'delete', 'user', request.userId);

    reply.clearCookie('accessToken', { path: '/v1' });
    reply.clearCookie('refreshToken', { path: '/v1/auth' });

    return reply.status(200).send(
      success({
        message: 'Account scheduled for deletion. ' + 'You have 30 days to request restoration.',
      }),
    );
  });

  /**
   * POST /v1/user/restore — Cancel account deletion during grace period.
   */
  app.post('/v1/user/restore', { preHandler: requireAuth }, async (request, reply) => {
    const restored = await restoreUser(request.userId);

    if (!restored) {
      const res = error(
        'RESTORE_FAILED',
        'Account cannot be restored. Either not deleted or grace period expired.',
        409,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    audit(request.userId, 'restore', 'user', request.userId);

    return reply.status(200).send(success({ message: 'Account restored successfully.' }));
  });

  /**
   * GET /v1/user/export — Full data export (DSGVO Art. 15/20)
   * Rate limited to 1 per hour.
   */
  app.get(
    '/v1/user/export',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 1, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const data = await exportUserData(request.userId);

      audit(request.userId, 'export', 'user_data', request.userId);

      return reply.status(200).send(success(data));
    },
  );

  /**
   * GET /v1/user/usage-summary — Current usage vs plan limits.
   */
  app.get('/v1/user/usage-summary', { preHandler: requireAuth }, async (request, reply) => {
    const { getActivePlan } = await import('../services/plan.service.js');
    const { getUsageSummary } = await import('../services/usage.service.js');

    const plan = await getActivePlan(request.userId);
    const usage = await getUsageSummary(request.userId, 'monthly');

    const limitsWithUsage = plan.limits.map((limit) => {
      const usageItem = usage.find((u) => {
        const mappedKey = usageTypeToLimitKey(u.type);
        return mappedKey === limit.key;
      });
      return {
        key: limit.key,
        limit: limit.value,
        period: limit.period,
        current: usageItem?.count ?? 0,
        percentage:
          limit.value === -1 ? 0 : Math.round(((usageItem?.count ?? 0) / limit.value) * 100),
      };
    });

    return reply.status(200).send(
      success({
        plan: {
          name: plan.planName,
          displayName: plan.displayName,
        },
        limits: limitsWithUsage,
        totalTokensUsed: usage.reduce((sum, u) => sum + u.tokensUsed, 0),
      }),
    );
  });

  /**
   * GET /v1/user/usage-analytics — Detailed usage breakdown.
   * Groups by type and by day for configurable period.
   */
  app.get('/v1/user/usage-analytics', { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { days?: string };
    const days = query.days ? parseInt(query.days, 10) : 30;
    const safeDays = Math.min(Math.max(days, 1), 365);

    const { getUserUsageAnalytics } = await import('../services/usage-analytics.service.js');

    const analytics = await getUserUsageAnalytics(request.userId, safeDays);

    audit(request.userId, 'read', 'usage_analytics');

    return reply.status(200).send(success(analytics));
  });

  /**
   * POST /v1/consents — Store consent record.
   * Can be called without auth (pre-login consent).
   */
  app.post(
    '/v1/consents',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const consentSchema = z.object({
        categories: z
          .record(z.boolean())
          .refine((obj) => Object.keys(obj).length <= 20, 'Too many category keys (max 20)'),
        version: z.string().min(1).max(50),
      });

      const parsed = consentSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid consent data',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { categories, version } = parsed.data;

      // Try to get userId if authenticated
      let userId: string | null = null;
      try {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const { verifyToken } = await import('../lib/tokens.js');
          const payload = await verifyToken(authHeader.slice(7));
          userId = payload.sub;
        }
      } catch {
        // Not authenticated — consent still stored
      }

      const result = await storeConsent(userId, categories, version, request.ip);

      return reply.status(201).send(success(result));
    },
  );
}

function usageTypeToLimitKey(type: string): string {
  const map: Record<string, string> = {
    context_call: 'context_calls_per_month',
    memory_write: 'memory_writes_per_month',
    extract_call: 'extract_calls_per_month',
  };
  return map[type] ?? type;
}
