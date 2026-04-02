const IS_TEST = process.env['NODE_ENV'] === 'test';

function requireEnv(key: string, testFallback?: string): string {
  const value = process.env[key] ?? (IS_TEST ? testFallback : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  api: {
    port: parseInt(process.env['API_PORT'] ?? '3001', 10),
    host: process.env['API_HOST'] ?? '0.0.0.0',
  },
  auth: {
    jwtSecret: requireEnv('JWT_SECRET', 'test-jwt-secret-not-for-production'),
    jwtExpiry: process.env['JWT_EXPIRY'] ?? '15m',
    refreshTokenExpiry: process.env['REFRESH_TOKEN_EXPIRY'] ?? '7d',
    magicLinkExpiry: parseInt(process.env['MAGIC_LINK_EXPIRY_MS'] ?? String(15 * 60 * 1000), 10),
  },
  mail: {
    resendApiKey: process.env['RESEND_API_KEY'] ?? '',
    from: process.env['MAIL_FROM'] ?? 'OneBrain <noreply@onebrain.rocks>',
  },
  cors: {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
  },
  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'] ?? '',
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] ?? '',
    publishableKey: process.env['STRIPE_PUBLISHABLE_KEY'] ?? '',
  },
  redis: {
    url: process.env['REDIS_URL'] ?? '',
  },
  oauth: {
    google: {
      clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    },
    apple: {
      clientId: process.env['APPLE_CLIENT_ID'] ?? '',
    },
    github: {
      clientId: process.env['GITHUB_CLIENT_ID'] ?? '',
      clientSecret: process.env['GITHUB_CLIENT_SECRET'] ?? '',
    },
  },
  /**
   * Read replica URL for future PgBouncer-based read replicas.
   * Not yet wired into Prisma — document only.
   * When available, route read-heavy queries through this URL.
   */
  readDatabaseUrl: process.env['DATABASE_READ_URL'] ?? '',
  agentProvisioning: {
    key: process.env['AGENT_PROVISIONING_KEY'] ?? '',
  },
} as const;

// Guard: block production startup with the known test JWT secret
const TEST_JWT_FALLBACK = 'test-jwt-secret-not-for-production';
if (config.nodeEnv === 'production' && config.auth.jwtSecret === TEST_JWT_FALLBACK) {
  throw new Error(
    'FATAL: JWT_SECRET is set to the test fallback value in production. ' +
      'Set a secure, unique JWT_SECRET (min 32 chars) before deploying.',
  );
}
