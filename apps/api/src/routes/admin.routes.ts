import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getClient } from '@onebrain/db';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { audit, getPersistedAuditLogs } from '../lib/audit.js';
import { getMetricsSnapshot } from '../lib/metrics.js';
import { maskEmail } from '../lib/pii-mask.js';
import { isMemoryEncryptionEnabled, encryptMemoryField } from '../lib/memory-encryption.js';

const updatePlanSchema = z
  .object({
    displayName: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
    isActive: z.boolean().optional(),
    priceMonthly: z.number().int().min(0).optional().nullable(),
    priceYearly: z.number().int().min(0).optional().nullable(),
    stripePriceIdMonthly: z.string().max(255).optional().nullable(),
    stripePriceIdYearly: z.string().max(255).optional().nullable(),
    trialDays: z.number().int().min(0).max(365).optional(),
    stripeCouponId: z.string().max(255).optional().nullable(),
  })
  .strict();

const createPlanSchema = z
  .object({
    name: z.string().min(1).max(100),
    displayName: z.string().min(1).max(255),
    description: z.string().max(2000).optional().nullable(),
    priceMonthly: z.number().int().min(0).optional().nullable(),
    priceYearly: z.number().int().min(0).optional().nullable(),
    stripePriceIdMonthly: z.string().max(255).optional().nullable(),
    stripePriceIdYearly: z.string().max(255).optional().nullable(),
    trialDays: z.number().int().min(0).max(365).optional(),
    stripeCouponId: z.string().max(255).optional().nullable(),
  })
  .strict();

const updatePlanLimitSchema = z
  .object({
    value: z.number().int().min(0).optional(),
    period: z.string().min(1).max(50).optional(),
  })
  .strict();

const updatePlanFeatureSchema = z
  .object({
    value: z.string().min(1).max(500).optional(),
  })
  .strict();

const updateUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    planName: z.string().min(1).max(100).optional(),
    role: z.enum(['user', 'admin']).optional(),
  })
  .strict();

const uuidSchema = z.string().uuid();

function parseUuidParam(
  params: Record<string, string>,
  key: string,
): { valid: true; value: string } | { valid: false; error: string } {
  const result = uuidSchema.safeParse(params[key]);
  if (!result.success) return { valid: false, error: `Invalid ${key} format` };
  return { valid: true, value: result.data };
}

