import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getAuthHeader, TEST_USER, TEST_ADMIN } from './helpers.js';

/**
 * Core features integration tests.
 * Verifies OneBrain's primary value: brain profile, memory context,
 * entities, projects, tags, and connect protocol.
 */

const NOW = new Date('2026-03-22T12:00:00Z');

const MOCK_PROFILE = {
  id: 'bp-1',
  userId: TEST_USER.id,
  summary: 'A software engineer who loves TypeScript',
  traits: { analytical: true, creative: true },
  preferences: { language: 'TypeScript', editor: 'VS Code' },
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_MEMORY = {
  id: 'mem-1',
  userId: TEST_USER.id,
  type: 'fact',
  title: 'Loves TypeScript',
  body: 'User prefers TypeScript over JavaScript for all projects.',
  sourceType: 'user_input',
  confidence: 0.9,
  status: 'active',
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_ENTITY = {
  id: 'ent-1',
  userId: TEST_USER.id,
  name: 'React',
  type: 'technology',
  description: 'Frontend framework',
  metadata: {},
  createdAt: NOW,
  updatedAt: NOW,
  _count: { entityLinks: 3 },
  entityLinks: [],
};

const MOCK_PROJECT = {
  id: 'proj-1',
  userId: TEST_USER.id,
  name: 'OneBrain',
  description: 'Personal AI memory layer',
  status: 'active',
  metadata: {},
  createdAt: NOW,
  updatedAt: NOW,
  _count: { projectMemoryLinks: 3 },
};

const MOCK_TAG = {
  id: 'tag-1',
  userId: TEST_USER.id,
  name: 'important',
  color: '#ef4444',
  createdAt: NOW,
};

// Daily question feature removed

const MOCK_API_KEY = {
  id: 'ak-1',
  userId: TEST_USER.id,
  prefix: 'ob_test123',
  hashedSecret: 'hashed-secret',
  name: 'Test Key',
  scopes: ['connect.read', 'connect.write', 'brain.read', 'brain.write'],
  trustLevel: 'review',
  isActive: true,
  lastUsedAt: null,
  createdAt: NOW,
  expiresAt: null,
};

vi.mock('@onebrain/db', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === TEST_USER.id || where.email === TEST_USER.email) {
          return Promise.resolve({
            ...TEST_USER,
            stripeCustomerId: null,
            streakCount: 5,
            lastStreakDate: new Date('2026-03-21'),
          });
        }
        if (where.id === TEST_ADMIN.id || where.email === TEST_ADMIN.email) {
          return Promise.resolve({ ...TEST_ADMIN, stripeCustomerId: null });
        }
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({
        ...TEST_USER,
        streakCount: 6,
        lastStreakDate: NOW,
      }),
    },
    brainProfile: {
      findUnique: vi.fn().mockResolvedValue(MOCK_PROFILE),
      create: vi.fn().mockResolvedValue(MOCK_PROFILE),
      upsert: vi.fn().mockResolvedValue(MOCK_PROFILE),
    },
    memoryItem: {
      findMany: vi.fn().mockResolvedValue([MOCK_MEMORY]),
      findFirst: vi.fn().mockResolvedValue(MOCK_MEMORY),
      findUnique: vi.fn().mockResolvedValue(MOCK_MEMORY),
      create: vi.fn().mockResolvedValue(MOCK_MEMORY),
      update: vi.fn().mockResolvedValue({ ...MOCK_MEMORY, title: 'Updated' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue(MOCK_MEMORY),
      count: vi.fn().mockResolvedValue(42),
    },
    entity: {
      findMany: vi.fn().mockResolvedValue([MOCK_ENTITY]),
      findFirst: vi.fn().mockResolvedValue(MOCK_ENTITY),
      findUnique: vi.fn().mockResolvedValue(MOCK_ENTITY),
      create: vi.fn().mockResolvedValue(MOCK_ENTITY),
      update: vi.fn().mockResolvedValue(MOCK_ENTITY),
      delete: vi.fn().mockResolvedValue(MOCK_ENTITY),
      count: vi.fn().mockResolvedValue(5),
    },
    entityLink: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'el-1',
        entityId: 'ent-1',
        memoryItemId: 'mem-1',
        relationship: 'related_to',
        createdAt: NOW,
      }),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    project: {
      findMany: vi.fn().mockResolvedValue([MOCK_PROJECT]),
      findFirst: vi.fn().mockResolvedValue(MOCK_PROJECT),
      findUnique: vi.fn().mockResolvedValue(MOCK_PROJECT),
      create: vi.fn().mockResolvedValue(MOCK_PROJECT),
      update: vi.fn().mockResolvedValue(MOCK_PROJECT),
      delete: vi.fn().mockResolvedValue(MOCK_PROJECT),
      count: vi.fn().mockResolvedValue(2),
    },
    projectMemoryLink: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'pml-1',
        projectId: 'proj-1',
        memoryItemId: 'mem-1',
        createdAt: NOW,
      }),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    tag: {
      findMany: vi.fn().mockResolvedValue([MOCK_TAG]),
      findFirst: vi.fn().mockResolvedValue(MOCK_TAG),
      create: vi.fn().mockResolvedValue(MOCK_TAG),
      delete: vi.fn().mockResolvedValue(MOCK_TAG),
    },
    memoryTag: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'mt-1',
        memoryItemId: 'mem-1',
        tagId: 'tag-1',
      }),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    dailyQuestion: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    sourceEvent: {
      create: vi.fn().mockResolvedValue({ id: 'se-1' }),
    },
    brainVersion: {
      findFirst: vi.fn().mockResolvedValue({ version: 3 }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: 'bv-new',
        userId: TEST_USER.id,
        version: 4,
        snapshot: {},
        mergeLog: [],
        createdAt: NOW,
      }),
      count: vi.fn().mockResolvedValue(3),
    },
    apiKey: {
      findMany: vi.fn().mockResolvedValue([MOCK_API_KEY]),
      findFirst: vi.fn().mockResolvedValue(MOCK_API_KEY),
      findUnique: vi.fn().mockResolvedValue(MOCK_API_KEY),
      create: vi.fn().mockResolvedValue(MOCK_API_KEY),
      update: vi.fn().mockResolvedValue(MOCK_API_KEY),
      delete: vi.fn().mockResolvedValue(MOCK_API_KEY),
      count: vi.fn().mockResolvedValue(1),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({
        userId: TEST_USER.id,
        emailDaily: false,
        pushEnabled: false,
      }),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    plan: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userPlan: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    brainShare: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    referral: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    usageEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([]),
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
// 1. Brain Profile — the user's identity
// ────────────────────────────────────────────────────────────

describe('brain profile', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/brain/profile' });
    expect(res.statusCode).toBe(401);
  });

  it('should return brain profile with auth', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/brain/profile',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.summary).toBe('A software engineer who loves TypeScript');
    expect(body.data.traits).toEqual({ analytical: true, creative: true });
    expect(body.data.preferences).toEqual({ language: 'TypeScript', editor: 'VS Code' });
  });

  it('should update brain profile', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/brain/profile',
      headers: { authorization: auth },
      payload: {
        summary: 'Updated summary',
        traits: { focused: true },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
  });

  it('should reject invalid profile update', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/brain/profile',
      headers: { authorization: auth },
      payload: { summary: 123 }, // invalid type
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

// ────────────────────────────────────────────────────────────
// 2. Brain Context — aggregated view for AI consumption
// ────────────────────────────────────────────────────────────

describe('brain context', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/brain/context' });
    expect(res.statusCode).toBe(401);
  });

  it('should return brain context with auth', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/brain/context',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.profile).toBeDefined();
    expect(body.data.recentMemories).toBeInstanceOf(Array);
    expect(body.data.topEntities).toBeInstanceOf(Array);
    expect(body.data.activeProjects).toBeInstanceOf(Array);
    expect(body.data.stats).toBeDefined();
    expect(body.data.stats.totalMemories).toBe(42);
  });
});

