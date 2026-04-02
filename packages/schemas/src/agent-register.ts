import { z } from 'zod';

export const registerAgentSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100)
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,98}[a-zA-Z0-9]$/,
      'Name must start/end with alphanumeric, may contain spaces, dots, hyphens, underscores',
    ),
  description: z.string().min(10).max(1000),
  contactUrl: z.string().url().max(500).optional(),
});

export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;
