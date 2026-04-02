import { createHmac, randomBytes, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import { getClient } from '@onebrain/db';
import { AuthError } from './auth.service.js';
import { encryptSecret, decryptSecret } from '../lib/encryption.js';
import { getCache, setCache } from '../lib/cache.js';

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;

/**
 * Generates a random base32-encoded secret for TOTP.
 */
export function generateTotpSecret(): string {
  const buffer = randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Builds the otpauth:// URL for QR code generation.
 */
export function buildOtpAuthUrl(
  secret: string,
  email: string,
  issuer: string = 'OneBrain',
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return (
    `otpauth://totp/${encodedIssuer}:${encodedEmail}` +
    `?secret=${secret}&issuer=${encodedIssuer}` +
    `&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`
  );
}

/**
 * Generates a TOTP code for a given secret and time counter.
 */
function generateTotpCode(secret: string, counter: number): string {
  const decodedSecret = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  let counterValue = counter;

  for (let i = 7; i >= 0; i--) {
    buffer[i] = counterValue & 0xff;
    counterValue = Math.floor(counterValue / 256);
  }

  const hmac = createHmac('sha1', decodedSecret);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1]! & 0x0f;
  const code =
    ((hmacResult[offset]! & 0x7f) << 24) |
    ((hmacResult[offset + 1]! & 0xff) << 16) |
    ((hmacResult[offset + 2]! & 0xff) << 8) |
    (hmacResult[offset + 3]! & 0xff);

  const otp = code % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

const TOTP_REPLAY_TTL = 90; // seconds — covers 3 TOTP periods (window overlap)
const TOTP_REPLAY_PREFIX = 'totp:replay:';

// Warn once if TOTP replay prevention falls back to in-memory (not safe for multi-instance)
let replayBackendWarned = false;

/**
 * Check whether a TOTP replay key has already been used.
 * Uses Redis (via the shared cache layer) when available,
 * falls back to an in-memory Map otherwise.
 *
 * WARNING: In-memory fallback is process-local and NOT safe for
 * multi-instance deployments. Ensure REDIS_URL is set in production.
 */
async function isReplayUsed(replayKey: string): Promise<boolean> {
  if (!replayBackendWarned && process.env.NODE_ENV === 'production' && !process.env['REDIS_URL']) {
    replayBackendWarned = true;
    console.warn(
      '[TOTP] REDIS_URL not set — replay prevention uses in-memory store. ' +
        'This is NOT safe for multi-instance deployments.',
    );
  }
  const cached = await getCache(`${TOTP_REPLAY_PREFIX}${replayKey}`);
  return cached !== null;
}

/**
 * Mark a TOTP replay key as used with automatic expiry.
 */
async function markReplayUsed(replayKey: string): Promise<void> {
  await setCache(`${TOTP_REPLAY_PREFIX}${replayKey}`, '1', TOTP_REPLAY_TTL);
}

/**
 * Verifies a TOTP code against a secret, allowing a window for clock drift.
 * Prevents replay by rejecting codes that were already used in the same window.
 * Uses Redis when available, falls back to in-memory cache.
 */
export async function verifyTotpCode(
  secret: string,
  code: string,
  userId?: string,
): Promise<boolean> {
  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);

  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const expectedCode = generateTotpCode(secret, currentCounter + i);
    if (timingSafeEqual(code, expectedCode)) {
      // Prevent replay: check if this code was already used by this user
      const replayKey = `${userId ?? secret}:${currentCounter + i}`;
      if (await isReplayUsed(replayKey)) {
        return false;
      }
      // Mark as used with TTL — expires automatically
      await markReplayUsed(replayKey);
      return true;
    }
  }

  return false;
}

/**
 * Sets up 2FA for a user: generates secret and returns it with the QR URL.
 */
export async function setupTotp(userId: string): Promise<{
  secret: string;
  otpauthUrl: string;
}> {
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabled: true },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'common.error', 404);
  }

  if (user.totpEnabled) {
    throw new AuthError('TOTP_ALREADY_ENABLED', 'auth.2fa.already_enabled', 400);
  }

  const secret = generateTotpSecret();

  let encrypted: string;
  try {
    encrypted = encryptSecret(secret);
  } catch {
    throw new AuthError('TOTP_SETUP_FAILED', 'common.error', 500);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encrypted },
  });

  const otpauthUrl = buildOtpAuthUrl(secret, user.email);

  return { secret, otpauthUrl };
}

/**
 * Verifies the initial TOTP code and enables 2FA on the account.
 */
export async function enableTotp(userId: string, code: string): Promise<void> {
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'common.error', 404);
  }

  if (user.totpEnabled) {
    throw new AuthError('TOTP_ALREADY_ENABLED', 'auth.2fa.already_enabled', 400);
  }

  if (!user.totpSecret) {
    throw new AuthError('TOTP_NOT_SETUP', 'auth.2fa.not_setup', 400);
  }

  const plainSecret = decryptSecret(user.totpSecret);
  const isValid = await verifyTotpCode(plainSecret, code, userId);
  if (!isValid) {
    throw new AuthError('INVALID_TOTP_CODE', 'auth.2fa.invalid_code', 401);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true },
  });
}

/**
 * Disables 2FA on the account after verifying a valid TOTP code.
 */
export async function disableTotp(userId: string, code: string): Promise<void> {
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'common.error', 404);
  }

  if (!user.totpEnabled || !user.totpSecret) {
    throw new AuthError('TOTP_NOT_ENABLED', 'auth.2fa.not_enabled', 400);
  }

  const plainSecret = decryptSecret(user.totpSecret);
  const isValid = await verifyTotpCode(plainSecret, code, userId);
  if (!isValid) {
    throw new AuthError('INVALID_TOTP_CODE', 'auth.2fa.invalid_code', 401);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: false, totpSecret: null },
  });
}

/**
 * Validates a 2FA code during login (after password verification).
 */
export async function validateTotpForLogin(userId: string, code: string): Promise<void> {
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user || !user.totpEnabled || !user.totpSecret) {
    throw new AuthError('TOTP_NOT_ENABLED', 'auth.2fa.not_enabled', 400);
  }

  const plainSecret = decryptSecret(user.totpSecret);
  const isValid = await verifyTotpCode(plainSecret, code, userId);
  if (!isValid) {
    throw new AuthError('INVALID_TOTP_CODE', 'auth.2fa.invalid_code', 401);
  }
}

// --- Base32 encoding/decoding utilities ---

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]!);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return nodeTimingSafeEqual(bufA, bufB);
}
