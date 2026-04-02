import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptMemoryField,
  decryptMemoryField,
  encryptMemory,
  decryptMemory,
  isMemoryEncrypted,
  isMemoryEncryptionEnabled,
  clearKeyCache,
} from '../lib/memory-encryption.js';
import { randomBytes } from 'node:crypto';

describe('memory-encryption', () => {
  const TEST_KEY = randomBytes(32).toString('hex');
  const TEST_USER_A = 'user-aaaa-bbbb-cccc-ddddeeeeee01';
  const TEST_USER_B = 'user-aaaa-bbbb-cccc-ddddeeeeee02';

  beforeEach(() => {
    clearKeyCache();
    process.env['MEMORY_ENCRYPTION_KEY'] = TEST_KEY;
  });

  afterEach(() => {
    clearKeyCache();
    delete process.env['MEMORY_ENCRYPTION_KEY'];
  });

  describe('isMemoryEncryptionEnabled', () => {
    it('returns true when key is configured', () => {
      expect(isMemoryEncryptionEnabled()).toBe(true);
    });

    it('returns false when key is missing', () => {
      delete process.env['MEMORY_ENCRYPTION_KEY'];
      clearKeyCache();
      expect(isMemoryEncryptionEnabled()).toBe(false);
    });

    it('returns false when key is too short', () => {
      process.env['MEMORY_ENCRYPTION_KEY'] = 'tooshort';
      clearKeyCache();
      expect(isMemoryEncryptionEnabled()).toBe(false);
    });
  });

  describe('encryptMemoryField / decryptMemoryField', () => {
    it('encrypts and decrypts correctly', () => {
      const plaintext = 'User prefers dark mode';
      const encrypted = encryptMemoryField(TEST_USER_A, plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(isMemoryEncrypted(encrypted)).toBe(true);

      const decrypted = decryptMemoryField(TEST_USER_A, encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for different users', () => {
      const plaintext = 'Same content for both users';
      const encA = encryptMemoryField(TEST_USER_A, plaintext);
      const encB = encryptMemoryField(TEST_USER_B, plaintext);

      expect(encA).not.toBe(encB);

      // But both decrypt to the same plaintext with their own keys
      expect(decryptMemoryField(TEST_USER_A, encA)).toBe(plaintext);
      expect(decryptMemoryField(TEST_USER_B, encB)).toBe(plaintext);
    });

    it('user A cannot decrypt user B data', () => {
      const plaintext = 'Secret data';
      const encrypted = encryptMemoryField(TEST_USER_A, plaintext);

      expect(() => decryptMemoryField(TEST_USER_B, encrypted)).toThrow();
    });

    it('produces different ciphertext each time (unique IV)', () => {
      const plaintext = 'Same text encrypted twice';
      const enc1 = encryptMemoryField(TEST_USER_A, plaintext);
      const enc2 = encryptMemoryField(TEST_USER_A, plaintext);

      expect(enc1).not.toBe(enc2);

      // Both decrypt correctly
      expect(decryptMemoryField(TEST_USER_A, enc1)).toBe(plaintext);
      expect(decryptMemoryField(TEST_USER_A, enc2)).toBe(plaintext);
    });

    it('returns plaintext unchanged when encryption disabled', () => {
      delete process.env['MEMORY_ENCRYPTION_KEY'];
      clearKeyCache();

      const plaintext = 'Not encrypted';
      const result = encryptMemoryField(TEST_USER_A, plaintext);
      expect(result).toBe(plaintext);
    });

    it('returns unencrypted values as-is', () => {
      const plaintext = 'Already plain text';
      const result = decryptMemoryField(TEST_USER_A, plaintext);
      expect(result).toBe(plaintext);
    });

    it('does not double-encrypt already encrypted values', () => {
      const plaintext = 'Some data';
      const encrypted = encryptMemoryField(TEST_USER_A, plaintext);
      const doubleEncrypted = encryptMemoryField(TEST_USER_A, encrypted);

      // Should return the same encrypted value (skip re-encryption)
      expect(doubleEncrypted).toBe(encrypted);
    });

    it('handles unicode content correctly', () => {
      const plaintext = 'Benutzer bevorzugt dunkles Design. Lieblingsessen: Käsespätzle 🧀';
      const encrypted = encryptMemoryField(TEST_USER_A, plaintext);
      const decrypted = decryptMemoryField(TEST_USER_A, encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('handles empty strings', () => {
      const encrypted = encryptMemoryField(TEST_USER_A, '');
      const decrypted = decryptMemoryField(TEST_USER_A, encrypted);
      expect(decrypted).toBe('');
    });

    it('handles large content', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encryptMemoryField(TEST_USER_A, plaintext);
      const decrypted = decryptMemoryField(TEST_USER_A, encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptMemory / decryptMemory', () => {
    it('encrypts both title and body', () => {
      const data = { title: 'My Title', body: 'My body content' };
      const encrypted = encryptMemory(TEST_USER_A, data);

      expect(encrypted.isEncrypted).toBe(true);
      expect(isMemoryEncrypted(encrypted.title)).toBe(true);
      expect(isMemoryEncrypted(encrypted.body)).toBe(true);
    });

    it('decrypts both fields correctly', () => {
      const original = { title: 'My Title', body: 'My body content' };
      const encrypted = encryptMemory(TEST_USER_A, original);
      const decrypted = decryptMemory(TEST_USER_A, encrypted);

      expect(decrypted.title).toBe(original.title);
      expect(decrypted.body).toBe(original.body);
    });

    it('skips encryption when disabled', () => {
      delete process.env['MEMORY_ENCRYPTION_KEY'];
      clearKeyCache();

      const data = { title: 'Plain Title', body: 'Plain body' };
      const result = encryptMemory(TEST_USER_A, data);

      expect(result.isEncrypted).toBe(false);
      expect(result.title).toBe(data.title);
      expect(result.body).toBe(data.body);
    });

    it('skips decryption for unencrypted data', () => {
      const data = { title: 'Plain', body: 'Not encrypted', isEncrypted: false };
      const result = decryptMemory(TEST_USER_A, data);

      expect(result.title).toBe(data.title);
      expect(result.body).toBe(data.body);
    });
  });

  describe('isMemoryEncrypted', () => {
    it('returns true for menc: prefixed values', () => {
      expect(isMemoryEncrypted('menc:abc:def:ghi')).toBe(true);
    });

    it('returns false for plain values', () => {
      expect(isMemoryEncrypted('Hello world')).toBe(false);
    });

    it('returns false for enc: prefixed values (TOTP encryption)', () => {
      expect(isMemoryEncrypted('enc:abc:def:ghi')).toBe(false);
    });
  });
});
