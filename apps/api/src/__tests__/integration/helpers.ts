/**
 * Shared helpers for integration tests.
 * Provides a pre-built Fastify app instance and JWT tokens
 * for authenticated requests using app.inject().
 */
import { signAccessToken } from '../../lib/tokens.js';

export const TEST_USER = {
  id: 'test-user-id-001',
  email: 'test@onebrain.test',
  displayName: 'Test User',
  region: 'EU',
  locale: 'en',
  role: 'user',
  isActive: true,
  emailVerified: true,
  createdAt: new Date('2026-01-01'),
  deletedAt: null,
} as const;

export const TEST_ADMIN = {
  id: 'test-admin-id-001',
  email: 'admin@onebrain.test',
  displayName: 'Test Admin',
  region: 'EU',
  locale: 'en',
  role: 'admin',
  isActive: true,
  emailVerified: true,
  createdAt: new Date('2026-01-01'),
  deletedAt: null,
} as const;

export async function getAuthHeader(userId: string = TEST_USER.id, role = 'user'): Promise<string> {
  const token = await signAccessToken({
    userId,
    region: 'EU',
    sessionId: 'test-session-id',
    role,
  });
  return `Bearer ${token}`;
}

export async function getAdminAuthHeader(): Promise<string> {
  return getAuthHeader(TEST_ADMIN.id, 'admin');
}
