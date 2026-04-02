import type { FastifyRequest, FastifyReply } from 'fastify';
import { trackUsage } from '../services/usage.service.js';

/**
 * Records API usage for every authenticated request.
 * Typed as an onResponse hook callback.
 */
export async function usageMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  void reply; // onResponse provides reply but we don't need it
  const url = request.url ?? '';
  if (url.startsWith('/health') || url === '/metrics') {
    return;
  }

  if (request.userId) {
    try {
      const endpoint = request.routeOptions?.url ?? url;
      await trackUsage(request.userId, `${request.method ?? 'GET'} ${endpoint}`);
    } catch {
      // Non-blocking
    }
  }
}

/**
 * Plan-based rate limit configuration.
 */
const PLAN_LIMITS: Record<string, { max: number; timeWindow: string }> = {
  free: { max: 100, timeWindow: '24 hours' },
  pro: { max: 10000, timeWindow: '24 hours' },
  enterprise: { max: 1000000, timeWindow: '24 hours' },
};

export function getPlanRateLimit(planName: string): { max: number; timeWindow: string } {
  return PLAN_LIMITS[planName] ?? PLAN_LIMITS['free']!;
}

export async function getUsageForPeriod(userId: string, period: 'daily' | 'weekly' | 'monthly') {
  const { getUsageSummary } = await import('../services/usage.service.js');
  return getUsageSummary(userId, period);
}

export async function getCurrentPlanDetails(userId: string) {
  const { getClient } = await import('@onebrain/db');
  const prisma = getClient();

  const userPlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: { plan: true },
  });

  if (!userPlan) {
    const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } });
    return {
      planName: freePlan?.name ?? 'free',
      displayName: freePlan?.displayName ?? 'Free',
    };
  }

  return {
    planName: userPlan.plan.name,
    displayName: userPlan.plan.displayName,
  };
}