// ────────────────────────────────────────────────────────────
// 3. Context Engine — scoped, token-budgeted context
// ────────────────────────────────────────────────────────────

describe('context engine', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/context/brief' });
    expect(res.statusCode).toBe(401);
  });

  it('should return context for brief scope', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/context/brief',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.formatted).toBeDefined();
    expect(body.data.meta).toBeDefined();
    expect(body.data.meta.scope).toBe('brief');
    expect(body.data.meta.tokenEstimate).toBeTypeOf('number');
  });

  it('should return context for deep scope', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/context/deep',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.meta.scope).toBe('deep');
  });

  it('should return text/plain when requested', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/context/assistant',
      headers: {
        authorization: auth,
        accept: 'text/plain',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.headers['x-token-estimate']).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────
// 4. Entities — knowledge graph nodes
// ────────────────────────────────────────────────────────────

describe('entities', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/entities' });
    expect(res.statusCode).toBe(401);
  });

  it('should list entities with auth', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/entities',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.meta.pagination).toBeDefined();
  });

  it('should create an entity', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/entities',
      headers: { authorization: auth },
      payload: {
        name: 'React',
        type: 'technology',
        description: 'Frontend framework',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('React');
  });

  it('should reject entity without name', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/entities',
      headers: { authorization: auth },
      payload: { type: 'technology' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should get entity graph view', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/entities/graph',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────
// 5. Projects — organizational containers
// ────────────────────────────────────────────────────────────

describe('projects', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/projects' });
    expect(res.statusCode).toBe(401);
  });

  it('should list projects with auth', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
  });

  it('should create a project', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { authorization: auth },
      payload: {
        name: 'OneBrain',
        description: 'Personal AI memory layer',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('OneBrain');
  });

  it('should reject project without name', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { authorization: auth },
      payload: { description: 'Missing name' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────
// 6. Tags — memory organization
// ────────────────────────────────────────────────────────────

describe('tags', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/tags' });
    expect(res.statusCode).toBe(401);
  });

  it('should list tags with auth', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tags',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data[0].name).toBe('important');
    expect(body.data[0].color).toBe('#ef4444');
  });

  it('should create a tag', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/tags',
      headers: { authorization: auth },
      payload: { name: 'important', color: '#ef4444' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('important');
  });

  it('should reject tag without name', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/tags',
      headers: { authorization: auth },
      payload: { color: '#000' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// 7. Daily Question — REMOVED (feature disabled)

// ────────────────────────────────────────────────────────────
// 8. API Keys — authentication for external integrations
// ────────────────────────────────────────────────────────────

describe('api keys', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/api-keys' });
    expect(res.statusCode).toBe(401);
  });

  it('should list api keys', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/api-keys',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items).toBeInstanceOf(Array);
  });

  it('should create an api key', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      headers: { authorization: auth },
      payload: {
        name: 'Test Key',
        scopes: ['connect.read', 'connect.write'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    // Secret should be returned once on creation
    expect(body.data.secret || body.data.fullKey).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────
// 9. User routes — streak, notifications
// ────────────────────────────────────────────────────────────

describe('user routes', () => {
  it('should return 401 for streak without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/user/streak' });
    expect(res.statusCode).toBe(401);
  });

  it('should return streak count', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/user/streak',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.streakCount).toBeTypeOf('number');
  });

  it('should return notification preferences', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/user/notifications',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────
// 10. Export routes — data portability
// ────────────────────────────────────────────────────────────

describe('export', () => {
  it('should return 401 for JSON export without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/export/json' });
    expect(res.statusCode).toBe(401);
  });

  it('should export as JSON', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/export/json',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
  });

  it('should export as Markdown', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/export/markdown',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
  });

  it('should generate AI prompt export', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/export/ai-prompt',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should export as PDF (HTML)', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/export/pdf',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-disposition']).toContain('attachment');
  });
});

