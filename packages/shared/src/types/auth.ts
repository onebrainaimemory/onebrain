export interface Session {
  id: string;
  userId: string;
  region: string;
  expiresAt: string;
  createdAt: string;
}

export interface MagicLinkToken {
  id: string;
  userId: string | null;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export const ApiScope = {
  BRAIN_READ: 'brain.read',
  BRAIN_WRITE: 'brain.write',
  MEMORY_EXTRACT_WRITE: 'memory.extract.write',
  ENTITY_READ: 'entity.read',
  ENTITY_WRITE: 'entity.write',
} as const;

export type ApiScope = (typeof ApiScope)[keyof typeof ApiScope];

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  secretHash: string;
  scopes: ApiScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
