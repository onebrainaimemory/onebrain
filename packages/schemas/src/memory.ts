import { z } from 'zod';

const memoryTypeSchema = z.enum(['fact', 'preference', 'decision', 'goal', 'experience', 'skill']);

const sourceTypeSchema = z.enum([
  'user_input',
  'system_inference',
  'ai_extraction',
  'user_confirmed',
]);

export const createMemorySchema = z.object({
  type: memoryTypeSchema,
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  sourceType: sourceTypeSchema.optional().default('user_input'),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const memoryStatusSchema = z.enum(['active', 'candidate', 'archived']);

export const updateMemorySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(10000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: memoryStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const createMemoryBatchSchema = z.array(createMemorySchema).min(1).max(10);

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type CreateMemoryBatchInput = z.infer<typeof createMemoryBatchSchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