/**
 * Admin routes for plan management.
 * All routes require JWT auth + admin role.
 */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);
  app.addHook('onRequest', requireAdmin);

  // Validate UUID format on all :id and :userId path params
  app.addHook('preHandler', async (request, reply) => {
    const params = request.params as Record<string, string>;
    for (const key of ['id', 'userId']) {
      if (params[key]) {
        const result = parseUuidParam(params, key);
        if (!result.valid) {
          const res = error('VALIDATION_ERROR', result.error, 400);
          reply.status(res.statusCode).send(res.body);
          return;
        }
      }
    }
  });

  // ── Plans ──────────────────────────────────────────────────

  /** List all plans */
  app.get('/v1/admin/plans', async (request) => {
    const prisma = getClient();
    const plans = await prisma.plan.findMany({
      include: {
        planLimits: true,
        planFeatures: true,
        _count: { select: { userPlans: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    audit(request.userId, 'read', 'plans');

    return success(
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        isActive: p.isActive,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        stripePriceIdMonthly: p.stripePriceIdMonthly,
        stripePriceIdYearly: p.stripePriceIdYearly,
        trialDays: p.trialDays,
        stripeCouponId: p.stripeCouponId,
        limits: p.planLimits,
        features: p.planFeatures,
        userCount: p._count.userPlans,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    );
  });

  /** Create a plan */
  app.post('/v1/admin/plans', async (request, reply) => {
    const parsed = createPlanSchema.safeParse(request.body);
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

    const {
      name,
      displayName,
      description,
      priceMonthly,
      priceYearly,
      stripePriceIdMonthly,
      stripePriceIdYearly,
      trialDays,
      stripeCouponId,
    } = parsed.data;

    const prisma = getClient();

    const existing = await prisma.plan.findUnique({ where: { name } });
    if (existing) {
      const res = error('CONFLICT', `Plan "${name}" already exists`, 409);
      return reply.status(res.statusCode).send(res.body);
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        displayName,
        description,
        priceMonthly,
        priceYearly,
        stripePriceIdMonthly,
        stripePriceIdYearly,
        trialDays: trialDays ?? 0,
        stripeCouponId,
      },
    });

    audit(request.userId, 'create', 'plan', plan.id);

    return reply.status(201).send(
      success({
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        isActive: plan.isActive,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        trialDays: plan.trialDays,
        stripeCouponId: plan.stripeCouponId,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      }),
    );
  });

  /** Update a plan */
  app.patch(
    '/v1/admin/plans/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const parsed = updatePlanSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message ?? 'Invalid input',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { id } = request.params;
      const prisma = getClient();

      const existing = await prisma.plan.findUnique({ where: { id } });
      if (!existing) {
        const res = error('NOT_FOUND', 'Plan not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const updated = await prisma.plan.update({
        where: { id },
        data: parsed.data,
      });

      audit(request.userId, 'update', 'plan', id);

      return success({
        id: updated.id,
        name: updated.name,
        displayName: updated.displayName,
        description: updated.description,
        isActive: updated.isActive,
        priceMonthly: updated.priceMonthly,
        priceYearly: updated.priceYearly,
        trialDays: updated.trialDays,
        stripeCouponId: updated.stripeCouponId,
        updatedAt: updated.updatedAt.toISOString(),
      });
    },
  );

  // ── Plan Limits ────────────────────────────────────────────

  /** List limits for a plan */
  app.get(
    '/v1/admin/plans/:id/limits',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { id } = request.params;
      const prisma = getClient();

      const plan = await prisma.plan.findUnique({ where: { id } });
      if (!plan) {
        const res = error('NOT_FOUND', 'Plan not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const limits = await prisma.planLimit.findMany({
        where: { planId: id },
        orderBy: { key: 'asc' },
      });

      return success(limits);
    },
  );

  /** Create a limit for a plan */
  app.post(
    '/v1/admin/plans/:id/limits',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const createPlanLimitSchema = z
        .object({
          key: z.string().min(1).max(100),
          value: z.number().int().min(0),
          period: z.string().min(1).max(50),
        })
        .strict();

      const parsed = createPlanLimitSchema.safeParse(request.body);
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

      const { id } = request.params;
      const { key, value, period } = parsed.data;

      const prisma = getClient();

      const plan = await prisma.plan.findUnique({ where: { id } });
      if (!plan) {
        const res = error('NOT_FOUND', 'Plan not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const limit = await prisma.planLimit.create({
        data: { planId: id, key, value, period },
      });

      audit(request.userId, 'create', 'plan_limit', limit.id, {
        planId: id,
      });

      return reply.status(201).send(success(limit));
    },
  );

  /** Update a plan limit */
  app.patch(
    '/v1/admin/plan-limits/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const parsed = updatePlanLimitSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message ?? 'Invalid input',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { id } = request.params;
      const prisma = getClient();

      const existing = await prisma.planLimit.findUnique({ where: { id } });
      if (!existing) {
        const res = error('NOT_FOUND', 'Plan limit not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const updated = await prisma.planLimit.update({
        where: { id },
        data: parsed.data,
      });

      audit(request.userId, 'update', 'plan_limit', id);

      return success(updated);
    },
  );

  /** Delete a plan limit */
  app.delete(
    '/v1/admin/plan-limits/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { id } = request.params;
      const prisma = getClient();

      const existing = await prisma.planLimit.findUnique({ where: { id } });
      if (!existing) {
        const res = error('NOT_FOUND', 'Plan limit not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      await prisma.planLimit.delete({ where: { id } });
      audit(request.userId, 'delete', 'plan_limit', id);

      return reply.status(204).send();
    },
  );

  // ── Plan Features ──────────────────────────────────────────

  /** List features for a plan */
  app.get(
    '/v1/admin/plans/:id/features',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { id } = request.params;
      const prisma = getClient();

      const plan = await prisma.plan.findUnique({ where: { id } });
      if (!plan) {
        const res = error('NOT_FOUND', 'Plan not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const features = await prisma.planFeature.findMany({
        where: { planId: id },
        orderBy: { key: 'asc' },
      });

      return success(features);
    },
  );

  /** Create a feature for a plan */
  app.post(
    '/v1/admin/plans/:id/features',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const createPlanFeatureSchema = z
        .object({
          key: z.string().min(1).max(100),
          value: z.string().min(1).max(500),
        })
        .strict();

      const parsed = createPlanFeatureSchema.safeParse(request.body);
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

      const { id } = request.params;
      const { key, value } = parsed.data;

      const prisma = getClient();

      const plan = await prisma.plan.findUnique({ where: { id } });
      if (!plan) {
        const res = error('NOT_FOUND', 'Plan not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const feature = await prisma.planFeature.create({
        data: { planId: id, key, value },
      });

      audit(request.userId, 'create', 'plan_feature', feature.id, {
        planId: id,
      });

      return reply.status(201).send(success(feature));
    },
  );

  /** Update a plan feature */
  app.patch(
    '/v1/admin/plan-features/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const parsed = updatePlanFeatureSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message ?? 'Invalid input',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { id } = request.params;
      const prisma = getClient();

      const existing = await prisma.planFeature.findUnique({
        where: { id },
      });
      if (!existing) {
        const res = error('NOT_FOUND', 'Plan feature not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const updated = await prisma.planFeature.update({
        where: { id },
        data: parsed.data,
      });

      audit(request.userId, 'update', 'plan_feature', id);

      return success(updated);
    },
  );

  /** Delete a plan feature */
  app.delete(
    '/v1/admin/plan-features/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { id } = request.params;
      const prisma = getClient();

      const existing = await prisma.planFeature.findUnique({
        where: { id },
      });
      if (!existing) {
        const res = error('NOT_FOUND', 'Plan feature not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      await prisma.planFeature.delete({ where: { id } });
      audit(request.userId, 'delete', 'plan_feature', id);

      return reply.status(204).send();
    },
  );

  // ── Users ──────────────────────────────────────────────────

  /** List all users with plan info */
  app.get('/v1/admin/users', async (request) => {
    const prisma = getClient();

    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        displayName: true,
        region: true,
        locale: true,
        role: true,
        isActive: true,
        createdAt: true,
        userPlans: {
          where: { isActive: true },
          include: {
            plan: { select: { name: true, displayName: true } },
          },
          take: 1,
        },
        _count: {
          select: {
            memoryItems: true,
            entities: true,
            projects: true,
            usageEvents: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    audit(request.userId, 'read', 'users');

    return success(
      users.map((u) => ({
        id: u.id,
        email: maskEmail(u.email),
        displayName: u.displayName,
        region: u.region,
        locale: u.locale,
        role: u.role,
        isActive: u.isActive,
        plan: u.userPlans[0]?.plan.displayName ?? 'Free',
        planName: u.userPlans[0]?.plan.name ?? 'free',
        memories: u._count.memoryItems,
        entities: u._count.entities,
        projects: u._count.projects,
        usageEvents: u._count.usageEvents,
        createdAt: u.createdAt.toISOString(),
      })),
    );
  });

  /** Update a user (activate/deactivate, change plan, change role) */
  app.patch(
    '/v1/admin/users/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message ?? 'Invalid input',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { id } = request.params;
      const { isActive, planName, role } = parsed.data;
      const prisma = getClient();

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        const res = error('NOT_FOUND', 'User not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const updateData: Record<string, unknown> = {};
      if (isActive !== undefined) updateData['isActive'] = isActive;
      if (role) updateData['role'] = role;

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({ where: { id }, data: updateData });
      }

      if (planName) {
        const plan = await prisma.plan.findUnique({
          where: { name: planName },
        });
        if (!plan) {
          const res = error('NOT_FOUND', `Plan "${planName}" not found`, 404);
          return reply.status(res.statusCode).send(res.body);
        }

        await prisma.userPlan.updateMany({
          where: { userId: id, isActive: true },
          data: { isActive: false },
        });

        await prisma.userPlan.create({
          data: { userId: id, planId: plan.id, isActive: true },
        });
      }

      audit(request.userId, 'update', 'user', id, {
        isActive,
        planName,
        role,
      });

      return success({ updated: true });
    },
  );

  // ── Usage ──────────────────────────────────────────────────

  /** Get usage summary for a user (admin view) */
  app.get(
    '/v1/admin/usage/:userId',
    async (
      request: FastifyRequest<{
        Params: { userId: string };
        Querystring: { period?: string };
      }>,
    ) => {
      const { userId } = request.params;
      const validPeriods = ['monthly', 'weekly', 'daily'] as const;
      const rawPeriod = request.query.period ?? 'monthly';
      const period = validPeriods.includes(rawPeriod as (typeof validPeriods)[number])
        ? (rawPeriod as (typeof validPeriods)[number])
        : 'monthly';
      const { getUsageSummary } = await import('../services/usage.service.js');

      const summary = await getUsageSummary(userId, period);
      return success(summary);
    },
  );

  // ── DSGVO Report ─────────────────────────────────────────

  /** GET /v1/admin/dsgvo-report — Generate DSGVO compliance report */
  app.get('/v1/admin/dsgvo-report', async (request) => {
    const { generateDsgvoReport } = await import('../services/dsgvo-report.service.js');

    const lastRetentionRun =
      ((app as unknown as Record<string, unknown>)['lastRetentionRun'] as string | null) ?? null;

    const report = await generateDsgvoReport(lastRetentionRun);

    audit(request.userId, 'read', 'dsgvo_report');

    return success(report);
  });

  // ── Audit Logs ─────────────────────────────────────────────

  /** Get persisted audit logs (cursor-paginated) */
  app.get(
    '/v1/admin/audit-logs',
    async (
      request: FastifyRequest<{
        Querystring: {
          userId?: string;
          cursor?: string;
          limit?: string;
        };
      }>,
    ) => {
      const { userId, cursor, limit } = request.query;

      const result = await getPersistedAuditLogs({
        userId,
        cursor,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return success(result.items, undefined);
    },
  );

  // ── Metrics ─────────────────────────────────────────────

  /** GET /v1/admin/metrics — System metrics snapshot */
  app.get('/v1/admin/metrics', async (request) => {
    const snapshot = getMetricsSnapshot();

    const memoryUsage = process.memoryUsage();

    audit(request.userId, 'read', 'metrics');

    return success({
      ...snapshot,
      process: {
        memoryMb: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
        nodeVersion: process.version,
        pid: process.pid,
      },
      collectedAt: new Date().toISOString(),
    });
  });

  // ── Encryption Migration ────────────────────────────────

  /**
   * POST /v1/admin/encrypt-memories
   * One-time migration: encrypts all existing unencrypted memories.
   * Processes in batches of 50 to avoid memory/timeout issues.
   */
  app.post('/v1/admin/encrypt-memories', async (request, reply) => {
    if (!isMemoryEncryptionEnabled()) {
      const res = error('ENCRYPTION_NOT_CONFIGURED', 'MEMORY_ENCRYPTION_KEY is not set', 400);
      return reply.status(res.statusCode).send(res.body);
    }

    const prisma = getClient();
    const BATCH_SIZE = 50;
    let totalEncrypted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    // Count unencrypted memories first
    const unencryptedCount = await prisma.memoryItem.count({
      where: { isEncrypted: false, deletedAt: null },
    });

    if (unencryptedCount === 0) {
      return success({
        encrypted: 0,
        skipped: 0,
        errors: [],
        message: 'All memories are already encrypted',
      });
    }

    // Process in batches
    let hasMore = true;
    while (hasMore) {
      const batch = await prisma.memoryItem.findMany({
        where: { isEncrypted: false, deletedAt: null },
        select: { id: true, userId: true, title: true, body: true },
        take: BATCH_SIZE,
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of batch) {
        try {
          const encTitle = encryptMemoryField(item.userId, item.title);
          const encBody = encryptMemoryField(item.userId, item.body);

          await prisma.memoryItem.update({
            where: { id: item.id },
            data: {
              title: encTitle,
              body: encBody,
              isEncrypted: true,
            },
          });
          totalEncrypted++;
        } catch (err) {
          totalSkipped++;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${item.id}: ${msg}`);
          if (errors.length >= 20) {
            hasMore = false;
            break;
          }
        }
      }

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    audit(request.userId, 'encrypt_migration', 'memory_items', undefined, {
      encrypted: totalEncrypted,
      skipped: totalSkipped,
    });

    return success({
      encrypted: totalEncrypted,
      skipped: totalSkipped,
      errors,
      message:
        totalSkipped > 0
          ? `Encrypted ${totalEncrypted} memories, ${totalSkipped} failed`
          : `Successfully encrypted ${totalEncrypted} memories`,
    });
  });
}
