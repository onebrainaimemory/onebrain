import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getAuthHeader, TEST_USER, TEST_ADMIN } from './helpers.js';

/**
 * Billing routes integration tests.
 * Tests billing endpoints with Stripe disabled (default for tests).
 */

vi.mock('@onebrain/db', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === TEST_USER.id) {
          return Promise.resolve({
            ...TEST_USER,
            stripeCustomerId: null,
          });
        }
        if (where.id === TEST_ADMIN.id) {
          return Promise.resolve({
            ...TEST_ADMIN,
            stripeCustomerId: 'cus_test_admin',
          });
        }
        return Promise.resolve(null);
      }),
    },
    plan: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'plan-free',
          name: 'free',
          displayName: 'Free',
          description: 'Free tier',
          priceMonthly: 0,
          priceYearly: 0,
          trialDays: 0,
          isActive: true,
          stripePriceIdMonthly: null,
          stripePriceIdYearly: null,
          stripeCouponId: null,
          planLimits: [{ key: 'memories', value: 100, period: 'monthly' }],
          planFeatures: [{ key: 'basic_search', value: 'true' }],
        },
      ]),
    },
    userPlan: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'up-1',
        userId: TEST_USER.id,
        planId: 'plan-free',
        isActive: true,
        plan: { name: 'free', displayName: 'Free' },
      }),
    },
    subscription: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    memoryItem: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    brainProfile: {
      findUnique: vi.fn().mockResolvedValue({
        summary: 'Test',
        traits: {},
        preferences: {},
      }),
    },
    entity: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    brainVersion: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    brainShare: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    referral: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  return {
    getClient: () => mockPrisma,
    __mockPrisma: mockPrisma,
  };
});

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'test-msg-id' }) },
  })),
}));

vi.mock('../../services/stripe.service.js', () => ({
  isStripeEnabled: () => false,
  getOrCreateStripeCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  getStripe: vi.fn(),
}));

let app: FastifyInstance;

beforeAll(async () => {
  const { buildApp } = await import('../../app.js');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('billing integration', () => {
  describe('GET /v1/plans/public', () => {
    it('should return public plans without auth', async () => {
      // /v1/plans/public is always registered (independent of Stripe)
      const response = await app.inject({
        method: 'GET',
        url: '/v1/plans/public',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('admin metrics endpoint', () => {
    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/admin/metrics',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'GET',
        url: '/v1/admin/metrics',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('export endpoint', () => {
    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/export/pdf',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return PDF content with auth', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'GET',
        url: '/v1/export/pdf',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('viral endpoints', () => {
    it('should return 401 for shares without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/shares',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/nonexistent-endpoint',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should never expose stack traces in errors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/nonexistent-endpoint',
      });

      const body = response.json();
      const bodyStr = JSON.stringify(body);
      expect(bodyStr).not.toContain('at ');
      expect(bodyStr).not.toContain('.ts:');
      expect(bodyStr).not.toContain('.js:');
    });
  });
});
