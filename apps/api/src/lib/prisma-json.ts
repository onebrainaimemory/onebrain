/**
 * Casts JSON-compatible values to satisfy Prisma's InputJsonValue type.
 * Prisma doesn't accept Record<string, unknown> directly for JSON fields.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaJson = any;

export function jsonValue(value: Record<string, unknown>): PrismaJson {
  return value;
}

export function jsonOrUndefined(value: Record<string, unknown> | undefined): PrismaJson {
  return value;
}

export function nullableJson(value: Record<string, unknown> | null | undefined): PrismaJson {
  return value;
}
