/**
 * Per-tenant memory encryption using HKDF + AES-256-GCM.
 *
 * Derives a unique encryption key per user from a master key using HKDF.
 * Encrypted values are prefixed with "menc:" for identification.
 *
 * Format: menc:{iv_hex}:{ciphertext_hex}:{tag_hex}
 *
 * Requires MEMORY_ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 */
import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'menc:';
const HKDF_HASH = 'sha256';
const HKDF_INFO = 'onebrain-memory-v1';
const DERIVED_KEY_LENGTH = 32;

let masterKey: Buffer | null = null;
const MAX_CACHE_SIZE = 1000;
const derivedKeyCache = new Map<string, Buffer>();

function getMasterKey(): Buffer | null {
  if (masterKey) return masterKey;

  const keyHex = process.env['MEMORY_ENCRYPTION_KEY'];
  if (!keyHex || keyHex.length !== 64) {
    return null;
  }

  masterKey = Buffer.from(keyHex, 'hex');
  return masterKey;
}

/**
 * Derives a per-user encryption key using HKDF.
 * Results are cached in memory for performance.
 */
function deriveUserKey(userId: string): Buffer | null {
  const cached = derivedKeyCache.get(userId);
  if (cached) return cached;

  const master = getMasterKey();
  if (!master) return null;

  const derived = Buffer.from(hkdfSync(HKDF_HASH, master, userId, HKDF_INFO, DERIVED_KEY_LENGTH));

  if (derivedKeyCache.size >= MAX_CACHE_SIZE) {
    const firstKey = derivedKeyCache.keys().next().value;
    if (firstKey) derivedKeyCache.delete(firstKey);
  }
  derivedKeyCache.set(userId, derived);
  return derived;
}

/**
 * Returns true if memory encryption is configured (master key present).
 */
export function isMemoryEncryptionEnabled(): boolean {
  return getMasterKey() !== null;
}

/**
 * Returns true if the value is encrypted (has menc: prefix).
 */
export function isMemoryEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypts a plaintext string for a specific user.
 * Returns format: menc:{iv_hex}:{ciphertext_hex}:{tag_hex}
 * In production, throws if MEMORY_ENCRYPTION_KEY is not set.
 * In dev/test, returns plaintext unchanged if key is missing.
 */
export function encryptMemoryField(userId: string, plaintext: string): string {
  if (isMemoryEncrypted(plaintext)) return plaintext;

  const key = deriveUserKey(userId);
  if (!key) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'MEMORY_ENCRYPTION_KEY is required in production — cannot store unencrypted memories',
      );
    }
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypts an encrypted memory field for a specific user.
 * If the value is not encrypted (no menc: prefix), returns it as-is.
 * In production, throws if MEMORY_ENCRYPTION_KEY is not set.
 */
export function decryptMemoryField(userId: string, value: string): string {
  if (!isMemoryEncrypted(value)) {
    if (!deriveUserKey(userId) && process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'MEMORY_ENCRYPTION_KEY is required in production — cannot serve unencrypted memories',
      );
    }
    return value;
  }

  const key = deriveUserKey(userId);
  if (!key) {
    throw new Error('MEMORY_ENCRYPTION_KEY required to decrypt encrypted memories');
  }

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted memory format');
  }

  const [ivHex, ciphertextHex, tagHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Encrypts title and body fields of a memory object.
 */
export function encryptMemory(
  userId: string,
  data: { title: string; body: string },
): { title: string; body: string; isEncrypted: boolean } {
  if (!isMemoryEncryptionEnabled()) {
    return { ...data, isEncrypted: false };
  }

  return {
    title: encryptMemoryField(userId, data.title),
    body: encryptMemoryField(userId, data.body),
    isEncrypted: true,
  };
}

/**
 * Decrypts title and body fields of a memory object.
 */
export function decryptMemory(
  userId: string,
  data: { title: string; body: string; isEncrypted?: boolean },
): { title: string; body: string } {
  if (!data.isEncrypted) {
    return { title: data.title, body: data.body };
  }

  return {
    title: decryptMemoryField(userId, data.title),
    body: decryptMemoryField(userId, data.body),
  };
}

/**
 * Clears the derived key cache (for testing or key rotation).
 */
export function clearKeyCache(): void {
  derivedKeyCache.clear();
  masterKey = null;
}
