import { z } from 'zod';

const memoryTypeSchema = z.enum(['fact', 'preference', 'decision', 'goal', 'experience', 'skill']);

const importItemSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  type: memoryTypeSchema.optional().default('fact'),
});

export const importMemoriesSchema = z.object({
  items: z.array(importItemSchema).min(1).max(500),
});

export const aiExtractSchema = z.object({
  text: z.string().min(1).max(50000),
  aiProvider: z.enum(['gemini', 'openai']).optional(),
});

export const ingestUrlSchema = z.object({
  url: z
    .string()
    .url()
    .max(2000)
    .refine((u) => u.startsWith('https://'), {
      message: 'Only HTTPS URLs are allowed',
    }),
});

export const parseChatSchema = z.object({
  transcript: z.string().min(1).max(100000),
  format: z.enum(['auto', 'user-assistant', 'timestamp']).optional().default('auto'),
});

export type ImportMemoriesInput = z.infer<typeof importMemoriesSchema>;
export type ImportItem = z.infer<typeof importItemSchema>;
export type AiExtractInput = z.infer<typeof aiExtractSchema>;
export type IngestUrlInput = z.infer<typeof ingestUrlSchema>;
export type ParseChatInput = z.infer<typeof parseChatSchema>;
