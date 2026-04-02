import { config } from '../config.js';

/**
 * Simple cache abstraction.
 * Uses Redis when REDIS_URL is configured, falls back to
 * an in-memory Map for local development / testing.
 */

interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds: number): Promise<number>;
}

// ── In-memory fallback ─────────────────────────────────

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

class InMemoryCache implements CacheClient {
  private store = new Map<string, MemoryEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();
    if (entry && now <= entry.expiresAt) {
      const next = parseInt(entry.value, 10) + 1;
      entry.value = String(next);
      return next;
    }
    this.store.set(key, { value: '1', expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }
}

// ── Redis client (lazy-loaded) ─────────────────────────

let client: CacheClient | null = null;

async function getRedisClient(): Promise<CacheClient> {
  const { Redis } = await import('ioredis');
  const redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect();

  return {
    async get(key: string) {
      return redis.get(key);
    },
    async set(key: string, value: string, ttlSeconds: number) {
      await redis.set(key, value, 'EX', ttlSeconds);
    },
    async del(key: string) {
      await redis.del(key);
    },
    async incr(key: string, ttlSeconds: number) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      return count;
    },
  };
}

async function resolveClient(): Promise<CacheClient> {
  if (client) return client;

  if (config.redis.url) {
    try {
      client = await getRedisClient();
      return client;
    } catch {
      // Redis unavailable — fall back to in-memory
    }
  }

  client = new InMemoryCache();
  return client;
}

// ── Public API ─────────────────────────────────────────

export async function getCache(key: string): Promise<string | null> {
  const c = await resolveClient();
  return c.get(key);
}

export async function setCache(key: string, value: string, ttlSeconds: number): Promise<void> {
  const c = await resolveClient();
  await c.set(key, value, ttlSeconds);
}

export async function invalidateCache(key: string): Promise<void> {
  const c = await resolveClient();
  await c.del(key);
}

/**
 * Atomically increment a counter. Sets TTL on first increment.
 * Returns the new count.
 */
export async function incrementCache(key: string, ttlSeconds: number): Promise<number> {
  const c = await resolveClient();
  return c.incr(key, ttlSeconds);
}

/**
 * Reset cache client — used in tests.
 */
export function resetCacheClient(): void {
  client = null;
}
