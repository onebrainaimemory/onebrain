import { z } from 'zod';

export const updateBrainProfileSchema = z.object({
  summary: z.string().max(5000).optional().nullable(),
  traits: z.record(z.unknown()).optional(),
  preferences: z.record(z.unknown()).optional(),
});

export type UpdateBrainProfileInput = z.infer<typeof updateBrainProfileSchema>;
