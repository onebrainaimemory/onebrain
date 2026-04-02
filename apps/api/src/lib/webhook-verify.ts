import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies a GitHub webhook signature (X-Hub-Signature-256 header).
 * GitHub signs payloads with HMAC-SHA256 prefixed by "sha256=".
 *
 * @param payload - Raw request body as string or Buffer
 * @param signature - Value from X-Hub-Signature-256 header
 * @param secret - GitHub webhook secret
 * @returns true if signature is valid
 */
export function verifyGitHubSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSig = signature.slice(7);
  return verifyGenericHmac(payload, expectedSig, secret, 'sha256');
}

/**
 * Generic HMAC signature verification utility.
 * Compares an HMAC digest against a provided hex-encoded signature
 * using constant-time comparison.
 *
 * @param payload - Raw request body as string or Buffer
 * @param signature - Hex-encoded signature to verify against
 * @param secret - HMAC secret key
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns true if signature is valid
 */
export function verifyGenericHmac(
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: string = 'sha256',
): boolean {
  if (!payload || !signature || !secret) {
    return false;
  }

  const hmac = createHmac(algorithm, secret);
  hmac.update(payload);
  const computed = hmac.digest('hex');

  const computedBuf = Buffer.from(computed, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');

  if (computedBuf.length !== signatureBuf.length) {
    return false;
  }

  return timingSafeEqual(computedBuf, signatureBuf);
}
