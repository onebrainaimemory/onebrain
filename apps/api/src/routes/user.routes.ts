import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { getClient } from '@onebrain/db';
import { z } from 'zod';

const notificationPrefsSchema = z.object({
  emailDaily: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /v1/user/streak -- returns current streak
  app.get('/v1/user/streak', async (request, reply) => {
    const prisma = getClient();

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { streakCount: true, lastStreakDate: true },
    });

    if (!user) {
      const res = error('NOT_FOUND', 'User not found', 404);
      return reply.status(res.statusCode).send(res.body);
    }

    return reply.status(200).send(
      success({
        streakCount: user.streakCount ?? 0,
        lastDate: user.lastStreakDate?.toISOString() ?? null,
      }),
    );
  });

  // GET /v1/user/notifications -- get notification preferences
  app.get('/v1/user/notifications', async (request, reply) => {
    const prisma = getClient();

    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: request.userId },
    });

    if (!prefs) {
      return reply.status(200).send(
        success({
          emailDaily: false,
          pushEnabled: false,
        }),
      );
    }

    return reply.status(200).send(
      success({
        emailDaily: prefs.emailDaily,
        pushEnabled: prefs.pushEnabled,
      }),
    );
  });

  // PATCH /v1/user/notifications -- update notification preferences
  app.patch('/v1/user/notifications', async (request, reply) => {
    const parsed = notificationPrefsSchema.safeParse(request.body);

    if (!parsed.success) {
      const res = error('VALIDATION_ERROR', 'Invalid input', 400, undefined, parsed.error.issues);
      return reply.status(res.statusCode).send(res.body);
    }

    const prisma = getClient();

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: request.userId },
      create: {
        userId: request.userId,
        ...parsed.data,
      },
      update: parsed.data,
    });

    return reply.status(200).send(
      success({
        emailDaily: prefs.emailDaily,
        pushEnabled: prefs.pushEnabled,
      }),
    );
  });
}
