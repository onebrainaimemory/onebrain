import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import type { ApiResponse } from '@onebrain/shared';
import { config } from './config.js';
import { requestSerializer } from './lib/pii-mask.js';
import { authRoutes } from './routes/auth.routes.js';
import { brainRoutes } from './routes/brain.routes.js';
import { memoryRoutes } from './routes/memory.routes.js';
import { entityRoutes } from './routes/entity.routes.js';
import { projectRoutes } from './routes/project.routes.js';
import { mergeRoutes } from './routes/merge.routes.js';
import { apiKeyRoutes } from './routes/api-key.routes.js';
// Daily question disabled — feature removed
// import { dailyQuestionRoutes } from './routes/daily-question.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { contextRoutes } from './routes/context.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { viralRoutes } from './routes/viral.routes.js';
import { gdprRoutes } from './routes/gdpr.routes.js';
import { connectRoutes } from './routes/connect.routes.js';
import { openapiRoutes } from './routes/openapi.routes.js';
import { aiPluginRoutes } from './routes/ai-plugin.routes.js';
import { passwordAuthRoutes } from './routes/password-auth.routes.js';
import { totpRoutes } from './routes/totp.routes.js';
import { sessionRoutes } from './routes/session.routes.js';
import { isStripeEnabled } from './services/stripe.service.js';
import { legalRoutes } from './routes/legal.routes.js';
import { tagRoutes } from './routes/tag.routes.js';
import { ingestRoutes } from './routes/ingest.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { agentActivityRoutes } from './routes/agent-activity.routes.js';
import { orgRoutes } from './routes/org.routes.js';
import { searchAndConsolidationRoutes } from './routes/search.routes.js';
import { skillRoutes } from './routes/skill.routes.js';
import { briefingRoutes } from './routes/briefing.routes.js';
import { startEmbeddingWorker, shutdownEmbeddingQueue } from './queues/embedding.queue.js';
import {
  startSkillAnalysisWorker,
  shutdownSkillAnalysisQueue,
  enqueueSkillLifecycle,
} from './queues/skill-analysis.queue.js';
import {
  startBriefingWorker,
  shutdownBriefingQueue,
  checkScheduledBriefings,
} from './queues/briefing.queue.js';
import { recordRequest, recordError } from './lib/metrics.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { usageMiddleware } from './middleware/usage-middleware.js';
import { getPrometheusMetrics } from './lib/prometheus.js';

/**
 * Parses CORS_ORIGIN into an array of explicit origins.
 * Rejects wildcard '*' in production for security.
 */
