import type { FastifyInstance } from 'fastify';
import '@fastify/multipart';
import {
  importMemoriesSchema,
  aiExtractSchema,
  ingestUrlSchema,
  parseChatSchema,
} from '@onebrain/schemas';
import { requireAuth, requireScope } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/require-verified-email.js';
import { success, error } from '../lib/response.js';
import { scanForDuplicates, importMemories } from '../services/memory.service.js';
import { extractWithAi } from '../services/ai-extract.service.js';
import { ingestUrl, parseChat, processUploadedFile } from '../services/ingest.service.js';

const writeRateLimit = {
  rateLimit: { max: 30, timeWindow: '1 minute' },
};

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/memory/duplicates',
    { preHandler: [requireAuth, requireScope('brain.read')] },
    async (request, reply) => {
      const duplicates = await scanForDuplicates(request.userId);
      return reply.status(200).send(success(duplicates));
    },
  );

  app.post(
    '/v1/memory/import',
    {
      preHandler: [requireAuth, requireScope('brain.write'), requireVerifiedEmail],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = importMemoriesSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request body',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const result = await importMemories(request.userId, parsed.data.items);

      return reply.status(201).send(success(result));
    },
  );

  app.post(
    '/v1/memory/ai-extract',
    {
      preHandler: [requireAuth, requireScope('brain.write'), requireVerifiedEmail],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = aiExtractSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request body',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const result = await extractWithAi(request.userId, parsed.data.text, parsed.data.aiProvider);

      return reply.status(200).send(success(result));
    },
  );

  app.post(
    '/v1/memory/upload',
    {
      preHandler: [requireAuth, requireScope('brain.write'), requireVerifiedEmail],
      config: writeRateLimit,
    },
    async (request, reply) => {
      try {
        const file = await request.file();

        if (!file) {
          const res = error('VALIDATION_ERROR', 'No file uploaded', 400);
          return reply.status(res.statusCode).send(res.body);
        }

        const allowedExtensions = ['txt', 'csv', 'json', 'pdf', 'docx'];
        const allowedMimeTypes = [
          'text/plain',
          'text/csv',
          'application/json',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        const extension = file.filename.split('.').pop()?.toLowerCase() ?? '';

        if (!allowedExtensions.includes(extension)) {
          const res = error(
            'VALIDATION_ERROR',
            'Only .txt, .csv, .json, .pdf, and .docx files are supported',
            400,
          );
          return reply.status(res.statusCode).send(res.body);
        }

        if (!allowedMimeTypes.includes(file.mimetype)) {
          const res = error('VALIDATION_ERROR', `Unsupported file type: ${file.mimetype}`, 400);
          return reply.status(res.statusCode).send(res.body);
        }

        const maxSize = 10 * 1024 * 1024;
        const chunks: Buffer[] = [];
        let totalSize = 0;

        for await (const chunk of file.file) {
          totalSize += chunk.length;
          if (totalSize > maxSize) {
            const res = error('VALIDATION_ERROR', 'File too large (max 10MB)', 400);
            return reply.status(res.statusCode).send(res.body);
          }
          chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);
        const result = await processUploadedFile(request.userId, file.filename, buffer);

        return reply.status(200).send(success(result));
      } catch {
        const res = error(
          'UPLOAD_ERROR',
          'File upload failed. Ensure multipart support is configured.',
          400,
        );
        return reply.status(res.statusCode).send(res.body);
      }
    },
  );

  app.post(
    '/v1/memory/ingest-url',
    {
      preHandler: [requireAuth, requireScope('brain.write'), requireVerifiedEmail],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = ingestUrlSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request body',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      try {
        const result = await ingestUrl(request.userId, parsed.data.url);
        return reply.status(200).send(success(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch URL';
        const res = error('INGEST_ERROR', message, 422);
        return reply.status(res.statusCode).send(res.body);
      }
    },
  );

  app.post(
    '/v1/memory/parse-chat',
    {
      preHandler: [requireAuth, requireScope('brain.write'), requireVerifiedEmail],
      config: writeRateLimit,
    },
    async (request, reply) => {
      const parsed = parseChatSchema.safeParse(request.body);
      if (!parsed.success) {
        const res = error(
          'VALIDATION_ERROR',
          'Invalid request body',
          400,
          undefined,
          parsed.error.issues,
        );
        return reply.status(res.statusCode).send(res.body);
      }

      const result = await parseChat(request.userId, parsed.data.transcript, parsed.data.format);

      return reply.status(200).send(success(result));
    },
  );
}
