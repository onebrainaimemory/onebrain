import { z } from 'zod';

const validScopes = [
  'brain.read',
  'brain.write',
  'memory.extract.write',
  'entity.read',
  'entity.write',
  'connect.read',
  'connect.write',
] as const;

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(validScopes)).min(1),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
