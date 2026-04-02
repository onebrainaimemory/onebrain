import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  isStripeEnabled,
} from '../services/stripe.service.js';
import { getActivePlan } from '../services/plan.service.js';
import { config } from '../config.js';

const checkoutSchema = z.object({
  priceId: z.string().min(1, 'priceId is required'),
  couponCode: z.string().max(255).optional(),
});

const changePlanSchema = z.object({
  priceId: z.string().min(1, 'priceId is required'),
});

const applyCouponSchema = z.object({
  couponCode: z.string().min(1, 'couponCode is required').max(255),
});

const billingRateLimit = {
  config: {
    rateLimit: { max: 30, timeWindow: '1 minute' },
  },
};

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /v1/billing/checkout — Create Stripe Checkout session.
   * Supports trial_period_days and coupon discounts.
   */
  app.post(
    '/v1/billing/checkout',
    { preHandler: requireAuth, ...billingRateLimit },
    async (request, reply) => {
      const parsed = checkoutSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message ?? 'Invalid input',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { priceId, couponCode } = parsed.data;
      const { getClient } = await import('@onebrain/db');
      const prisma = getClient();

      const plan = await prisma.plan.findFirst({
        where: {
          isActive: true,
          OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }],
        },
      });

      if (!plan) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid priceId — not linked to any active plan',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { email: true },
      });

      if (!user) {
        const res = error('USER_NOT_FOUND', 'User not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }

      const customerId = await getOrCreateStripeCustomer(request.userId, user.email);

      const origin = config.cors.origin;
      const url = await createCheckoutSession(
        customerId,
        priceId,
        `${origin}/dashboard?checkout=success`,
        `${origin}/pricing?checkout=canceled`,
        plan.trialDays > 0 ? plan.trialDays : undefined,
        couponCode ?? plan.stripeCouponId ?? undefined,
      );

      audit(request.userId, 'create', 'checkout_session');

      return reply.status(200).send(success({ url }));
    },
  );

  /**
   * POST /v1/billing/apply-coupon — Validate a coupon code.
   */
  app.post(
    '/v1/billing/apply-coupon',
    { preHandler: requireAuth, ...billingRateLimit },
    async (request, reply) => {
      const parsed = applyCouponSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message ?? 'Invalid input',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      if (!isStripeEnabled()) {
        const res = error('STRIPE_DISABLED', 'Stripe is not configured', 400);
        return reply.status(res.statusCode).send(res.body);
      }

      const { couponCode } = parsed.data;
      const { getStripe } = await import('../services/stripe.service.js');
      const stripe = await getStripe();

      try {
        const coupon = await stripe.coupons.retrieve(couponCode);

        if (!coupon.valid) {
          const res = error('COUPON_INVALID', 'This coupon is no longer valid', 400);
          return reply.status(res.statusCode).send(res.body);
        }

        audit(request.userId, 'validate', 'coupon', undefined, {
          couponCode,
        });

        return reply.status(200).send(
          success({
            valid: true,
            couponId: coupon.id,
            percentOff: coupon.percent_off,
            amountOff: coupon.amount_off,
            currency: coupon.currency,
            duration: coupon.duration,
          }),
        );
      } catch {
        const res = error('COUPON_NOT_FOUND', 'Coupon code not found', 404);
        return reply.status(res.statusCode).send(res.body);
      }
    },
  );

  /**
   * GET /v1/billing/invoices — List invoices for current user.
   */
  app.get('/v1/billing/invoices', { preHandler: requireAuth }, async (request, reply) => {
    if (!isStripeEnabled()) {
      return reply.status(200).send(success([]));
    }

    const { getClient } = await import('@onebrain/db');
    const prisma = getClient();

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return reply.status(200).send(success([]));
    }

    const { getStripe } = await import('../services/stripe.service.js');
    const stripe = await getStripe();

    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 100,
    });

    const formatted = invoices.data.map((inv) => ({
      id: inv.id,
      amount: inv.amount_paid ?? inv.total ?? 0,
      status: inv.status,
      date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      pdfUrl: inv.invoice_pdf ?? null,
    }));

    return reply.status(200).send(success(formatted));
  });

  /**
   * GET /v1/billing/portal — Get Stripe Customer Portal URL.
   */
  app.get('/v1/billing/portal', { preHandler: requireAuth }, async (request, reply) => {
    const { getClient } = await import('@onebrain/db');
    const prisma = getClient();

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      const res = error('NO_SUBSCRIPTION', 'No billing account found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    const origin = config.cors.origin;
    const url = await createPortalSession(user.stripeCustomerId, `${origin}/dashboard`);

    return reply.status(200).send(success({ url }));
  });

  /**
   * GET /v1/billing/subscription — Current subscription status.
   */
  app.get('/v1/billing/subscription', { preHandler: requireAuth }, async (request, reply) => {
    const { getClient } = await import('@onebrain/db');
    const prisma = getClient();

    const subscription = await prisma.subscription.findFirst({
      where: { userId: request.userId },
      include: {
        plan: {
          select: { name: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const plan = await getActivePlan(request.userId);

    return reply.status(200).send(
      success({
        plan: {
          name: plan.planName,
          displayName: plan.displayName,
        },
        subscription: subscription
          ? {
              status: subscription.status,
              periodEnd: subscription.periodEnd?.toISOString(),
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            }
          : null,
      }),
    );
  });

  /**
   * POST /v1/billing/change-plan — Upgrade/downgrade.
   */
  app.post(
    '/v1/billing/change-plan',
    { preHandler: requireAuth, ...billingRateLimit },
    async (request, reply) => {
      const parsed = changePlanSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message ?? 'Invalid input',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { priceId } = parsed.data;
      const { getClient } = await import('@onebrain/db');
      const prisma = getClient();

      const plan = await prisma.plan.findFirst({
        where: {
          isActive: true,
          OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }],
        },
      });

      if (!plan) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid priceId — not linked to any active plan',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          userId: request.userId,
          status: { in: ['active', 'trialing'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        const res = error(
          'NO_SUBSCRIPTION',
          'No active subscription found. Use checkout instead.',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const { getStripe } = await import('../services/stripe.service.js');
      const stripe = await getStripe();

      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [
          {
            id: stripeSubscription.items.data[0]!.id,
            price: priceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });

      audit(request.userId, 'update', 'subscription', undefined, {
        newPriceId: priceId,
      });

      return reply.status(200).send(success({ message: 'Plan change initiated' }));
    },
  );
}
