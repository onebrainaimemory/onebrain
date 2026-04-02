import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { getClient } from '@onebrain/db';
import { config } from '../config.js';
import { syncSubscription } from '../services/stripe.service.js';
import { audit } from '../lib/audit.js';

/**
 * Checks if a Stripe webhook event was already processed by
 * looking for an AuditLog entry with the event ID stored in
 * the details JSON (resourceId is UUID-typed, not suitable
 * for Stripe event IDs).
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const prisma = getClient();
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: 'webhook',
      resource: 'stripe_event',
      details: { path: ['eventId'], equals: eventId },
    },
    select: { id: true },
  });
  return existing !== null;
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Need raw body for Stripe signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  /**
   * POST /v1/webhooks/stripe — Stripe webhook handler.
   * No auth — verified via Stripe signature only.
   */
  app.post(
    '/v1/webhooks/stripe',
    { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { getStripe } = await import('../services/stripe.service.js');
      const stripe = await getStripe();

      const signature = request.headers['stripe-signature'] as string;
      if (!signature) {
        return reply.status(400).send({ error: 'Missing signature' });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          request.body as Buffer,
          signature,
          config.stripe.webhookSecret,
        );
      } catch {
        return reply.status(400).send({ error: 'Invalid webhook signature' });
      }

      // Idempotency check — DB-based via AuditLog
      if (await isEventProcessed(event.id)) {
        return reply.status(200).send({ received: true });
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.mode === 'subscription' && session.subscription) {
              const sub = await stripe.subscriptions.retrieve(session.subscription as string);
              await handleSubscriptionUpdate(sub as unknown as StripeSubscriptionData);
            }
            break;
          }
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            const subscription = event.data.object as unknown as StripeSubscriptionData;
            await handleSubscriptionUpdate(subscription);
            break;
          }
          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            const subId = (invoice as unknown as Record<string, unknown>)['subscription'] as
              | string
              | undefined;
            if (subId) {
              const sub = await stripe.subscriptions.retrieve(subId);
              await handleSubscriptionUpdate(sub as unknown as StripeSubscriptionData);
            }
            break;
          }
          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            request.log.warn({ invoiceId: invoice.id }, 'Payment failed');
            break;
          }
        }
      } catch (err) {
        request.log.error(err, 'Webhook processing error');
        // Return 500 so Stripe retries the webhook
        return reply.status(500).send({ error: 'Webhook processing failed' });
      }

      // Record event as processed for idempotency
      audit('system', 'webhook', 'stripe_event', undefined, {
        eventId: event.id,
        type: event.type,
      });

      return reply.status(200).send({ received: true });
    },
  );
}

interface StripeSubscriptionData {
  id: string;
  customer: string | { id: string };
  status: string;
  items: { data: Array<{ price: { id: string } }> };
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end: boolean;
}

async function handleSubscriptionUpdate(subscription: StripeSubscriptionData): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const priceId = subscription.items.data[0]?.price.id ?? '';

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : new Date();
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : new Date();

  await syncSubscription(
    subscription.id,
    customerId,
    subscription.status,
    priceId,
    periodStart,
    periodEnd,
    subscription.cancel_at_period_end,
  );

  audit('system', 'webhook', 'subscription', subscription.id, {
    status: subscription.status,
  });
}
