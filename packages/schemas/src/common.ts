import { z } from 'zod';

export const emailSchema = z.string().email().max(255).toLowerCase();

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const localeSchema = z.enum(['de', 'en', 'es']);

export const regionSchema = z.enum(['EU', 'GLOBAL']);
