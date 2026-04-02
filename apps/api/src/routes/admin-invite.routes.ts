import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getClient } from '@onebrain/db';
import { createInviteLinkSchema, updateInviteLinkSchema } from '@onebrain/schemas';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { generateInviteCode } from '../lib/invite-code.js';
import { audit } from '../lib/audit.js';

const uuidSchema = z.string().uuid();

/**
 * Admin invite management routes.
 * All routes require JWT auth + admin role.
 */
export async function adminInviteRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requireAuth);
  app.addHook('onRequest', requireAdmin);

  // GET /v1/admin/invites — list all invite links
  app.get('/v1/admin/invites', async (request, reply) => {
    const prisma = getClient();
    const links = await prisma.inviteLink.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return reply.status(200).send(
      success(
        links.map((l) => ({
          id: l.id,
          code: l.code,
          label: l.label,
          description: l.description,
          accessLevel: l.accessLevel,
          maxUses: l.maxUses,
          usesCount: l.usesCount,
          isActive: l.isActive,
          createdBy: l.createdBy,
          expiresAt: l.expiresAt?.toISOString() ?? null,
          createdAt: l.createdAt.toISOString(),
        })),
        request.id,
      ),
    );
  });

  // POST /v1/admin/invites — create invite link
  app.post('/v1/admin/invites', async (request, reply) => {
    const parsed = createInviteLinkSchema.safeParse(request.body);
    if (!parsed.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid invite link data.',
        400,
        request.id,
        parsed.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    const prisma = getClient();
    const code = parsed.data.code || generateInviteCode();

    // Check code uniqueness
    const existing = await prisma.inviteLink.findUnique({ where: { code } });
    if (existing) {
      const res = error('CODE_TAKEN', `Invite code "${code}" is already in use.`, 409, request.id);
      return reply.status(res.statusCode).send(res.body);
    }

    const expiresAt = parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const link = await prisma.inviteLink.create({
      data: {
        code,
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        accessLevel: parsed.data.accessLevel ?? 'read',
        maxUses: parsed.data.maxUses ?? null,
        expiresAt,
        createdBy: request.userId!,
      },
    });

    audit(request.userId!, 'create', 'invite_link', link.id, {
      code,
      label: parsed.data.label,
    });

    return reply.status(201).send(
      success(
        {
          id: link.id,
          code: link.code,
          label: link.label,
          description: link.description,
          maxUses: link.maxUses,
          usesCount: link.usesCount,
          isActive: link.isActive,
          expiresAt: link.expiresAt?.toISOString() ?? null,
          createdAt: link.createdAt.toISOString(),
        },
        request.id,
      ),
    );
  });

  // PATCH /v1/admin/invites/:id — update invite link
  app.patch('/v1/admin/invites/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!uuidSchema.safeParse(id).success) {
      const res = error('INVALID_ID', 'Invalid invite link ID.', 400, request.id);
      return reply.status(res.statusCode).send(res.body);
    }

    const parsed = updateInviteLinkSchema.safeParse(request.body);
    if (!parsed.success) {
      const res = error(
        'VALIDATION_ERROR',
        'Invalid update data.',
        400,
        request.id,
        parsed.error.issues,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    const prisma = getClient();
    const existing = await prisma.inviteLink.findUnique({ where: { id } });
    if (!existing) {
      const res = error('NOT_FOUND', 'Invite link not found.', 404, request.id);
      return reply.status(res.statusCode).send(res.body);
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) data['label'] = parsed.data.label;
    if (parsed.data.description !== undefined) data['description'] = parsed.data.description;
    if (parsed.data.accessLevel !== undefined) data['accessLevel'] = parsed.data.accessLevel;
    if (parsed.data.isActive !== undefined) data['isActive'] = parsed.data.isActive;
    if (parsed.data.maxUses !== undefined) data['maxUses'] = parsed.data.maxUses;
    if (parsed.data.expiresAt !== undefined) {
      data['expiresAt'] = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    }

    const updated = await prisma.inviteLink.update({ where: { id }, data });

    audit(request.userId!, 'update', 'invite_link', id, data);

    return reply.status(200).send(
      success(
        {
          id: updated.id,
          code: updated.code,
          label: updated.label,
          description: updated.description,
          maxUses: updated.maxUses,
          usesCount: updated.usesCount,
          isActive: updated.isActive,
          expiresAt: updated.expiresAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
        },
        request.id,
      ),
    );
  });

  // DELETE /v1/admin/invites/:id — delete invite link
  app.delete('/v1/admin/invites/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!uuidSchema.safeParse(id).success) {
      const res = error('INVALID_ID', 'Invalid invite link ID.', 400, request.id);
      return reply.status(res.statusCode).send(res.body);
    }

    const prisma = getClient();
    const existing = await prisma.inviteLink.findUnique({ where: { id } });
    if (!existing) {
      const res = error('NOT_FOUND', 'Invite link not found.', 404, request.id);
      return reply.status(res.statusCode).send(res.body);
    }

    await prisma.inviteLink.delete({ where: { id } });

    audit(request.userId!, 'delete', 'invite_link', id, { code: existing.code });

    return reply.status(204).send();
  });

  // GET /v1/admin/settings/invite — get global invite toggle
  app.get('/v1/admin/settings/invite', async (request, reply) => {
    const prisma = getClient();
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'invite_registration_enabled' },
    });
    return reply.status(200).send(success({ enabled: setting?.value === 'true' }, request.id));
  });

  // PUT /v1/admin/settings/invite — toggle global invite registration
  app.put('/v1/admin/settings/invite', async (request, reply) => {
    const body = request.body as { enabled?: boolean };
    if (typeof body?.enabled !== 'boolean') {
      const res = error(
        'VALIDATION_ERROR',
        'Body must contain { enabled: boolean }.',
        400,
        request.id,
      );
      return reply.status(res.statusCode).send(res.body);
    }

    const prisma = getClient();
    await prisma.systemSetting.upsert({
      where: { key: 'invite_registration_enabled' },
      update: { value: String(body.enabled) },
      create: { key: 'invite_registration_enabled', value: String(body.enabled) },
    });

    audit(request.userId!, 'update', 'system_setting', 'invite_registration_enabled', {
      enabled: body.enabled,
    });

    return reply.status(200).send(success({ enabled: body.enabled }, request.id));
  });
}
