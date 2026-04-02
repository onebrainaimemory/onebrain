import { z } from 'zod';

export const createEntitySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  description: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateEntitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const createEntityLinkSchema = z.object({
  memoryItemId: z.string().uuid(),
  linkType: z.string().min(1).max(100),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type CreateEntityLinkInput = z.infer<typeof createEntityLinkSchema>;
