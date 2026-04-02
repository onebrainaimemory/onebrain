import { getClient } from '@onebrain/db';
import type { InviteRegisterInput } from '@onebrain/schemas';
import type { CreateApiKeyInput } from '@onebrain/schemas';
import { createApiKey } from './api-key.service.js';
import { AgentProvisionError } from './agent-provision.service.js';
import { audit } from '../lib/audit.js';

const READ_SCOPES = ['connect.read', 'brain.read', 'entity.read'] as const;
const READWRITE_SCOPES = [
  'connect.read',
  'connect.write',
  'brain.read',
  'brain.write',
  'entity.read',
  'entity.write',
  'memory.read',
  'memory.write',
] as const;
const INVITE_KEY_EXPIRY_DAYS = 90;

interface InviteRegisterResult {
  agentId: string;
  name: string;
  inviteCode: string;
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
 * Returns the global invite registration toggle from system_settings.
 */
export async function isInviteRegistrationEnabled(): Promise<boolean> {
  const prisma = getClient();
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'invite_registration_enabled' },
  });
  return setting?.value === 'true';
}

/**
 * Validates an invite code and returns link info (public).
 */
export async function getInviteLinkInfo(code: string) {
  const prisma = getClient();

  const enabled = await isInviteRegistrationEnabled();
  if (!enabled) {
    throw new AgentProvisionError(
      'INVITE_DISABLED',
      'Invite registration is currently disabled.',
      403,
    );
  }

  const link = await prisma.inviteLink.findUnique({ where: { code } });
  if (!link || !link.isActive) {
    throw new AgentProvisionError('INVITE_NOT_FOUND', 'Invalid or inactive invite code.', 404);
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new AgentProvisionError('INVITE_EXPIRED', 'This invite link has expired.', 410);
  }

  if (link.maxUses && link.usesCount >= link.maxUses) {
    throw new AgentProvisionError(
      'INVITE_EXHAUSTED',
      'This invite link has reached its maximum number of uses.',
      410,
    );
  }

  return {
    code: link.code,
    label: link.label,
    description: link.description,
    accessLevel: link.accessLevel,
    remainingUses: link.maxUses ? link.maxUses - link.usesCount : null,
    expiresAt: link.expiresAt?.toISOString() ?? null,
  };
}

/**
 * Register an agent via invite code.
 */
export async function registerViaInvite(
  input: InviteRegisterInput,
  ipAddress?: string,
): Promise<InviteRegisterResult> {
  const prisma = getClient();

  // Check global toggle
  const enabled = await isInviteRegistrationEnabled();
  if (!enabled) {
    throw new AgentProvisionError(
      'INVITE_DISABLED',
      'Invite registration is currently disabled.',
      403,
    );
  }

  // Validate invite link
  const link = await prisma.inviteLink.findUnique({
    where: { code: input.code },
  });

  if (!link || !link.isActive) {
    throw new AgentProvisionError('INVITE_NOT_FOUND', 'Invalid or inactive invite code.', 404);
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new AgentProvisionError('INVITE_EXPIRED', 'This invite link has expired.', 410);
  }

  if (link.maxUses && link.usesCount >= link.maxUses) {
    throw new AgentProvisionError(
      'INVITE_EXHAUSTED',
      'This invite link has reached its maximum number of uses.',
      410,
    );
  }

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

  // Create agent user with invite code reference
  const agentEmail = `agent-${crypto.randomUUID()}@agents.onebrain.local`;

  const user = await prisma.user.create({
    data: {
      email: agentEmail,
      displayName: input.name,
      accountType: 'agent',
      agentName: input.name,
      inviteCode: input.code,
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

  // Resolve scopes from invite link access level
  const scopes = link.accessLevel === 'readwrite' ? [...READWRITE_SCOPES] : [...READ_SCOPES];

  // Create API key
  const keyDescription = input.contactUrl
    ? `${input.description} | Contact: ${input.contactUrl}`
    : input.description;

  const apiKey = await createApiKey(user.id, {
    name: `${input.name} — invite key`,
    scopes,
    expiresInDays: INVITE_KEY_EXPIRY_DAYS,
  } as CreateApiKeyInput);

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { description: keyDescription },
  });

  // Increment uses count atomically
  await prisma.inviteLink.update({
    where: { id: link.id },
    data: { usesCount: { increment: 1 } },
  });

  audit(
    user.id,
    'invite_register',
    'agent_account',
    user.id,
    {
      name: input.name,
      inviteCode: input.code,
      inviteLinkId: link.id,
      accessLevel: link.accessLevel,
      scopes,
      contactUrl: input.contactUrl,
    },
    ipAddress,
  );

  const accessDesc = link.accessLevel === 'readwrite' ? 'read+write' : 'read-only';

  return {
    agentId: user.id,
    name: input.name,
    inviteCode: input.code,
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
      `Agent registered via invite link. Your API key has ${accessDesc} access. ` +
      'Use header "Authorization: ApiKey <your_key>" for all requests. ' +
      'Contact an admin at https://onebrain.rocks to upgrade scopes.',
  };
}
