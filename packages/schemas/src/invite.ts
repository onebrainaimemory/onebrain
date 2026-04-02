import { z } from 'zod';

/** Agent registration via invite link (public) */
export const inviteRegisterSchema = z.object({
  code: z.string().min(4).max(50),
  name: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,98}[a-zA-Z0-9]$/),
  description: z.string().min(10).max(1000),
  contactUrl: z.string().url().max(500).optional(),
});
export type InviteRegisterInput = z.infer<typeof inviteRegisterSchema>;

/** Admin: create invite link */
export const createInviteLinkSchema = z.object({
  label: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  code: z
    .string()
    .min(4)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  accessLevel: z.enum(['read', 'readwrite']).default('read'),
  maxUses: z.number().int().min(1).max(100000).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateInviteLinkInput = z.infer<typeof createInviteLinkSchema>;

/** Admin: update invite link */
export const updateInviteLinkSchema = z
  .object({
    label: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional().nullable(),
    accessLevel: z.enum(['read', 'readwrite']).optional(),
    isActive: z.boolean().optional(),
    maxUses: z.number().int().min(1).max(100000).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict();
export type UpdateInviteLinkInput = z.infer<typeof updateInviteLinkSchema>;
