import { z } from 'zod';

export const agentActivityQuerySchema = z.object({
  apiKeyId: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const updateApiKeyConfigSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  trustLevel: z.enum(['review', 'trusted']).optional(),
  rateLimitPerMin: z.number().int().min(1).max(1000).optional().nullable(),
  scopes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const deltaSyncQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

export const bulkMemoryActionSchema = z.object({
  action: z.enum(['approve', 'dismiss']),
});

export type AgentActivityQueryInput = z.infer<typeof agentActivityQuerySchema>;
export type UpdateApiKeyConfigInput = z.infer<typeof updateApiKeyConfigSchema>;
export type DeltaSyncQueryInput = z.infer<typeof deltaSyncQuerySchema>;
export type BulkMemoryActionInput = z.infer<typeof bulkMemoryActionSchema>;
