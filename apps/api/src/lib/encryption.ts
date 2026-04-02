import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'enc:';

let encryptionKey: Buffer | null = null;

function getKey(): Buffer | null {
  if (encryptionKey) return encryptionKey;

  const keyHex = process.env['TOTP_ENCRYPTION_KEY'];
  if (!keyHex || keyHex.length !== 64) {
    return null;
  }

  encryptionKey = Buffer.from(keyHex, 'hex');
  return encryptionKey;
}

/**
 * Returns true if the value appears to be encrypted (has the enc: prefix).
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns format: enc:{iv_hex}:{ciphertext_hex}:{tag_hex}
 * If no encryption key is configured, returns the plaintext unchanged.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'TOTP_ENCRYPTION_KEY is required in production. ' +
          "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
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
 * Decrypts an encrypted string. If the value is not encrypted
 * (no enc: prefix), returns it as-is (backward compatibility).
 */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value;

  const key = getKey();
  if (!key) {
    throw new Error('TOTP_ENCRYPTION_KEY required to decrypt encrypted TOTP secrets');
  }

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }

  const [ivHex, ciphertextHex, tagHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
