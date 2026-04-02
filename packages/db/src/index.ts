import { PrismaClient } from './generated/client/index.js';

let prisma: PrismaClient | undefined;

export function getClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env['NODE_ENV'] === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return prisma;
}

export async function disconnect(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}

export { PrismaClient } from './generated/client/index.js';
export type {
  User,
  BrainProfile,
  MemoryItem,
  Entity,
  EntityLink,
  Project,
  ProjectMemoryLink,
  BrainVersion,
  SourceEvent,
  MagicLinkToken,
  Session,
  ApiKey,
  DailyQuestion,
  Plan,
  PlanLimit,
  PlanFeature,
  UserPlan,
  UsageEvent,
  Referral,
  BrainShare,
  AuditLog,
  Consent,
  Subscription,
  Tag,
  MemoryTag,
  FileUpload,
  NotificationPreference,
  SystemSetting,
  InviteLink,
} from './generated/client/index.js';