// ────────────────────────────────────────────────────────────
// 11. Merge engine — deduplication and conflict resolution
// ────────────────────────────────────────────────────────────

describe('merge engine', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/merge/run' });
    expect(res.statusCode).toBe(401);
  });

  it('should trigger merge run', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/merge/run',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
  });

  it('should list merge history', async () => {
    const auth = await getAuthHeader();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merge/history',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────
// 12. OpenAPI & Legal — public endpoints
// ────────────────────────────────────────────────────────────

describe('public endpoints', () => {
  it('should serve OpenAPI spec without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/openapi.json',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBeDefined();
    expect(body.info).toBeDefined();
    expect(body.paths).toBeDefined();
  });

  it('should serve AI plugin manifest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/ai-plugin.json',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.schema_version).toBeDefined();
    expect(body.name_for_human).toBeDefined();
  });

  it('should serve legal DPA endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/legal/dpa',
    });

    expect(res.statusCode).toBe(200);
  });

  it('should serve plans without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/plans/public',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
  });
});

// ────────────────────────────────────────────────────────────
// 13. Security headers — on all responses
// ────────────────────────────────────────────────────────────

describe('security headers', () => {
  it('should include HSTS header', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  it('should include X-Content-Type-Options', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include CSP header', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('should include X-Frame-Options DENY', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('should not expose stack traces on 500', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/totally-unknown-route',
    });

    const body = JSON.stringify(res.json());
    expect(body).not.toContain('at ');
    expect(body).not.toContain('.ts:');
  });
});
