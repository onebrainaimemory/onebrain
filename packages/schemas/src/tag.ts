import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .default('#6b7280'),
});

export const addTagToMemorySchema = z.object({
  tagId: z.string().uuid(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type AddTagToMemoryInput = z.infer<typeof addTagToMemorySchema>;
