import { getClient } from '@onebrain/db';
import type { RegisterAgentInput } from '@onebrain/schemas';
import type { CreateApiKeyInput } from '@onebrain/schemas';
import { createApiKey } from './api-key.service.js';
import { AgentProvisionError } from './agent-provision.service.js';
import { audit } from '../lib/audit.js';

/** Read-only scopes for self-registered agents */
const SELF_REGISTER_SCOPES = ['connect.read', 'brain.read', 'entity.read'] as const;
const SELF_REGISTER_EXPIRY_DAYS = 90;
const MAX_REGISTRATIONS_PER_IP_PER_DAY = 3;

interface AgentRegisterResult {
  agentId: string;
  name: string;
  apiKey: {
    prefix: string;
    fullKey: string;
    scopes: string[];
    expiresAt: string | null;
  };
  auth: {
    header: string;
    scheme: string;
    example: string;
  };
  trustLevel: string;
  message: string;
}

/**
 * Self-service agent registration — no auth required.
 * Creates an agent with read-only scopes and 'review' trust level.
 */
export async function registerAgent(
  input: RegisterAgentInput,
  ipAddress?: string,
): Promise<AgentRegisterResult> {
  const prisma = getClient();

  // Check duplicate agent name
  const existing = await prisma.user.findFirst({
    where: { agentName: input.name, accountType: 'agent' },
  });
  if (existing) {
    throw new AgentProvisionError(
      'AGENT_NAME_TAKEN',
      `An agent with the name "${input.name}" already exists`,
      409,
    );
  }

  // DB-level IP rate limiting (defense-in-depth on top of route rate limiter)
  if (ipAddress) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFromIp = await prisma.auditLog.count({
      where: {
        action: 'self_register',
        resource: 'agent_account',
        ipAddress,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (recentFromIp >= MAX_REGISTRATIONS_PER_IP_PER_DAY) {
      throw new AgentProvisionError(
        'IP_LIMIT_EXCEEDED',
        'Maximum daily registrations from this IP reached. Try again in 24 hours.',
        429,
      );
    }
  }

  const agentEmail = `agent-${crypto.randomUUID()}@agents.onebrain.local`;

  const user = await prisma.user.create({
    data: {
      email: agentEmail,
      displayName: input.name,
      accountType: 'agent',
      agentName: input.name,
      locale: 'en',
      region: 'EU',
      isActive: true,
      emailVerified: true,
    },
  });

  // Assign free plan
  const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } });
  if (freePlan) {
    await prisma.userPlan.create({
      data: { userId: user.id, planId: freePlan.id, isActive: true },
    });
  }

  // Create brain profile
  await prisma.brainProfile.create({
    data: {
      userId: user.id,
      summary: '',
      traits: {},
      preferences: {},
    },
  });

  // Build description for the API key (includes agent description + contact)
  const keyDescription = input.contactUrl
    ? `${input.description} | Contact: ${input.contactUrl}`
    : input.description;

  const apiKey = await createApiKey(user.id, {
    name: `${input.name} — self-registered key`,
    scopes: [...SELF_REGISTER_SCOPES],
    expiresInDays: SELF_REGISTER_EXPIRY_DAYS,
  } as CreateApiKeyInput);

  // Store description on the API key for admin review
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { description: keyDescription },
  });

  audit(
    user.id,
    'self_register',
    'agent_account',
    user.id,
    {
      name: input.name,
      scopes: [...SELF_REGISTER_SCOPES],
      contactUrl: input.contactUrl,
    },
    ipAddress,
  );

  return {
    agentId: user.id,
    name: input.name,
    apiKey: {
      prefix: apiKey.prefix,
      fullKey: apiKey.fullKey,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
    },
    auth: {
      header: 'Authorization',
      scheme: 'ApiKey',
      example: `Authorization: ApiKey ${apiKey.fullKey}`,
    },
    trustLevel: 'review',
    message:
      'Agent registered. Your API key has read-only access (connect.read, brain.read, entity.read). ' +
      'Use header "Authorization: ApiKey <your_key>" for all requests. ' +
      'Contact an admin at https://onebrain.rocks to upgrade scopes or trust level.',
  };
}
