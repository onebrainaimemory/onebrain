import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getAuthHeader, TEST_USER, TEST_ADMIN } from './helpers.js';

/**
 * Auth integration tests.
 * Uses app.inject() to test real HTTP request/response flow
 * with mocked database layer.
 */

// Mock @onebrain/db before importing the app
vi.mock('@onebrain/db', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === TEST_USER.id || where.email === TEST_USER.email) {
          return Promise.resolve({ ...TEST_USER });
        }
        if (where.id === TEST_ADMIN.id || where.email === TEST_ADMIN.email) {
          return Promise.resolve({ ...TEST_ADMIN });
        }
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    magicLink: {
      create: vi.fn().mockResolvedValue({ id: 'ml-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
      delete: vi.fn(),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: 'session-1',
        userId: TEST_USER.id,
        region: 'EU',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    brainProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
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

// Mock Resend to prevent actual email sending
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'test-msg-id' }) },
  })),
}));

// Suppress stripe import errors
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

describe('auth integration', () => {
  describe('POST /v1/auth/magic-link', () => {
    it('should return 200 for a valid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: {
          email: 'user@example.com',
          locale: 'en',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.message).toBeDefined();
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: { locale: 'en' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: { email: 'not-an-email', locale: 'en' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /v1/auth/verify', () => {
    it('should return 400 for missing token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/verify',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('should return 401 when no refresh token provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('MISSING_REFRESH_TOKEN');
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return 401 without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return user data with valid JWT', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(TEST_USER.id);
      expect(body.data.email).toBe(TEST_USER.email);
    });

    it('should return 404 for non-existent user', async () => {
      const authHeader = await getAuthHeader('nonexistent-user-id');
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 200 with valid auth', async () => {
      const authHeader = await getAuthHeader();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.message).toBeDefined();
    });
  });

  describe('response format', () => {
    it('should follow the API response envelope pattern', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: { email: 'user@example.com', locale: 'en' },
      });

      const body = response.json();
      expect(body.meta).toBeDefined();
      expect(body.meta.requestId).toBeDefined();
    });

    it('should include error envelope on failure', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: {},
      });

      const body = response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
      expect(body.meta).toBeDefined();
    });
  });
});

describe('health check integration', () => {
  it('should return minimal public health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.data.status).toBeDefined();
    expect(body.data.timestamp).toBeDefined();
    // Public health endpoint must NOT expose internal details
    expect(body.data.db).toBeUndefined();
    expect(body.data.redis).toBeUndefined();
    expect(body.data.lastRetentionRun).toBeUndefined();
  });

  it('should require admin for /health/details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/details',
    });

    expect(response.statusCode).toBe(401);
  });
});
