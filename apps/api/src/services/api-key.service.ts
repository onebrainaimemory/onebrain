import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getClient } from '@onebrain/db';
import type { CreateApiKeyInput } from '@onebrain/schemas';
import { hashToken } from '../lib/tokens.js';
import { audit } from '../lib/audit.js';

// ─────────────────────────────────────────────
// Valid scopes
// ─────────────────────────────────────────────

const VALID_SCOPES = new Set([
  'brain.read',
  'brain.write',
  'memory.extract.write',
  'entity.read',
  'entity.write',
  'connect.read',
  'connect.write',
]);

export function isValidScope(scope: string): boolean {
  return VALID_SCOPES.has(scope);
}

export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required);
}

// ─────────────────────────────────────────────
// Key generation
// ─────────────────────────────────────────────

export function generateApiKeySecret(): {
  prefix: string;
  secret: string;
  hash: string;
} {
  const prefixRandom = randomBytes(8).toString('hex');
  const prefix = `ob_${prefixRandom}`;
  const secret = randomBytes(24).toString('hex');
  const hash = hashToken(secret);
  return { prefix, secret, hash };
}

/**
 * Parse Authorization header for API key format: "ApiKey ob_prefix_secret"
 */
export function parseApiKeyHeader(header: string): { prefix: string; secret: string } | null {
  if (!header.startsWith('ApiKey ')) return null;

  const keyPart = header.slice(7);
  // Format: ob_XXXX_SECRET (prefix is ob_XXXX, secret is everything after second _)
  const firstUnderscore = keyPart.indexOf('_');
  if (firstUnderscore === -1) return null;

  const secondUnderscore = keyPart.indexOf('_', firstUnderscore + 1);
  if (secondUnderscore === -1) return null;

  const prefix = keyPart.slice(0, secondUnderscore);
  const secret = keyPart.slice(secondUnderscore + 1);

  if (!prefix || !secret) return null;

  return { prefix, secret };
}

/**
 * Parse a raw API key string: "ob_XXXX_SECRET"
 * Used for URL-based auth (Connect endpoint) where key is in path, not header.
 */
export function parseFullApiKey(key: string): { prefix: string; secret: string } | null {
  if (!key.startsWith('ob_')) return null;

  const firstUnderscore = key.indexOf('_');
  if (firstUnderscore === -1) return null;

  const secondUnderscore = key.indexOf('_', firstUnderscore + 1);
  if (secondUnderscore === -1) return null;

  const prefix = key.slice(0, secondUnderscore);
  const secret = key.slice(secondUnderscore + 1);

  if (!prefix || !secret) return null;

  return { prefix, secret };
}

// ─────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────

interface ApiKeyDto {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: string[];
  trustLevel: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ApiKeyCreatedDto extends ApiKeyDto {
  /** Full API key — only returned on creation, never again */
  fullKey: string;
}

interface ApiKeyListResult {
  items: ApiKeyDto[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

// ─────────────────────────────────────────────
// CRUD operations
// ─────────────────────────────────────────────

export async function createApiKey(
  userId: string,
  input: CreateApiKeyInput,
): Promise<ApiKeyCreatedDto> {
  const prisma = getClient();
  const { prefix, secret, hash } = generateApiKeySecret();

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const key = await prisma.apiKey.create({
    data: {
      userId,
      name: input.name,
      prefix,
      secretHash: hash,
      scopes: input.scopes,
      expiresAt,
    },
  });

  audit(userId, 'create', 'api_key', key.id, { prefix });

  return {
    id: key.id,
    userId: key.userId,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    trustLevel: key.trustLevel,
    lastUsedAt: null,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    fullKey: `${prefix}_${secret}`,
  };
}

export async function listApiKeys(
  userId: string,
  options: { cursor?: string; limit: number },
): Promise<ApiKeyListResult> {
  const prisma = getClient();
  const { cursor, limit } = options;

  const [items, total] = await Promise.all([
    prisma.apiKey.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.apiKey.count({ where: { userId } }),
  ]);

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1]!.id : null;

  audit(userId, 'list', 'api_keys', undefined, {
    count: resultItems.length,
  });

  return {
    items: resultItems.map((k) => ({
      id: k.id,
      userId: k.userId,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      trustLevel: k.trustLevel,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
    cursor: nextCursor,
    hasMore,
    total,
  };
}

export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const prisma = getClient();

  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  });

  if (!existing) return false;

  await prisma.apiKey.delete({ where: { id: keyId } });
  audit(userId, 'delete', 'api_key', keyId);
  return true;
}

const VALID_TRUST_LEVELS = ['trusted', 'untrusted'] as const;

export async function updateApiKeyTrustLevel(
  userId: string,
  keyId: string,
  trustLevel: string,
): Promise<ApiKeyDto | null> {
  if (!VALID_TRUST_LEVELS.includes(trustLevel as (typeof VALID_TRUST_LEVELS)[number])) {
    throw new Error(
      `Invalid trust level: ${trustLevel}. Must be one of: ${VALID_TRUST_LEVELS.join(', ')}`,
    );
  }

  const prisma = getClient();

  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  });
  if (!existing) return null;

  const updated = await prisma.apiKey.update({
    where: { id: keyId },
    data: { trustLevel },
  });

  audit(userId, 'update', 'api_key', keyId, { trustLevel });

  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    prefix: updated.prefix,
    scopes: updated.scopes,
    trustLevel: updated.trustLevel,
    lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
    expiresAt: updated.expiresAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Verify an API key from the request header.
 * Returns the key record if valid, null otherwise.
 */
export async function verifyApiKey(
  prefix: string,
  secret: string,
): Promise<{
  userId: string;
  scopes: string[];
  keyId: string;
} | null> {
  const prisma = getClient();

  const key = await prisma.apiKey.findFirst({
    where: { prefix },
  });

  if (!key) return null;

  // Check expiration
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Verify secret (timing-safe comparison)
  const computedHash = hashToken(secret);
  const expectedBuf = Buffer.from(key.secretHash, 'utf8');
  const computedBuf = Buffer.from(computedHash, 'utf8');
  if (expectedBuf.length !== computedBuf.length || !timingSafeEqual(expectedBuf, computedBuf)) {
    return null;
  }

  // Update lastUsedAt
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    userId: key.userId,
    scopes: key.scopes,
    keyId: key.id,
  };
}
