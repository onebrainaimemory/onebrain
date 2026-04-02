import { getClient } from '@onebrain/db';
import { maskIp } from '../lib/pii-mask.js';
import { AuthError } from './auth.service.js';

interface SessionInfo {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  region: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/**
 * Lists all active sessions for a user with device information.
 */
export async function listSessions(
  userId: string,
  currentSessionId: string,
): Promise<SessionInfo[]> {
  const prisma = getClient();

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      deviceName: true,
      ipAddress: true,
      userAgent: true,
      region: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map((session) => ({
    id: session.id,
    deviceName: session.deviceName,
    ipAddress: session.ipAddress ? maskIp(session.ipAddress) : null,
    userAgent: session.userAgent,
    region: session.region,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    isCurrent: session.id === currentSessionId,
  }));
}

/**
 * Revokes a specific session by ID. Prevents revoking the current session.
 */
export async function revokeSession(
  userId: string,
  sessionId: string,
  currentSessionId: string,
): Promise<void> {
  if (sessionId === currentSessionId) {
    throw new AuthError('CANNOT_REVOKE_CURRENT', 'auth.sessions.cannot_revoke_current', 400);
  }

  const prisma = getClient();

  const deleted = await prisma.session.deleteMany({
    where: { id: sessionId, userId },
  });

  if (deleted.count === 0) {
    throw new AuthError('SESSION_NOT_FOUND', 'auth.sessions.not_found', 404);
  }
}

/**
 * Parses a user-agent string into a human-readable device name.
 */
export function parseDeviceName(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown Device';

  const ua = userAgent.toLowerCase();

  let os = 'Unknown OS';
  if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('cros')) os = 'ChromeOS';

  let browser = 'Unknown Browser';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg/') || ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';

  return `${browser} on ${os}`;
}
