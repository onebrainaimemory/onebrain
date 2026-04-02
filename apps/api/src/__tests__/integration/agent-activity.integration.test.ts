import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getAuthHeader, TEST_USER, TEST_ADMIN } from './helpers.js';

/**
 * Agent activity routes integration tests.
 * Tests agent list, summary, activity feed, candidate actions,
 * and API key configuration endpoints.
 */

const MOCK_API_KEY_ID = 'a0000000-0000-4000-8000-000000000001';

const MOCK_API_KEY = {
  id: MOCK_API_KEY_ID,
  userId: TEST_USER.id,
  name: 'Test Agent',
  prefix: 'ob_test_',
  keyHash: 'hashed',
  scopes: ['read:context', 'write:memories'],
  trustLevel: 'review',
  description: 'Test agent description',
  rateLimitPerMin: 60,
  isActive: true,
  lastUsedAt: new Date('2026-03-20'),
  lastSyncedAt: new Date('2026-03-19'),
  expiresAt: null,
  createdAt: new Date('2026-01-15'),
};

const MOCK_ACTIVITY = {
  id: 'act-001',
  apiKeyId: MOCK_API_KEY_ID,
  userId: TEST_USER.id,
  action: 'read',
  resource: 'context',
  status: 'success',
  details: null,
  createdAt: new Date('2026-03-21'),
  apiKey: { name: 'Test Agent', prefix: 'ob_test_' },
};

vi.mock('@onebrain/db', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === TEST_USER.id) {
          return Promise.resolve({ ...TEST_USER });
        }
        if (where.id === TEST_ADMIN.id) {
          return Promise.resolve({ ...TEST_ADMIN });
        }
        return Promise.resolve(null);
      }),
    },
    apiKey: {
      findMany: vi.fn().mockResolvedValue([MOCK_API_KEY]),
      findFirst: vi.fn().mockImplementation(({ where }) => {
        if (where.id === MOCK_API_KEY_ID && where.userId === TEST_USER.id) {
          return Promise.resolve({ ...MOCK_API_KEY });
        }
        return Promise.resolve(null);
      }),
      update: vi.fn().mockImplementation(({ data }) => {
        return Promise.resolve({
          ...MOCK_API_KEY,
          ...data,
        });
      }),
    },
    agentActivity: {
      create: vi.fn().mockResolvedValue(MOCK_ACTIVITY),
      count: vi.fn().mockResolvedValue(42),
      findMany: vi.fn().mockResolvedValue([MOCK_ACTIVITY]),
      groupBy: vi.fn().mockImplementation(({ by }) => {
        if (by.includes('action')) {
          return Promise.resolve([
            { action: 'read', _count: { id: 30 } },
            { action: 'write', _count: { id: 12 } },
          ]);
        }
        if (by.includes('status')) {
          return Promise.resolve([
            { status: 'success', _count: { id: 40 } },
            { status: 'error', _count: { id: 2 } },
          ]);
        }
        if (by.includes('apiKeyId')) {
          return Promise.resolve([{ apiKeyId: MOCK_API_KEY_ID, _count: { id: 42 } }]);
        }
        return Promise.resolve([]);
      }),
    },
    memoryItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(3),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      groupBy: vi.fn().mockResolvedValue([{ apiKeyId: MOCK_API_KEY_ID, _count: { id: 3 } }]),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    userPlan: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    plan: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn(),
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

describe('agent-activity integration', () => {
  // ── GET /v1/agents ──

  describe('GET /v1/agents', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return agent list with stats', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0]).toMatchObject({
        id: MOCK_API_KEY_ID,
        name: 'Test Agent',
        prefix: 'ob_test_',
        trustLevel: 'review',
        isActive: true,
      });
      expect(body.data[0].totalCalls).toBeDefined();
      expect(body.data[0].candidateCount).toBeDefined();
    });
  });

  // ── GET /v1/agents/summary ──

  describe('GET /v1/agents/summary', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/summary',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return cross-agent summary', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/summary?days=30',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toMatchObject({
        totalCalls: expect.any(Number),
        errorCount: expect.any(Number),
        errorRate: expect.any(Number),
        activeAgents: expect.any(Number),
        pendingCandidates: expect.any(Number),
      });
    });

    it('should reject invalid days parameter', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/summary?days=abc',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── GET /v1/agents/activity ──

  describe('GET /v1/agents/activity', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/activity',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return activity feed with pagination', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/activity?limit=20&days=30',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.data).toBeDefined();
      expect(body.data.meta).toBeDefined();
      expect(body.data.meta).toMatchObject({
        hasMore: expect.any(Boolean),
      });
    });
  });

  // ── GET /v1/agents/:id/summary ──

  describe('GET /v1/agents/:id/summary', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/agents/${MOCK_API_KEY_ID}/summary`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return single-agent summary', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: `/v1/agents/${MOCK_API_KEY_ID}/summary?days=30`,
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.totalCalls).toBeDefined();
      expect(body.data.errorRate).toBeDefined();
    });

    it('should return 404 for non-existent agent', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/00000000-0000-0000-0000-000000000000/summary?days=30',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/not-a-uuid/summary?days=30',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /v1/agents/:id/activity ──

  describe('GET /v1/agents/:id/activity', () => {
    it('should return single-agent activity feed', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: `/v1/agents/${MOCK_API_KEY_ID}/activity?limit=10&days=30`,
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.data).toBeDefined();
    });

    it('should return 404 for non-existent agent', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/00000000-0000-0000-0000-000000000000/activity?limit=10&days=30',
        headers: { authorization: auth },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /v1/agents/:id/candidates ──

  describe('POST /v1/agents/:id/candidates', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/agents/${MOCK_API_KEY_ID}/candidates`,
        payload: { action: 'approve' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should approve candidates', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'POST',
        url: `/v1/agents/${MOCK_API_KEY_ID}/candidates`,
        headers: { authorization: auth },
        payload: { action: 'approve' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toMatchObject({
        action: 'approve',
        updated: expect.any(Number),
      });
    });

    it('should dismiss candidates', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'POST',
        url: `/v1/agents/${MOCK_API_KEY_ID}/candidates`,
        headers: { authorization: auth },
        payload: { action: 'dismiss' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.action).toBe('dismiss');
    });

    it('should reject invalid action', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'POST',
        url: `/v1/agents/${MOCK_API_KEY_ID}/candidates`,
        headers: { authorization: auth },
        payload: { action: 'invalid' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-existent agent', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/00000000-0000-0000-0000-000000000000/candidates',
        headers: { authorization: auth },
        payload: { action: 'approve' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── PATCH /v1/api-keys/:id ──

  describe('PATCH /v1/api-keys/:id', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/api-keys/${MOCK_API_KEY_ID}`,
        payload: { name: 'Updated' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should update agent config', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/api-keys/${MOCK_API_KEY_ID}`,
        headers: { authorization: auth },
        payload: {
          name: 'Renamed Agent',
          trustLevel: 'trusted',
          rateLimitPerMin: 120,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(MOCK_API_KEY_ID);
    });

    it('should update scopes', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/api-keys/${MOCK_API_KEY_ID}`,
        headers: { authorization: auth },
        payload: {
          scopes: ['read:context'],
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should toggle active status', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/api-keys/${MOCK_API_KEY_ID}`,
        headers: { authorization: auth },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent key', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/api-keys/00000000-0000-0000-0000-000000000000',
        headers: { authorization: auth },
        payload: { name: 'Ghost' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const auth = await getAuthHeader();
      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/api-keys/not-a-uuid',
        headers: { authorization: auth },
        payload: { name: 'Bad' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
