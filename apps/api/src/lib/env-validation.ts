/**
 * Environment variable validation.
 * Call validateEnv() at startup to fail fast on missing required variables.
 */

interface EnvValidation {
  key: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

const ENV_SCHEMA: EnvValidation[] = [
  { key: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  {
    key: 'REDIS_URL',
    required: false,
    description: 'Redis connection string',
    defaultValue: 'redis://localhost:6379',
  },
  { key: 'JWT_SECRET', required: true, description: 'JWT signing secret (min 32 chars)' },
  { key: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key for embeddings' },
  { key: 'STRIPE_SECRET_KEY', required: false, description: 'Stripe secret key' },
  { key: 'STRIPE_WEBHOOK_SECRET', required: false, description: 'Stripe webhook secret' },
  { key: 'STRIPE_PUBLISHABLE_KEY', required: false, description: 'Stripe publishable key' },
  { key: 'LOG_LEVEL', required: false, description: 'Logging level', defaultValue: 'info' },
  {
    key: 'NODE_ENV',
    required: false,
    description: 'Node environment',
    defaultValue: 'development',
  },
  { key: 'API_PORT', required: false, description: 'API server port', defaultValue: '3001' },
  { key: 'API_HOST', required: false, description: 'API server host', defaultValue: '0.0.0.0' },
  {
    key: 'CORS_ORIGIN',
    required: false,
    description: 'CORS origin(s)',
    defaultValue: 'http://localhost:3000',
  },
  {
    key: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key for transactional emails',
  },
  {
    key: 'MAIL_FROM',
    required: false,
    description: 'Email from address',
    defaultValue: 'OneBrain <noreply@onebrain.rocks>',
  },
  {
    key: 'MAGIC_LINK_EXPIRY_MS',
    required: false,
    description: 'Magic link expiry ms',
    defaultValue: '900000',
  },
  {
    key: 'API_PUBLIC_URL',
    required: false,
    description: 'Public-facing API URL (required in production to prevent host header injection)',
  },
  {
    key: 'AUDIT_LOG_RETENTION_DAYS',
    required: false,
    description: 'Audit log retention in days',
    defaultValue: '365',
  },
  {
    key: 'RETENTION_INTERVAL_HOURS',
    required: false,
    description: 'Retention job interval',
    defaultValue: '6',
  },
  {
    key: 'MEMORY_TTL_DAYS',
    required: false,
    description: 'Default memory TTL in days',
    defaultValue: '365',
  },
];

export interface EnvReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: Record<string, string | undefined>;
}

export function validateEnv(isTest = false): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: Record<string, string | undefined> = {};

  for (const entry of ENV_SCHEMA) {
    const value = process.env[entry.key] ?? entry.defaultValue;

    if (entry.required && !value) {
      if (isTest && entry.key === 'DATABASE_URL') {
        config[entry.key] = 'test-fallback';
        continue;
      }
      errors.push(`Missing required: ${entry.key} — ${entry.description}`);
    }

    config[entry.key] = value;

    if (!value && !entry.required) {
      warnings.push(`Optional not set: ${entry.key} — ${entry.description}`);
    }
  }

  // JWT secret length check — enforce in all environments except test
  if (config['JWT_SECRET'] && config['JWT_SECRET'].length < 32 && config['NODE_ENV'] !== 'test') {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  // TOTP encryption key warning
  if (!process.env['TOTP_ENCRYPTION_KEY'] && config['NODE_ENV'] !== 'test') {
    warnings.push(
      'TOTP_ENCRYPTION_KEY not set — TOTP secrets will be stored in plaintext. ' +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  // API_PUBLIC_URL warning — required in production to prevent host header injection
  if (!process.env['API_PUBLIC_URL'] && config['NODE_ENV'] === 'production') {
    errors.push(
      'API_PUBLIC_URL is required in production to prevent host header injection. ' +
        'Set it to the public-facing URL of this API (e.g. https://api.onebrain.rocks).',
    );
  } else if (!process.env['API_PUBLIC_URL'] && config['NODE_ENV'] !== 'test') {
    warnings.push(
      'API_PUBLIC_URL not set — will derive from request headers in development. ' +
        'This MUST be set in production.',
    );
  }

  // Memory encryption key warning
  if (!process.env['MEMORY_ENCRYPTION_KEY'] && config['NODE_ENV'] !== 'test') {
    warnings.push(
      'MEMORY_ENCRYPTION_KEY not set — memory content will be stored unencrypted. ' +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  return { valid: errors.length === 0, errors, warnings, config };
}
