import { z } from 'zod';

const agentScopes = [
  'connect.read',
  'connect.write',
  'brain.read',
  'entity.read',
  'entity.write',
  'memory.extract.write',
] as const;

export const provisionAgentSchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(agentScopes)).min(1),
  expiresInDays: z.number().int().positive().max(365).optional().default(90),
});

export type ProvisionAgentInput = z.infer<typeof provisionAgentSchema>;
