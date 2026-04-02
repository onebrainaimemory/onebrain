import { getClient } from '@onebrain/db';
import { config } from '../config.js';

interface DataCategory {
  category: string;
  legalBasis: string;
  retentionPeriod: string;
  description: string;
}

interface ThirdPartyProcessor {
  name: string;
  purpose: string;
  dataCategories: string[];
  country: string;
}

interface DsgvoReport {
  generatedAt: string;
  userStats: {
    totalUsers: number;
    activeUsers: number;
    deletedUsers: number;
    pendingDeletions: number;
  };
  consentStats: {
    totalConsents: number;
    latestVersion: string | null;
  };
  retentionStats: {
    lastRetentionRun: string | null;
    expiredSessions: number;
    oldUsageEvents: number;
    oldAuditLogs: number;
  };
  dataCategories: DataCategory[];
  thirdPartyProcessors: ThirdPartyProcessor[];
}

/**
 * Generates a DSGVO/GDPR compliance report for administrators.
 * Collects statistics about users, consents, and data retention.
 */
export async function generateDsgvoReport(lastRetentionRun: string | null): Promise<DsgvoReport> {
  const prisma = getClient();
  const now = new Date();

  const [
    totalUsers,
    activeUsers,
    deletedUsers,
    pendingDeletions,
    totalConsents,
    latestConsent,
    expiredSessions,
    oldUsageEvents,
    oldAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: { not: null } } }),
    prisma.user.count({
      where: {
        deletedAt: { not: null },
        isActive: false,
      },
    }),
    prisma.consent.count(),
    prisma.consent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    }),
    prisma.session.count({
      where: { expiresAt: { lt: now } },
    }),
    prisma.usageEvent.count({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - 24 * 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.auditLog.count({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const dataCategories = buildDataCategories();
  const thirdPartyProcessors = buildThirdPartyProcessors();

  return {
    generatedAt: now.toISOString(),
    userStats: {
      totalUsers,
      activeUsers,
      deletedUsers,
      pendingDeletions,
    },
    consentStats: {
      totalConsents,
      latestVersion: latestConsent?.version ?? null,
    },
    retentionStats: {
      lastRetentionRun,
      expiredSessions,
      oldUsageEvents,
      oldAuditLogs,
    },
    dataCategories,
    thirdPartyProcessors,
  };
}

function buildDataCategories(): DataCategory[] {
  return [
    {
      category: 'Account Data (Email, Display Name)',
      legalBasis: 'Art. 6(1)(b) GDPR - Contract Performance',
      retentionPeriod: 'Until account deletion + 30 days',
      description: 'Required for authentication and service delivery',
    },
    {
      category: 'Memory Data (Facts, Preferences, Goals)',
      legalBasis: 'Art. 6(1)(b) GDPR - Contract Performance',
      retentionPeriod: 'Until account deletion + 30 days',
      description: 'Core service data stored by the user',
    },
    {
      category: 'Usage Events (API calls, token usage)',
      legalBasis: 'Art. 6(1)(f) GDPR - Legitimate Interest',
      retentionPeriod: '24 months',
      description: 'Required for billing and rate limiting',
    },
    {
      category: 'Audit Logs',
      legalBasis: 'Art. 6(1)(f) GDPR - Legitimate Interest',
      retentionPeriod: '90 days',
      description: 'Security monitoring and compliance',
    },
    {
      category: 'Sessions',
      legalBasis: 'Art. 6(1)(b) GDPR - Contract Performance',
      retentionPeriod: '30 days after expiry',
      description: 'Authentication session management',
    },
    {
      category: 'Consent Records',
      legalBasis: 'Art. 6(1)(c) GDPR - Legal Obligation',
      retentionPeriod: 'Duration of account + 3 years',
      description: 'Proof of consent for GDPR compliance',
    },
    {
      category: 'Payment Data (Stripe Customer ID)',
      legalBasis: 'Art. 6(1)(b) GDPR - Contract Performance',
      retentionPeriod: 'Until account deletion',
      description: 'Reference ID only; payment details stored by Stripe',
    },
  ];
}

function buildThirdPartyProcessors(): ThirdPartyProcessor[] {
  const processors: ThirdPartyProcessor[] = [];

  if (config.stripe.secretKey) {
    processors.push({
      name: 'Stripe Inc.',
      purpose: 'Payment processing',
      dataCategories: ['Email', 'Payment information'],
      country: 'USA (EU SCCs)',
    });
  }

  if (config.mail.resendApiKey) {
    processors.push({
      name: 'Resend',
      purpose: 'Email delivery',
      dataCategories: ['Email address'],
      country: 'EU/USA (EU SCCs)',
    });
  }

  const openaiKey = process.env['OPENAI_API_KEY'] ?? '';
  const openRouterKey = process.env['OPENROUTER_API_KEY'] ?? '';
  if (openaiKey || openRouterKey) {
    processors.push({
      name: 'OpenAI/OpenRouter',
      purpose: 'AI embeddings (optional)',
      dataCategories: ['Memory content as vectors'],
      country: 'USA (EU-US DPF / EU SCCs)',
    });
  }

  processors.push({
    name: 'Hetzner Online GmbH',
    purpose: 'Infrastructure hosting',
    dataCategories: ['All data (encrypted at rest)'],
    country: 'Germany (EU)',
  });

  return processors;
}
