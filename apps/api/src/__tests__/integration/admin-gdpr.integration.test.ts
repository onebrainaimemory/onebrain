import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getAuthHeader, getAdminAuthHeader, TEST_USER, TEST_ADMIN } from './helpers.js';

/**
 * Admin & GDPR integration tests.
 * Verifies admin dashboard, plan management, metrics, audit logs,
 * GDPR data export, account deletion, consent storage, and usage analytics.
 */

const NOW = new Date('2026-03-22T12:00:00Z');

const MOCK_PLAN_ID = '00000000-0000-4000-a000-000000000001';
const MOCK_PLAN_LIMIT_ID = '00000000-0000-4000-a000-000000000002';
const MOCK_PLAN_FEATURE_ID = '00000000-0000-4000-a000-000000000003';

const MOCK_PLAN = {
  id: MOCK_PLAN_ID,
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
  createdAt: NOW,
  updatedAt: NOW,
  planLimits: [
    {
      id: MOCK_PLAN_LIMIT_ID,
      planId: MOCK_PLAN_ID,
      key: 'memories',
      value: 100,
      period: 'monthly',
    },
  ],
  planFeatures: [
    { id: MOCK_PLAN_FEATURE_ID, planId: MOCK_PLAN_ID, key: 'basic_search', value: 'true' },
  ],
  _count: { userPlans: 10 },
};

const MOCK_AUDIT_LOG = {
  id: 'al-1',
  userId: TEST_USER.id,
  action: 'create',
  resource: 'memory_item',
  resourceId: 'mem-1',
  details: {},
  createdAt: NOW,
};

vi.mock('@onebrain/db', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === TEST_USER.id || where.email === TEST_USER.email) {
          return Promise.resolve({
            ...TEST_USER,
            stripeCustomerId: null,
            emailVerified: true,
            streakCount: 3,
            lastStreakDate: NOW,
            deletedAt: null,
          });
        }
        if (where.id === TEST_ADMIN.id || where.email === TEST_ADMIN.email) {
          return Promise.resolve({
            ...TEST_ADMIN,
            stripeCustomerId: null,
            emailVerified: true,
          });
        }
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          ...TEST_USER,
          stripeCustomerId: null,
          _count: { memoryItems: 42 },
          userPlans: [{ plan: { name: 'free', displayName: 'Free' } }],
        },
      ]),
      count: vi.fn().mockResolvedValue(2),
      create: vi.fn(),
      update: vi.fn().mockImplementation(({ where, data }) => {
        if (where.id === TEST_USER.id) {
          return Promise.resolve({
            ...TEST_USER,
            ...data,
            deletedAt: data.deletedAt ?? null,
          });
        }
        return Promise.resolve(null);
      }),
    },
    plan: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.name === 'free' || where.id === MOCK_PLAN_ID) {
          return Promise.resolve(MOCK_PLAN);
        }
        return Promise.resolve(null);
      }),
      findFirst: vi.fn().mockResolvedValue(MOCK_PLAN),
      findMany: vi.fn().mockResolvedValue([MOCK_PLAN]),
      create: vi.fn().mockResolvedValue(MOCK_PLAN),
      update: vi.fn().mockResolvedValue(MOCK_PLAN),
    },
    planLimit: {
      findMany: vi.fn().mockResolvedValue(MOCK_PLAN.planLimits),
      create: vi.fn().mockResolvedValue(MOCK_PLAN.planLimits[0]),
      update: vi.fn().mockResolvedValue(MOCK_PLAN.planLimits[0]),
      delete: vi.fn().mockResolvedValue(MOCK_PLAN.planLimits[0]),
    },
    planFeature: {
      findMany: vi.fn().mockResolvedValue(MOCK_PLAN.planFeatures),
      create: vi.fn().mockResolvedValue(MOCK_PLAN.planFeatures[0]),
      update: vi.fn().mockResolvedValue(MOCK_PLAN.planFeatures[0]),
      delete: vi.fn().mockResolvedValue(MOCK_PLAN.planFeatures[0]),
    },
    userPlan: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    usageEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([
        { type: 'context_call', _count: { id: 15 }, _sum: { tokensUsed: 5000 } },
        { type: 'memory_write', _count: { id: 8 }, _sum: { tokensUsed: 0 } },
      ]),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([MOCK_AUDIT_LOG]),
      count: vi.fn().mockResolvedValue(50),
      create: vi.fn(),
    },
    consent: {
      create: vi.fn().mockResolvedValue({
        id: 'consent-1',
        userId: null,
        categories: { necessary: true, statistics: false },
        version: '1.0',
        ipHash: 'hashed',
        createdAt: NOW,
      }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ version: '1.0' }),
      count: vi.fn().mockResolvedValue(5),
    },
    magicLinkToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    subscription: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    brainProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'bp-1',
        userId: TEST_USER.id,
        summary: 'Test',
        traits: {},
        preferences: {},
        createdAt: NOW,
        updatedAt: NOW,
      }),
      create: vi.fn(),
    },
    memoryItem: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'mem-1',
          type: 'fact',
          title: 'Test',
          body: 'Test body',
          confidence: 0.9,
          status: 'active',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]),
      count: vi.fn().mockResolvedValue(42),
    },
    entity: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(5),
    },
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(2),
    },
    brainVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    brainShare: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    referral: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    dailyQuestion: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    apiKey: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    sourceEvent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    tag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
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

