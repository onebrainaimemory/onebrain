import type { FastifyRequest, FastifyReply } from 'fastify';
import { getActivePlan, isWithinLimit } from '../services/plan.service.js';
import { getUsageCount } from '../services/usage.service.js';
import { error } from '../lib/response.js';
import { recordError } from '../lib/metrics.js';

/** Maps route usage types to plan limit keys. */
const USAGE_TYPE_TO_LIMIT_KEY: Record<string, string> = {
  context_call: 'context_calls_per_month',
  memory_write: 'memory_writes_per_month',
  extract_call: 'extract_calls_per_month',
};

/** Period-to-seconds mapping for Retry-After header calculation. */
const PERIOD_SECONDS: Record<string, number> = {
  daily: 86400,
  weekly: 604800,
  monthly: 2592000,
};

/** HTTP methods considered write operations. */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Middleware factory that enforces plan limits for a given usage type.
 * Checks the user's active plan limit for the usage type and rejects
 * if the limit is exceeded.
 */
export function enforcePlanLimit(usageType: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const limitKey = USAGE_TYPE_TO_LIMIT_KEY[usageType] ?? usageType;

      const plan = await getActivePlan(request.userId);
      const limitDef = plan.limits.find((l) => l.key === limitKey);

      if (!limitDef) {
        // No limit defined — allow
        return;
      }

      const period = limitDef.period as 'monthly' | 'weekly' | 'daily';
      const currentUsage = await getUsageCount(request.userId, usageType, period);

      if (!isWithinLimit(currentUsage, limitDef.value)) {
        const retryAfter = PERIOD_SECONDS[period] ?? 3600;
        reply.header('Retry-After', String(retryAfter));
        const res = error(
          'LIMIT_EXCEEDED',
          `You have reached your ${plan.displayName} plan limit for ${limitKey} (${limitDef.value}/${limitDef.period})`,
          429,
        );
        reply.status(res.statusCode).send(res.body);
      }
    } catch (err) {
      const isWrite = WRITE_METHODS.has(request.method);
      if (isWrite) {
        // Fail-closed on writes: reject when plan system is unavailable
        request.log.error(
          { usageType, err },
          'Plan limit enforcement failed — rejecting write (fail-closed)',
        );
        recordError();
        const res = error(
          'SERVICE_UNAVAILABLE',
          'Unable to verify plan limits. Please try again later.',
          503,
        );
        reply.status(res.statusCode).send(res.body);
      } else {
        // Fail-open on reads: allow request if plan system is unavailable
        request.log.error(
          { usageType, err },
          'Plan limit enforcement failed — allowing read (fail-open)',
        );
        recordError();
      }
    }
  };
}
