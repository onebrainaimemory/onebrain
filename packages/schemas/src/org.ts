import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(1).max(255, 'Name required (max 255 chars)'),
  description: z.string().max(1000).optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
