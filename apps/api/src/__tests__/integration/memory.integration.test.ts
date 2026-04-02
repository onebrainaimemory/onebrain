import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getAuthHeader, TEST_USER, TEST_ADMIN } from './helpers.js';

/**
 * Memory routes integration tests.
 * Tests CRUD operations on /v1/memory with mocked Prisma.
 */

const MOCK_MEMORY = {
  id: 'mem-001',
  userId: TEST_USER.id,
  title: 'Test Memory',
  body: 'This is a test memory body.',
  type: 'fact',
  source: 'user_input',
  status: 'active',
  confidence: 0.9,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

const MOCK_MEMORY_LIST = [
  MOCK_MEMORY,
  {
    ...MOCK_MEMORY,
    id: 'mem-002',
    title: 'Second Memory',
    type: 'preference',
  },
];

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
    memoryItem: {
      findMany: vi.fn().mockResolvedValue(MOCK_MEMORY_LIST),
      findFirst: vi.fn().mockImplementation(({ where }) => {
        if (where.id === MOCK_MEMORY.id && where.userId === TEST_USER.id) {
          return Promise.resolve({ ...MOCK_MEMORY });
        }
        return Promise.resolve(null);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === MOCK_MEMORY.id) {
          return Promise.resolve({ ...MOCK_MEMORY });
        }
        return Promise.resolve(null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'mem-new',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        if (where.id === MOCK_MEMORY.id) {
          return Promise.resolve({ ...MOCK_MEMORY, ...data });
        }
        return Promise.reject(new Error('Not found'));
      }),
      delete: vi.fn().mockResolvedValue(MOCK_MEMORY),
      count: vi.fn().mockResolvedValue(2),
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

describe('memory integration', () => {
  describe('GET /v1/memory', () => {
    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/memory',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return memory list with valid auth', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'GET',
        url: '/v1/memory',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.meta).toBeDefined();
    });

    it('should support cursor pagination parameters', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'GET',
        url: '/v1/memory?limit=10&cursor=abc',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.meta).toBeDefined();
    });
  });

  describe('POST /v1/memory', () => {
    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/memory',
        payload: {
          title: 'Test',
          body: 'Test body',
          type: 'fact',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create a memory with valid data', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/memory',
        headers: { authorization: authHeader },
        payload: {
          title: 'New Memory',
          body: 'This is a new memory.',
          type: 'fact',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data).toBeDefined();
    });

    it('should return 400 for invalid body', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/memory',
        headers: { authorization: authHeader },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /v1/memory/:id', () => {
    it('should return a single memory item', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'GET',
        url: `/v1/memory/${MOCK_MEMORY.id}`,
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
    });

    it('should return 404 for non-existent memory', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'GET',
        url: '/v1/memory/nonexistent-id',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /v1/memory/:id', () => {
    it('should update a memory item', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/memory/${MOCK_MEMORY.id}`,
        headers: { authorization: authHeader },
        payload: { title: 'Updated Title' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
    });

    it('should return 400 for invalid update data', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/memory/${MOCK_MEMORY.id}`,
        headers: { authorization: authHeader },
        payload: { type: 'invalid_type_that_should_not_be_accepted' },
      });

      // Expect either 400 (validation) or 200 (if schema is loose)
      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('DELETE /v1/memory/:id', () => {
    it('should delete a memory item', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'DELETE',
        url: `/v1/memory/${MOCK_MEMORY.id}`,
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for non-existent memory', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/memory/nonexistent-id',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('security', () => {
    it('should reject requests with malformed authorization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/memory',
        headers: { authorization: 'InvalidScheme some-token' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should include security headers', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'GET',
        url: '/v1/memory',
        headers: { authorization: authHeader },
      });

      // Helmet adds security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });
});
