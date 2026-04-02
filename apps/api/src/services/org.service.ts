import { getClient } from '@onebrain/db';
import { audit } from '../lib/audit.js';

interface OrgDto {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

interface OrgMemberDto {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  joinedAt: string;
}

export async function createOrg(
  userId: string,
  input: { name: string; description?: string },
): Promise<OrgDto> {
  const prisma = getClient();

  const desc = input.description ?? null;
  const org = await prisma.$queryRaw<
    Array<{ id: string; name: string; description: string | null; created_at: Date }>
  >`
    INSERT INTO organizations (name, description, created_by)
    VALUES (${input.name}, ${desc}, ${userId}::uuid)
    RETURNING id, name, description, created_at
  `;

  const createdOrg = org[0]!;

  // Add creator as admin
  await prisma.$executeRaw`
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (${createdOrg.id}::uuid, ${userId}::uuid, 'admin')
  `;

  audit(userId, 'create', 'organization', createdOrg.id);

  return {
    id: createdOrg.id,
    name: createdOrg.name,
    description: createdOrg.description,
    memberCount: 1,
    createdAt: createdOrg.created_at.toISOString(),
  };
}

export async function listOrgs(userId: string): Promise<OrgDto[]> {
  const prisma = getClient();

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      description: string | null;
      member_count: number;
      created_at: Date;
    }>
  >`
    SELECT o.id, o.name, o.description, o.created_at,
           COUNT(om.user_id)::int as member_count
    FROM organizations o
    JOIN organization_members om ON om.org_id = o.id
    WHERE om.user_id = ${userId}::uuid
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `;

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    memberCount: r.member_count,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function getOrg(userId: string, orgId: string): Promise<OrgDto | null> {
  const prisma = getClient();

  // Check membership
  const member = await prisma.$queryRaw<Array<{ org_id: string }>>`
    SELECT org_id FROM organization_members
    WHERE org_id = ${orgId}::uuid AND user_id = ${userId}::uuid
  `;

  if (!member.length) return null;

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      description: string | null;
      member_count: number;
      created_at: Date;
    }>
  >`
    SELECT o.id, o.name, o.description, o.created_at,
           COUNT(om.user_id)::int as member_count
    FROM organizations o
    JOIN organization_members om ON om.org_id = o.id
    WHERE o.id = ${orgId}::uuid
    GROUP BY o.id
  `;

  const r = results[0];
  if (!r) return null;

  return {
    id: r.id,
    name: r.name,
    description: r.description,
    memberCount: r.member_count,
    createdAt: r.created_at.toISOString(),
  };
}

export async function addOrgMember(
  userId: string,
  orgId: string,
  targetUserId: string,
  role: string,
): Promise<OrgMemberDto | null> {
  const prisma = getClient();

  // Check caller is admin
  const caller = await prisma.$queryRaw<Array<{ role: string }>>`
    SELECT role FROM organization_members
    WHERE org_id = ${orgId}::uuid AND user_id = ${userId}::uuid
  `;

  if (!caller.length || caller[0]!.role !== 'admin') return null;

  const result = await prisma.$queryRaw<
    Array<{ id: string; org_id: string; user_id: string; role: string; joined_at: Date }>
  >`
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (${orgId}::uuid, ${targetUserId}::uuid, ${role})
    ON CONFLICT (org_id, user_id) DO NOTHING
    RETURNING id, org_id, user_id, role, joined_at
  `;

  const r = result[0];
  if (!r) return null;

  audit(userId, 'add_member', 'organization', orgId, { targetUserId, role });

  return {
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at.toISOString(),
  };
}

export async function removeOrgMember(
  userId: string,
  orgId: string,
  targetUserId: string,
): Promise<boolean> {
  const prisma = getClient();

  const caller = await prisma.$queryRaw<Array<{ role: string }>>`
    SELECT role FROM organization_members
    WHERE org_id = ${orgId}::uuid AND user_id = ${userId}::uuid
  `;

  if (!caller.length || caller[0]!.role !== 'admin') return false;

  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    DELETE FROM organization_members
    WHERE org_id = ${orgId}::uuid AND user_id = ${targetUserId}::uuid
    RETURNING id
  `;

  audit(userId, 'remove_member', 'organization', orgId, { targetUserId });
  return result.length > 0;
}

export async function listOrgMembers(userId: string, orgId: string): Promise<OrgMemberDto[]> {
  const prisma = getClient();

  // Check membership
  const member = await prisma.$queryRaw<Array<{ org_id: string }>>`
    SELECT org_id FROM organization_members
    WHERE org_id = ${orgId}::uuid AND user_id = ${userId}::uuid
  `;

  if (!member.length) return [];

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      org_id: string;
      user_id: string;
      role: string;
      joined_at: Date;
    }>
  >`
    SELECT id, org_id, user_id, role, joined_at
    FROM organization_members
    WHERE org_id = ${orgId}::uuid
    ORDER BY joined_at ASC
  `;

  return results.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at.toISOString(),
  }));
}

export async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const prisma = getClient();
  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS(
      SELECT 1 FROM organization_members
      WHERE org_id = ${orgId}::uuid AND user_id = ${userId}::uuid
    ) as exists
  `;
  return result[0]?.exists ?? false;
}

export async function getOrgRole(userId: string, orgId: string): Promise<string | null> {
  const prisma = getClient();
  const result = await prisma.$queryRaw<Array<{ role: string }>>`
    SELECT role FROM organization_members
    WHERE org_id = ${orgId}::uuid AND user_id = ${userId}::uuid
  `;
  return result[0]?.role ?? null;
}
