import Stripe from 'stripe';
import type { getClient } from '@onebrain/db';
import { config } from '../config.js';

/**
 * Returns true if Stripe is configured (SaaS mode).
 * Self-hosted deployments skip Stripe entirely.
 */
export function isStripeEnabled(): boolean {
  return !!config.stripe.secretKey;
}

/**
 * Lazy-loaded Stripe instance. Only imported when Stripe is enabled.
 */
let stripeInstance: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (!isStripeEnabled()) {
    throw new Error('Stripe is not configured');
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(config.stripe.secretKey, {
      timeout: 30_000, // 30s request timeout
      maxNetworkRetries: 2, // Retry transient failures
    });
  }

  return stripeInstance;
}

/**
 * Gets or creates a Stripe customer for a user.
 */
export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const { getClient } = await import('@onebrain/db');
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Creates a Stripe Checkout session for a subscription.
 * Supports optional trial period and coupon/promo code.
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  trialDays?: number,
  couponCode?: string,
): Promise<string> {
  const stripe = await getStripe();

  const sessionParams: Record<string, unknown> = {
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  if (trialDays && trialDays > 0) {
    sessionParams['subscription_data'] = {
      trial_period_days: trialDays,
    };
  }

  if (couponCode) {
    sessionParams['discounts'] = [{ coupon: couponCode }];
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0],
  );

  return session.url!;
}

/**
 * Creates a Stripe Customer Portal session.
 */
export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const stripe = await getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Handles subscription state changes from Stripe webhooks.
 */
export async function syncSubscription(
  stripeSubscriptionId: string,
  customerId: string,
  status: string,
  priceId: string,
  periodStart: Date,
  periodEnd: Date,
  cancelAtPeriodEnd: boolean,
): Promise<void> {
  const { getClient } = await import('@onebrain/db');
  const prisma = getClient();

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  if (!user) return;

  // Find plan by Stripe price ID
  const plan = await prisma.plan.findFirst({
    where: {
      OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }],
    },
  });

  if (!plan) return;

  // Map Stripe status to our enum
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    trialing: 'trialing',
  };
  const mappedStatus = statusMap[status] ?? 'active';

  // Upsert subscription
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: mappedStatus as 'active',
        planId: plan.id,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        stripeSubscriptionId,
        status: mappedStatus as 'active',
        periodStart,
        periodEnd,
        cancelAtPeriodEnd,
      },
    });
  }

  // Sync UserPlan based on subscription status
  if (mappedStatus === 'active' || mappedStatus === 'trialing') {
    // Deactivate existing plans
    await prisma.userPlan.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    });

    // Activate subscription plan
    await prisma.userPlan.create({
      data: {
        userId: user.id,
        planId: plan.id,
        isActive: true,
        expiresAt: periodEnd,
      },
    });
  } else if (mappedStatus === 'canceled') {
    // On cancel: keep active until period end if cancelAtPeriodEnd
    if (!cancelAtPeriodEnd) {
      await fallbackToFreePlan(user.id, prisma);
    }
  }
}

/**
 * Falls back to free plan when subscription ends.
 */
async function fallbackToFreePlan(
  userId: string,
  prisma: ReturnType<typeof getClient>,
): Promise<void> {
  await prisma.userPlan.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });

  const freePlan = await prisma.plan.findUnique({
    where: { name: 'free' },
  });

  if (freePlan) {
    await prisma.userPlan.create({
      data: {
        userId,
        planId: freePlan.id,
        isActive: true,
      },
    });
  }
}
