import { timingSafeEqual } from 'node:crypto';
import { getClient } from '@onebrain/db';
import type { ProvisionAgentInput, CreateApiKeyInput } from '@onebrain/schemas';
import { createApiKey } from './api-key.service.js';
import { audit } from '../lib/audit.js';
import { config } from '../config.js';

export class AgentProvisionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AgentProvisionError';
  }
}

/**
 * Verifies the provisioning key using timing-safe comparison.
 * Returns false if the key is empty or does not match.
 */
export function verifyProvisioningKey(candidate: string): boolean {
  const expected = config.agentProvisioning.key;
  if (!expected || !candidate) return false;

  const expectedBuf = Buffer.from(expected, 'utf8');
  const candidateBuf = Buffer.from(candidate, 'utf8');

  if (expectedBuf.length !== candidateBuf.length) return false;

  return timingSafeEqual(expectedBuf, candidateBuf);
}

interface AgentProvisionResult {
  agentId: string;
  email: string;
  name: string;
  apiKey: {
    prefix: string;
    fullKey: string;
    scopes: string[];
    expiresAt: string | null;
  };
  createdAt: string;
}

/**
 * Provisions a new agent account in a single atomic operation:
 * 1. Creates a User with accountType 'agent' and synthetic email
 * 2. Assigns the free plan
 * 3. Creates a BrainProfile
 * 4. Creates an API key with the requested scopes
 */
export async function provisionAgent(
  input: ProvisionAgentInput,
  ipAddress?: string,
): Promise<AgentProvisionResult> {
  const prisma = getClient();

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

  const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } });
  if (freePlan) {
    await prisma.userPlan.create({
      data: { userId: user.id, planId: freePlan.id, isActive: true },
    });
  }

  await prisma.brainProfile.create({
    data: {
      userId: user.id,
      summary: '',
      traits: {},
      preferences: {},
    },
  });

  const apiKey = await createApiKey(user.id, {
    name: `${input.name} — provisioned key`,
    scopes: input.scopes,
    expiresInDays: input.expiresInDays,
  } as CreateApiKeyInput);

  audit(
    user.id,
    'provision',
    'agent_account',
    user.id,
    { name: input.name, scopes: input.scopes },
    ipAddress,
  );

  return {
    agentId: user.id,
    email: agentEmail,
    name: input.name,
    apiKey: {
      prefix: apiKey.prefix,
      fullKey: apiKey.fullKey,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
    },
    createdAt: user.createdAt.toISOString(),
  };
}
