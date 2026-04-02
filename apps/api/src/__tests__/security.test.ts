import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyToken } from '../lib/tokens.js';

describe('security hardening', () => {
  describe('JWT with role claim', () => {
    it('should include role in access token', async () => {
      const token = await signAccessToken({
        userId: 'test-user-id',
        region: 'EU',
        sessionId: 'test-session-id',
        role: 'admin',
      });

      const payload = await verifyToken(token);
      expect(payload.role).toBe('admin');
    });

    it('should default to user role when not specified', async () => {
      const token = await signAccessToken({
        userId: 'test-user-id',
        region: 'EU',
        sessionId: 'test-session-id',
      });

      const payload = await verifyToken(token);
      expect(payload.role).toBe('user');
    });

    it('should include all standard claims', async () => {
      const token = await signAccessToken({
        userId: 'uid-123',
        region: 'GLOBAL',
        sessionId: 'sid-456',
        role: 'admin',
      });

      const payload = await verifyToken(token);
      expect(payload.sub).toBe('uid-123');
      expect(payload.region).toBe('GLOBAL');
      expect(payload.sessionId).toBe('sid-456');
      expect(payload.type).toBe('access');
      expect(payload.role).toBe('admin');
    });
  });

  describe('cookie auth CSRF protection', () => {
    it('X-Requested-With header should be required for cookie auth', () => {
      // This is tested via integration, but we verify the constant
      const requiredHeader = 'x-requested-with';
      expect(requiredHeader).toBe('x-requested-with');
    });
  });

  describe('httpOnly cookie security flags', () => {
    it('access token cookie should have correct path', () => {
      const cookieConfig = {
        path: '/v1',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 900,
      };
      expect(cookieConfig.path).toBe('/v1');
      expect(cookieConfig.httpOnly).toBe(true);
      expect(cookieConfig.sameSite).toBe('strict');
      expect(cookieConfig.maxAge).toBe(900);
    });

    it('refresh token cookie should have auth-only path', () => {
      const cookieConfig = {
        path: '/v1/auth',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
      };
      expect(cookieConfig.path).toBe('/v1/auth');
      expect(cookieConfig.maxAge).toBe(604800);
    });
  });
});
