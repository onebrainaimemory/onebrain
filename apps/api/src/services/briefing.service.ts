import { getClient } from '@onebrain/db';
import type {
  UpdateBriefingConfigInput,
  CreateBriefingScheduleInput,
  CreateBriefingTriggerInput,
  BriefingListQueryInput,
  BriefingEngagementInput,
} from '@onebrain/schemas';

// ─── BrainPulse Service ───

export interface BriefingConfigDto {
  id: string;
  isEnabled: boolean;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  webhookUrl: string | null;
  contentPreferences: Record<string, unknown>;
  schedulesCount: number;
  triggersCount: number;
}

export interface BriefingScheduleDto {
  id: string;
  type: string;
  cronExpression: string;
  channels: string[];
  isActive: boolean;
  nextFireAt: string | null;
  lastFiredAt: string | null;
}

export interface BriefingDto {
  id: string;
  type: string;
  status: string;
  title: string;
  contentText: string;
  contentHtml: string | null;
  deliveredVia: string[];
  createdAt: string;
}

// ─── Config CRUD ───

export async function getOrCreateConfig(userId: string): Promise<BriefingConfigDto> {
  const prisma = getClient();

  let config = await prisma.briefingConfig.findUnique({
    where: { userId },
    include: {
      _count: { select: { schedules: true, triggers: true } },
    },
  });

  if (!config) {
    config = await prisma.briefingConfig.create({
      data: { userId },
      include: {
        _count: { select: { schedules: true, triggers: true } },
      },
    });
  }

  return {
    id: config.id,
    isEnabled: config.isEnabled,
    timezone: config.timezone,
    quietHoursStart: config.quietHoursStart,
    quietHoursEnd: config.quietHoursEnd,
    webhookUrl: config.webhookUrl,
    contentPreferences: config.contentPreferences as Record<string, unknown>,
    schedulesCount: config._count.schedules,
    triggersCount: config._count.triggers,
  };
}

export async function updateConfig(
  userId: string,
  input: UpdateBriefingConfigInput,
): Promise<BriefingConfigDto> {
  const prisma = getClient();

  await prisma.briefingConfig.upsert({
    where: { userId },
    update: {
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      ...(input.quietHoursStart !== undefined ? { quietHoursStart: input.quietHoursStart } : {}),
      ...(input.quietHoursEnd !== undefined ? { quietHoursEnd: input.quietHoursEnd } : {}),
      ...(input.webhookUrl !== undefined ? { webhookUrl: input.webhookUrl } : {}),
      ...(input.webhookSecret !== undefined ? { webhookSecret: input.webhookSecret } : {}),
      ...(input.contentPreferences ? { contentPreferences: input.contentPreferences } : {}),
    },
    create: {
      userId,
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
    },
  });

  return getOrCreateConfig(userId);
}

// ─── Schedule CRUD ───

export async function addSchedule(
  userId: string,
  input: CreateBriefingScheduleInput,
): Promise<BriefingScheduleDto> {
  const prisma = getClient();

  const config = await prisma.briefingConfig.findUnique({ where: { userId } });
  if (!config) {
    throw new Error('BrainPulse config not found — call getOrCreateConfig first');
  }

  const nextFireAt = computeNextFireAt(input.cronExpression, config.timezone);

  const schedule = await prisma.briefingSchedule.create({
    data: {
      configId: config.id,
      userId,
      type: input.type,
      cronExpression: input.cronExpression,
      channels: input.channels,
      nextFireAt,
    },
  });

  return toScheduleDto(schedule);
}

export async function listSchedules(userId: string): Promise<BriefingScheduleDto[]> {
  const prisma = getClient();
  const schedules = await prisma.briefingSchedule.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return schedules.map(toScheduleDto);
}

export async function removeSchedule(userId: string, scheduleId: string): Promise<boolean> {
  const prisma = getClient();
  const schedule = await prisma.briefingSchedule.findFirst({
    where: { id: scheduleId, userId },
  });
  if (!schedule) return false;
  await prisma.briefingSchedule.delete({ where: { id: scheduleId } });
  return true;
}

// ─── Trigger CRUD ───

export async function addTrigger(
  userId: string,
  input: CreateBriefingTriggerInput,
): Promise<{ id: string; eventType: string; threshold: number | null; channels: string[] }> {
  const prisma = getClient();

  const config = await prisma.briefingConfig.findUnique({ where: { userId } });
  if (!config) {
    throw new Error('BrainPulse config not found — call getOrCreateConfig first');
  }

  const trigger = await prisma.briefingTrigger.create({
    data: {
      configId: config.id,
      userId,
      eventType: input.eventType,
      threshold: input.threshold,
      channels: input.channels,
      cooldownMinutes: input.cooldownMinutes,
    },
  });

  return {
    id: trigger.id,
    eventType: trigger.eventType,
    threshold: trigger.threshold,
    channels: trigger.channels,
  };
}

export async function removeTrigger(userId: string, triggerId: string): Promise<boolean> {
  const prisma = getClient();
  const trigger = await prisma.briefingTrigger.findFirst({
    where: { id: triggerId, userId },
  });
  if (!trigger) return false;
  await prisma.briefingTrigger.delete({ where: { id: triggerId } });
  return true;
}

// ─── Briefing List ───

