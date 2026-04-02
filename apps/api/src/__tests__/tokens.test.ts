import { describe, it, expect } from 'vitest';
import {
  generateMagicLinkToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from '../lib/tokens.js';

describe('tokens', () => {
  describe('generateMagicLinkToken', () => {
    it('should generate a raw token and its hash', () => {
      const { raw, hash } = generateMagicLinkToken();

      expect(raw).toBeDefined();
      expect(hash).toBeDefined();
      expect(raw).not.toBe(hash);
      expect(raw.length).toBe(64);
      expect(hash.length).toBe(64);
    });

    it('should generate unique tokens on each call', () => {
      const first = generateMagicLinkToken();
      const second = generateMagicLinkToken();

      expect(first.raw).not.toBe(second.raw);
      expect(first.hash).not.toBe(second.hash);
    });
  });

  describe('hashToken', () => {
    it('should produce consistent hash for same input', () => {
      const token = 'test-token-12345';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = hashToken('token-a');
      const hash2 = hashToken('token-b');

      expect(hash1).not.toBe(hash2);
    });

    it('should hash generated raw token to match its hash', () => {
      const { raw, hash } = generateMagicLinkToken();
      expect(hashToken(raw)).toBe(hash);
    });
  });

  describe('JWT access token', () => {
    const payload = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      region: 'EU',
      sessionId: '660e8400-e29b-41d4-a716-446655440001',
    };

    it('should sign and verify an access token', async () => {
      const token = await signAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = await verifyToken(token);

      expect(verified.sub).toBe(payload.userId);
      expect(verified.region).toBe(payload.region);
      expect(verified.sessionId).toBe(payload.sessionId);
      expect(verified.type).toBe('access');
    });
  });

  describe('JWT refresh token', () => {
    const payload = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      region: 'GLOBAL',
      sessionId: '660e8400-e29b-41d4-a716-446655440002',
    };

    it('should sign and verify a refresh token', async () => {
      const token = await signRefreshToken(payload);

      expect(token).toBeDefined();

      const verified = await verifyToken(token);

      expect(verified.sub).toBe(payload.userId);
      expect(verified.region).toBe(payload.region);
      expect(verified.sessionId).toBe(payload.sessionId);
      expect(verified.type).toBe('refresh');
    });
  });

  describe('JWT audience claim', () => {
    it('should include audience in access token', async () => {
      const token = await signAccessToken({
        userId: 'aud-test-user',
        region: 'EU',
        sessionId: 'aud-test-session',
      });

      // Decode the payload without verification to inspect claims
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
      expect(payload.aud).toBe('onebrain-api');
    });

    it('should include audience in refresh token', async () => {
      const token = await signRefreshToken({
        userId: 'aud-test-user',
        region: 'EU',
        sessionId: 'aud-test-session',
      });

      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
      expect(payload.aud).toBe('onebrain-api');
    });

    it('should reject token with wrong audience', async () => {
      // Manually create a token with wrong audience
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'test-secret-for-jwt-signing-minimum-32-chars!!',
      );

      const badToken = await new SignJWT({
        sub: 'test-user',
        region: 'EU',
        sessionId: 'test-session',
        type: 'access',
        role: 'user',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('onebrain')
        .setAudience('wrong-audience')
        .sign(secret);

      await expect(verifyToken(badToken)).rejects.toThrow();
    });

    it('should reject token with no audience', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'test-secret-for-jwt-signing-minimum-32-chars!!',
      );

      const noAudToken = await new SignJWT({
        sub: 'test-user',
        region: 'EU',
        sessionId: 'test-session',
        type: 'access',
        role: 'user',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('onebrain')
        // No .setAudience()
        .sign(secret);

      await expect(verifyToken(noAudToken)).rejects.toThrow();
    });
  });

  describe('JWT issuer validation', () => {
    it('should include issuer in access token', async () => {
      const token = await signAccessToken({
        userId: 'iss-test-user',
        region: 'EU',
        sessionId: 'iss-test-session',
      });

      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
      expect(payload.iss).toBe('onebrain');
    });
  });

  describe('verifyToken with invalid tokens', () => {
    it('should reject an invalid token', async () => {
      await expect(verifyToken('invalid-jwt-string')).rejects.toThrow();
    });

    it('should reject a tampered token', async () => {
      const token = await signAccessToken({
        userId: 'test-user',
        region: 'EU',
        sessionId: 'test-session',
      });

      const tampered = token.slice(0, -5) + 'XXXXX';
      await expect(verifyToken(tampered)).rejects.toThrow();
    });
  });
});
