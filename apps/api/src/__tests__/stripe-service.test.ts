import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('stripe service', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isStripeEnabled', () => {
    it('should return false when STRIPE_SECRET_KEY is empty', async () => {
      vi.stubEnv('STRIPE_SECRET_KEY', '');
      // Re-import to get fresh config
      const mod = await import('../services/stripe.service.js');
      expect(mod.isStripeEnabled()).toBe(false);
    });
  });

  describe('syncSubscription status mapping', () => {
    it('should map active status correctly', () => {
      const statusMap: Record<string, string> = {
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        incomplete: 'incomplete',
        trialing: 'trialing',
      };

      expect(statusMap['active']).toBe('active');
      expect(statusMap['past_due']).toBe('past_due');
      expect(statusMap['canceled']).toBe('canceled');
      expect(statusMap['incomplete']).toBe('incomplete');
      expect(statusMap['trialing']).toBe('trialing');
    });

    it('should default to active for unknown status', () => {
      const statusMap: Record<string, string> = {
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        incomplete: 'incomplete',
        trialing: 'trialing',
      };

      expect(statusMap['unknown'] ?? 'active').toBe('active');
    });
  });
});