export async function listBriefings(
  userId: string,
  query: BriefingListQueryInput,
): Promise<{ items: BriefingDto[]; hasMore: boolean; cursor: string | null }> {
  const prisma = getClient();

  const briefings = await prisma.briefing.findMany({
    where: {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
  });

  const hasMore = briefings.length > query.limit;
  const items = briefings.slice(0, query.limit);

  return {
    items: items.map(toBriefingDto),
    hasMore,
    cursor: items.length > 0 ? items[items.length - 1]!.id : null,
  };
}

export async function getBriefing(userId: string, briefingId: string): Promise<BriefingDto | null> {
  const prisma = getClient();
  const briefing = await prisma.briefing.findFirst({
    where: { id: briefingId, userId },
  });
  return briefing ? toBriefingDto(briefing) : null;
}

// ─── Engagement ───

export async function trackEngagement(
  userId: string,
  briefingId: string,
  input: BriefingEngagementInput,
): Promise<void> {
  const prisma = getClient();

  await prisma.briefingEngagement.create({
    data: {
      briefingId,
      userId,
      action: input.action,
      metadata: input.metadata as Record<string, string> | undefined,
    },
  });
}

// ─── Cron Helpers ───

/**
 * Compute the next fire time from a simple cron expression.
 * Supports: "HH:mm" daily format and basic 5-field cron.
 */
export function computeNextFireAt(cronExpression: string, timezone: string): Date {
  // Simple daily time format: "08:00"
  const timeMatch = cronExpression.match(/^(\d{2}):(\d{2})$/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]!, 10);
    const minute = parseInt(timeMatch[2]!, 10);
    return getNextDailyTime(hour, minute, timezone);
  }

  // 5-field cron: "minute hour * * *"
  const parts = cronExpression.split(/\s+/);
  if (parts.length === 5) {
    const minute = parseInt(parts[0]!, 10);
    const hour = parseInt(parts[1]!, 10);
    if (!isNaN(minute) && !isNaN(hour)) {
      return getNextDailyTime(hour, minute, timezone);
    }
  }

  // Fallback: next hour
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

function getNextDailyTime(hour: number, minute: number, timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const currentMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  const target = new Date(now);
  const offset = (hour - currentHour) * 60 + (minute - currentMinute);

  if (offset <= 0) {
    target.setDate(target.getDate() + 1);
  }

  target.setHours(target.getHours() + (hour - currentHour));
  target.setMinutes(target.getMinutes() + (minute - currentMinute));
  target.setSeconds(0, 0);

  return target;
}

/**
 * Check if current time falls within quiet hours for a timezone.
 */
export function isQuietHours(
  quietStart: string | null,
  quietEnd: string | null,
  timezone: string,
): boolean {
  if (!quietStart || !quietEnd) return false;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const currentMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const currentTime = currentHour * 60 + currentMinute;

  const [startH, startM] = quietStart.split(':').map(Number) as [number, number];
  const [endH, endM] = quietEnd.split(':').map(Number) as [number, number];
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime < endTime;
  }

  // Crosses midnight (e.g., 22:00 - 07:00)
  return currentTime >= startTime || currentTime < endTime;
}

// ─── Analytics ───

export interface BriefingAnalytics {
  totalBriefings: number;
  deliveredCount: number;
  engagementRate: number;
  byType: Array<{ type: string; count: number }>;
  byChannel: Array<{ channel: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
}

export async function getBriefingAnalytics(userId: string, days = 30): Promise<BriefingAnalytics> {
  const prisma = getClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [briefings, engagements, byType] = await Promise.all([
    prisma.briefing.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { id: true, status: true, deliveredVia: true },
    }),
    prisma.briefingEngagement.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { action: true, briefingId: true },
    }),
    prisma.briefing.groupBy({
      by: ['type'],
      where: { userId, createdAt: { gte: since } },
      _count: { id: true },
    }),
  ]);

  const totalBriefings = briefings.length;
  const deliveredCount = briefings.filter((b) => b.status === 'delivered').length;
  const briefingsWithEngagement = new Set(engagements.map((e) => e.briefingId));
  const engagementRate =
    totalBriefings > 0
      ? Math.round((briefingsWithEngagement.size / totalBriefings) * 100) / 100
      : 0;

  // Channel distribution
  const channelCounts = new Map<string, number>();
  for (const b of briefings) {
    for (const ch of b.deliveredVia) {
      channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
    }
  }

  // Action distribution
  const actionCounts = new Map<string, number>();
  for (const e of engagements) {
    actionCounts.set(e.action, (actionCounts.get(e.action) ?? 0) + 1);
  }

  return {
    totalBriefings,
    deliveredCount,
    engagementRate,
    byType: byType.map((t) => ({ type: t.type, count: t._count.id })),
    byChannel: Array.from(channelCounts.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count),
    topActions: Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ─── Helpers ───

function toScheduleDto(s: {
  id: string;
  type: string;
  cronExpression: string;
  channels: string[];
  isActive: boolean;
  nextFireAt: Date | null;
  lastFiredAt: Date | null;
}): BriefingScheduleDto {
  return {
    id: s.id,
    type: s.type,
    cronExpression: s.cronExpression,
    channels: s.channels,
    isActive: s.isActive,
    nextFireAt: s.nextFireAt?.toISOString() ?? null,
    lastFiredAt: s.lastFiredAt?.toISOString() ?? null,
  };
}

function toBriefingDto(b: {
  id: string;
  type: string;
  status: string;
  title: string;
  contentText: string;
  contentHtml: string | null;
  deliveredVia: string[];
  createdAt: Date;
}): BriefingDto {
  return {
    id: b.id,
    type: b.type,
    status: b.status,
    title: b.title,
    contentText: b.contentText,
    contentHtml: b.contentHtml,
    deliveredVia: b.deliveredVia,
    createdAt: b.createdAt.toISOString(),
  };
}
