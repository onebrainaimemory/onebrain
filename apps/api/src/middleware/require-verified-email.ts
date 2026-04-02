import type { FastifyRequest, FastifyReply } from 'fastify';
import { error } from '../lib/response.js';

/**
 * Middleware that blocks access for users with unverified email addresses.
 * Must be used after requireAuth middleware.
 * Skips check for API key authenticated requests (machine-to-machine).
 */
export async function requireVerifiedEmail(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // API key auth implies pre-established trust — skip email verification
  if (request.apiKeyScopes) return;

  const { getClient } = await import('@onebrain/db');
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { emailVerified: true },
  });

  if (!user) {
    const res = error('USER_NOT_FOUND', 'User not found', 404);
    reply.status(res.statusCode).send(res.body);
    return;
  }

  if (!user.emailVerified) {
    const res = error(
      'EMAIL_NOT_VERIFIED',
      'Please verify your email address before performing this action',
      403,
    );
    reply.status(res.statusCode).send(res.body);
    return;
  }
}