function parseCorsOrigins(raw: string, isProd: boolean): string[] | string {
  if (raw === '*' && isProd) {
    throw new Error(
      'CORS wildcard (*) is not allowed in production. ' +
        'Set CORS_ORIGIN to comma-separated explicit origins.',
    );
  }

  if (raw === '*') {
    return '*';
  }

  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (isProd && origins.some((o) => o === '*')) {
    throw new Error('CORS wildcard (*) is not allowed in production.');
  }

  return origins.length === 1 ? origins[0]! : origins;
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
      serializers: {
        req: requestSerializer,
      },
    },
    trustProxy:
      process.env['TRUSTED_PROXIES'] ?? '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8',
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // Global error handler — never expose stack traces
  app.setErrorHandler((err: Error & { statusCode?: number }, request, reply) => {
    request.log.error(err, 'Unhandled error');
    const statusCode = err.statusCode ?? 500;
    reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: statusCode >= 500 ? 'Internal server error' : err.message,
      },
      meta: { requestId: request.id },
    });
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // Permissions-Policy header (not supported by @fastify/helmet types)
  app.addHook('onRequest', async (_request, reply) => {
    reply.header(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)',
    );
  });

  const isProd = config.nodeEnv === 'production';
  const corsOrigin = parseCorsOrigins(config.cors.origin, isProd);
  const configuredOrigins: string[] = Array.isArray(corsOrigin)
    ? corsOrigin
    : corsOrigin === '*'
      ? []
      : [corsOrigin];

  // Accept all origins so the bookmarklet can call /v1/connect from any
  // AI chat site. Credentials are stripped for non-configured origins in
  // the onSend hook below, preventing CSRF while keeping cookie auth
  // working for the web app.
  await app.register(cors, {
    origin: (
      _origin: string | undefined,
      callback: (err: Error | null, allow: boolean) => void,
    ) => {
      callback(null, true);
    },
    credentials: true,
  });

  // Strip Access-Control-Allow-Credentials for non-configured origins.
  // onSend runs after the CORS plugin sets headers but before the
  // response is written to the socket — safe per Fastify lifecycle.
  app.addHook('onSend', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin) return;
    const isConfigured = corsOrigin === '*' || configuredOrigins.includes(origin);
    if (!isConfigured) {
      reply.removeHeader('access-control-allow-credentials');
    }
  });

  await app.register(cookie);

  // Multipart file upload support (max 10MB)
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  // Global rate limiting: 600/min authenticated
  await app.register(rateLimit, {
    global: true,
    max: 600,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.userId ?? request.ip;
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // Metrics: track request duration and errors
  app.addHook('onResponse', (_request, reply, done) => {
    const duration = reply.elapsedTime;
    recordRequest(duration);
    if (reply.statusCode >= 500) {
      recordError();
    }
    done();
  });

  // Public stats — aggregate counts only, no PII
  app.get(
    '/v1/stats/public',
    {
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request, _reply) => {
      const { getClient: getDb } = await import('@onebrain/db');
      const { success: ok } = await import('./lib/response.js');
      const { getCache, setCache } = await import('./lib/cache.js');

      const cacheKey = 'stats:public';
      const cached = await getCache(cacheKey);
      if (cached) {
        return ok(JSON.parse(cached), request.id);
      }

      const prisma = getDb();
      const [users, agents, brains, memories] = await Promise.all([
        prisma.user.count({ where: { accountType: 'human', isActive: true } }),
        prisma.user.count({ where: { accountType: 'agent', isActive: true } }),
        prisma.brainProfile.count(),
        prisma.memoryItem.count(),
      ]);

      const stats = { users, agents, brains, memories };
      await setCache(cacheKey, JSON.stringify(stats), 300);
      return ok(stats, request.id);
    },
  );

  // Public health check — minimal, no internal details
  app.get('/health', async (request, _reply) => {
    let dbOk = true;
    try {
      const { getClient } = await import('@onebrain/db');
      const prisma = getClient();
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }

    const response: ApiResponse<{
      status: string;
      timestamp: string;
    }> = {
      data: {
        status: dbOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
      },
      meta: { requestId: request.id },
    };
    return response;
  });

  // Authenticated detailed health — requires admin role
  app.get(
    '/health/details',
    {
      preHandler: [requireAuth, requireAdmin],
    },
    async (request, _reply) => {
      let dbStatus = 'ok';
      try {
        const { getClient } = await import('@onebrain/db');
        const prisma = getClient();
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        dbStatus = 'error';
      }

      let redisStatus = 'ok';
      try {
        const { getCache } = await import('./lib/cache.js');
        await getCache('health-check');
      } catch {
        redisStatus = 'degraded';
      }

      const status =
        dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : dbStatus === 'error' ? 'degraded' : 'ok';
      const lastRetentionRun =
        ((app as unknown as Record<string, unknown>)['lastRetentionRun'] as string | undefined) ??
        null;

      const response: ApiResponse<{
        status: string;
        timestamp: string;
        db: string;
        redis: string;
        lastRetentionRun: string | null;
      }> = {
        data: {
          status,
          timestamp: new Date().toISOString(),
          db: dbStatus,
          redis: redisStatus,
          lastRetentionRun,
        },
        meta: { requestId: request.id },
      };
      return response;
    },
  );

  // Core routes
  await app.register(authRoutes);
  await app.register(passwordAuthRoutes);
  await app.register(totpRoutes);
  await app.register(sessionRoutes);
  await app.register(brainRoutes);
  await app.register(memoryRoutes);
  await app.register(entityRoutes);
  await app.register(projectRoutes);
  await app.register(mergeRoutes);
  await app.register(apiKeyRoutes);
  // Daily question disabled — feature removed
  // await app.register(dailyQuestionRoutes);
  await app.register(userRoutes);
  await app.register(contextRoutes);
  await app.register(adminRoutes);
  await app.register(viralRoutes);
  await app.register(gdprRoutes);
  await app.register(connectRoutes);
  await app.register(openapiRoutes);
  await app.register(aiPluginRoutes);
  await app.register(legalRoutes);
  await app.register(tagRoutes);
  await app.register(ingestRoutes);
  await app.register(exportRoutes);
  await app.register(agentActivityRoutes);

  // Public plans endpoint — always available (no Stripe required)
  app.get('/v1/plans/public', async (_request, reply) => {
    const { getClient: getDb } = await import('@onebrain/db');
    const { success: ok } = await import('./lib/response.js');
    const prisma = getDb();
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      include: { planLimits: true, planFeatures: true },
      orderBy: { priceMonthly: 'asc' },
    });

    const stripeEnabled = !!(config.stripe.secretKey && config.stripe.publishableKey);

    return reply.status(200).send(
      ok(
        plans.map((p) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          trialDays: p.trialDays,
          ...(stripeEnabled && {
            stripePriceIdMonthly: p.stripePriceIdMonthly,
            stripePriceIdYearly: p.stripePriceIdYearly,
          }),
          limits: p.planLimits.map((l) => ({
            key: l.key,
            value: l.value,
            period: l.period,
          })),
          features: p.planFeatures.map((f) => ({
            key: f.key,
            value: f.value,
          })),
        })),
      ),
    );
  });

  // Stripe billing routes — only when configured
  if (isStripeEnabled()) {
    const { billingRoutes } = await import('./routes/billing.routes.js');
    const { webhookRoutes } = await import('./routes/webhook.routes.js');
    await app.register(billingRoutes);
    await app.register(webhookRoutes);
  }

  // Public self-service agent registration — always available
  const { agentRegisterRoutes } = await import('./routes/agent-register.routes.js');
  await app.register(agentRegisterRoutes);

  // Public invite-based registration + admin invite management
  const { inviteRoutes } = await import('./routes/invite.routes.js');
  await app.register(inviteRoutes);
  const { adminInviteRoutes } = await import('./routes/admin-invite.routes.js');
  await app.register(adminInviteRoutes);

  // Agent provisioning (admin, requires key) — only when key is configured
  if (config.agentProvisioning.key) {
    const { agentProvisionRoutes } = await import('./routes/agent-provision.routes.js');
    await app.register(agentProvisionRoutes);
  }

  // OAuth routes — only when at least one provider is configured
  if (config.oauth.google.clientId || config.oauth.apple.clientId || config.oauth.github.clientId) {
    const { oauthRoutes } = await import('./routes/oauth.routes.js');
    await app.register(oauthRoutes);
  }

  // Usage tracking middleware
  app.addHook('onResponse', usageMiddleware);

  // Prometheus metrics endpoint — admin-only to prevent information disclosure
  app.get(
    '/metrics',
    { logLevel: 'silent', preHandler: [requireAuth, requireAdmin] },
    async (_request, reply) => {
      reply.type('text/plain');
      return getPrometheusMetrics();
    },
  );

  await app.register(orgRoutes);
  await app.register(searchAndConsolidationRoutes);
  await app.register(skillRoutes);
  await app.register(briefingRoutes);

  // Background job interval references — exported for shutdown cleanup
  const jobTimers: NodeJS.Timeout[] = [];
  (app as unknown as Record<string, unknown>)['jobTimers'] = jobTimers;

  // Automated retention job scheduling (disable with DISABLE_RETENTION_JOB=true
  // when running the standalone retention-worker for multi-instance deployments)
  app.addHook('onReady', () => {
    if (process.env['DISABLE_RETENTION_JOB'] === 'true') {
      app.log.info('Retention job disabled (DISABLE_RETENTION_JOB=true)');
      return;
    }

    const intervalHours = parseInt(process.env['RETENTION_INTERVAL_HOURS'] ?? '6', 10);
    const intervalMs = intervalHours * 60 * 60 * 1000;

    const runRetention = async () => {
      try {
        const { runRetentionCleanup } = await import('./services/retention.service.js');
        const result = await runRetentionCleanup();
        const timestamp = new Date().toISOString();

        (app as unknown as Record<string, unknown>)['lastRetentionRun'] = timestamp;

        app.log.info({ result, timestamp }, 'Retention cleanup completed');
      } catch (err) {
        app.log.error(err, 'Retention cleanup failed');
      }
    };

    // Run once on startup, then at configured interval
    runRetention();
    const retentionTimer = setInterval(runRetention, intervalMs);
    jobTimers.push(retentionTimer);

    app.log.info({ intervalHours }, 'Retention job scheduled');

    // DeepRecall: start async embedding worker
    const embeddingWorker = startEmbeddingWorker();
    if (embeddingWorker) {
      app.log.info('DeepRecall embedding worker started');
    }

    // SkillForge: start skill analysis worker + daily lifecycle
    const skillWorker = startSkillAnalysisWorker();
    if (skillWorker) {
      app.log.info('SkillForge analysis worker started');

      // Daily lifecycle: decay/archive/promote (every 24h)
      const lifecycleTimer = setInterval(
        () => {
          enqueueSkillLifecycle().catch(() => {});
        },
        24 * 60 * 60 * 1000,
      );
      jobTimers.push(lifecycleTimer);

      // Run once on startup
      enqueueSkillLifecycle().catch(() => {});
    }

    // BrainPulse: start briefing worker + schedule checker
    const bpWorker = startBriefingWorker();
    if (bpWorker) {
      app.log.info('BrainPulse briefing worker started');

      // Scheduler tick: check due schedules every 60s
      const schedulerTimer = setInterval(() => {
        checkScheduledBriefings().catch(() => {});
      }, 60_000);
      jobTimers.push(schedulerTimer);
    }
  });

  // Graceful shutdown: close BullMQ connections
  app.addHook('onClose', async () => {
    for (const timer of jobTimers) {
      clearInterval(timer);
    }
    await shutdownEmbeddingQueue();
    await shutdownSkillAnalysisQueue();
    await shutdownBriefingQueue();
  });

  return app;
}
