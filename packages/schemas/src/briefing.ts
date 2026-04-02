import { z } from 'zod';

// ─── BrainPulse Schemas ───

export const briefingTypeEnum = z.enum([
  'morning',
  'midday',
  'evening',
  'event_triggered',
  'weekly_health',
]);
export type BriefingType = z.infer<typeof briefingTypeEnum>;

export const briefingChannelEnum = z.enum(['email', 'in_app', 'webhook']);
export type BriefingChannel = z.infer<typeof briefingChannelEnum>;

export const briefingStatusEnum = z.enum(['pending', 'generating', 'ready', 'delivered', 'failed']);
export type BriefingStatus = z.infer<typeof briefingStatusEnum>;

export const briefingTriggerEventEnum = z.enum([
  'candidate_threshold',
  'confidence_conflict',
  'high_importance_memory',
  'weekly_health',
]);
export type BriefingTriggerEvent = z.infer<typeof briefingTriggerEventEnum>;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updateBriefingConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  timezone: z.string().min(1).max(50).optional(),
  quietHoursStart: z.string().regex(timeRegex, 'Must be HH:mm format').optional(),
  quietHoursEnd: z.string().regex(timeRegex, 'Must be HH:mm format').optional(),
  webhookUrl: z.string().url().max(500).nullable().optional(),
  webhookSecret: z.string().max(255).nullable().optional(),
  contentPreferences: z
    .object({
      includeAgentActivity: z.boolean().optional(),
      includePendingCandidates: z.boolean().optional(),
      includeProjectUpdates: z.boolean().optional(),
      includeHealthReport: z.boolean().optional(),
    })
    .optional(),
});
export type UpdateBriefingConfigInput = z.infer<typeof updateBriefingConfigSchema>;

export const createBriefingScheduleSchema = z.object({
  type: briefingTypeEnum,
  cronExpression: z.string().min(9).max(100),
  channels: z.array(briefingChannelEnum).min(1).max(3),
});
export type CreateBriefingScheduleInput = z.infer<typeof createBriefingScheduleSchema>;

export const createBriefingTriggerSchema = z.object({
  eventType: briefingTriggerEventEnum,
  threshold: z.number().int().min(1).optional(),
  channels: z.array(briefingChannelEnum).min(1).max(3),
  cooldownMinutes: z.number().int().min(15).max(1440).optional().default(60),
});
export type CreateBriefingTriggerInput = z.infer<typeof createBriefingTriggerSchema>;

export const briefingListQuerySchema = z.object({
  type: briefingTypeEnum.optional(),
  status: briefingStatusEnum.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});
export type BriefingListQueryInput = z.infer<typeof briefingListQuerySchema>;

export const briefingPreviewSchema = z.object({
  type: briefingTypeEnum,
});
export type BriefingPreviewInput = z.infer<typeof briefingPreviewSchema>;

export const briefingEngagementSchema = z.object({
  action: z.enum(['opened', 'clicked', 'dismissed', 'acted_on']),
  metadata: z.record(z.unknown()).optional(),
});
export type BriefingEngagementInput = z.infer<typeof briefingEngagementSchema>;