// ────────────────────────────────────────────────────────────
// Admin routes — require admin role
// ────────────────────────────────────────────────────────────

describe('admin', () => {
  describe('authorization', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/plans',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/plans',
        headers: { authorization: auth },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('plans management', () => {
    it('should list plans as admin', async () => {
      const auth = await getAdminAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/plans',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
    });

    it('should create a plan', async () => {
      const auth = await getAdminAuthHeader();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/plans',
        headers: { authorization: auth },
        payload: {
          name: 'pro',
          displayName: 'Pro',
          description: 'Professional plan',
          priceMonthly: 990,
          priceYearly: 9900,
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should update a plan', async () => {
      const auth = await getAdminAuthHeader();
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/plans/${MOCK_PLAN_ID}`,
        headers: { authorization: auth },
        payload: { displayName: 'Free Tier Updated' },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('user management', () => {
    it('should list users as admin', async () => {
      const auth = await getAdminAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/users',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
    });

    it('should reject user listing for non-admin', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/users',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('metrics', () => {
    it('should return metrics for admin', async () => {
      const auth = await getAdminAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/metrics',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
    });
  });

  describe('audit logs', () => {
    it('should list audit logs for admin', async () => {
      const auth = await getAdminAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-logs',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
    });

    it('should reject audit logs for non-admin', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-logs',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DSGVO report', () => {
    it('should generate DSGVO report for admin', async () => {
      const auth = await getAdminAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/dsgvo-report',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
    });
  });
});

// ────────────────────────────────────────────────────────────
// GDPR routes — data protection compliance
// ────────────────────────────────────────────────────────────

describe('GDPR compliance', () => {
  describe('account deletion (Art. 17)', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/user',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should soft-delete account with auth', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/user',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.message).toContain('deletion');
      expect(body.data.message).toContain('30 days');
    });
  });

  describe('account restoration', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/user/restore',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('data export (Art. 15/20)', () => {
    it('should export all user data', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/user/export',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      // GDPR export should include all data categories
      expect(body.data.profile || body.data.user).toBeDefined();
      expect(body.data.memories).toBeDefined();
    });
  });

  describe('usage summary', () => {
    it('should return usage vs plan limits', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/user/usage-summary',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.plan).toBeDefined();
      expect(body.data.limits).toBeInstanceOf(Array);
    });
  });

  describe('usage analytics', () => {
    it('should return usage breakdown', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/user/usage-analytics?days=30',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
    });
  });

  describe('consent storage', () => {
    it('should store consent without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/consents',
        payload: {
          categories: { necessary: true, statistics: false, marketing: false },
          version: '1.0',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data).toBeDefined();
    });

    it('should reject consent without categories', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/consents',
        payload: { version: '1.0' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject consent without version', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/consents',
        payload: { categories: { necessary: true } },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});

// ────────────────────────────────────────────────────────────
// Password auth — register + login
// ────────────────────────────────────────────────────────────

describe('password auth', () => {
  it('should reject registration with weak password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'new@example.com',
        password: '123',
        displayName: 'Test',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject login without credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject login with missing password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'test@example.com' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────
// Session management
// ────────────────────────────────────────────────────────────

describe('sessions', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
    });
    expect(res.statusCode).toBe(401);
  });

  it('should list active sessions', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
  });
});

// ────────────────────────────────────────────────────────────
// Viral features — shares, referrals
// ────────────────────────────────────────────────────────────

describe('viral features', () => {
  it('should return 401 for shares without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/shares' });
    expect(res.statusCode).toBe(401);
  });

  it('should list shares with auth', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/shares',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should return 401 for referrals without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/referrals' });
    expect(res.statusCode).toBe(401);
  });

  it('should list referrals with auth', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/referrals',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
  });
});
