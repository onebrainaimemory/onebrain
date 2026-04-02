import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const createProjectMemoryLinkSchema = z.object({
  memoryItemId: z.string().uuid(),
  linkType: z.string().min(1).max(100),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateProjectMemoryLinkInput = z.infer<typeof createProjectMemoryLinkSchema>;
