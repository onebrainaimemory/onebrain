import { getClient } from '@onebrain/db';

/**
 * Returns the start of the current period for limit enforcement.
 */
export function getPeriodStart(period: 'monthly' | 'weekly' | 'daily'): Date {
  const now = new Date();

  if (period === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  if (period === 'weekly') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = start of week
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // daily
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Returns true if current usage is below the limit.
 * A limit of -1 means unlimited.
 */
export function isWithinLimit(current: number, limit: number): boolean {
  if (limit === -1) return true;
  return current < limit;
}

/**
 * Resolves a feature value from a list of plan features.
 */
export function resolveFeatureValue(
  features: Array<{ key: string; value: string }>,
  key: string,
  defaultValue?: string,
): string | undefined {
  const feature = features.find((f) => f.key === key);
  return feature ? feature.value : defaultValue;
}

/**
 * Returns true if a boolean feature flag is enabled.
 */
export function isFeatureEnabled(
  features: Array<{ key: string; value: string }>,
  key: string,
): boolean {
  const value = resolveFeatureValue(features, key);
  return value === 'true';
}

/**
 * Fetches the active plan for a user with limits and features.
 * Checks Stripe subscription first (if any), then UserPlan,
 * then falls back to free plan.
 */
export async function getActivePlan(userId: string) {
  const prisma = getClient();

  // Check for active Stripe subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
    },
    include: {
      plan: {
        include: {
          planLimits: true,
          planFeatures: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (subscription) {
    return formatPlan(subscription.plan);
  }

  // Check UserPlan (manual assignment or legacy)
  const userPlan = await prisma.userPlan.findFirst({
    where: {
      userId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      plan: {
        include: {
          planLimits: true,
          planFeatures: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (userPlan) {
    return formatPlan(userPlan.plan);
  }

  // Fallback to free plan
  const freePlan = await prisma.plan.findUnique({
    where: { name: 'free' },
    include: {
      planLimits: true,
      planFeatures: true,
    },
  });

  if (!freePlan) {
    return {
      planId: '',
      planName: 'free',
      displayName: 'Free',
      limits: [],
      features: [],
    };
  }

  return formatPlan(freePlan);
}

function formatPlan(plan: {
  id: string;
  name: string;
  displayName: string;
  planLimits: Array<{ key: string; value: number; period: string }>;
  planFeatures: Array<{ key: string; value: string }>;
}) {
  return {
    planId: plan.id,
    planName: plan.name,
    displayName: plan.displayName,
    limits: plan.planLimits.map((l) => ({
      key: l.key,
      value: l.value,
      period: l.period,
    })),
    features: plan.planFeatures.map((f) => ({
      key: f.key,
      value: f.value,
    })),
  };
}
