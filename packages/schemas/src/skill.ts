import { z } from 'zod';

// ─── SkillForge Schemas ───

export const skillStatusEnum = z.enum(['candidate', 'active', 'archived', 'dismissed']);
export type SkillStatus = z.infer<typeof skillStatusEnum>;

export const skillUsageEventTypeEnum = z.enum(['served', 'referenced', 'applied', 'dismissed']);
export type SkillUsageEventType = z.infer<typeof skillUsageEventTypeEnum>;

export const triggerConditionSchema = z.object({
  type: z.string().min(1).max(100),
  pattern: z.string().min(1).max(500),
  description: z.string().max(500).optional(),
});
export type TriggerCondition = z.infer<typeof triggerConditionSchema>;

export const verificationStepSchema = z.object({
  order: z.number().int().min(1),
  instruction: z.string().min(1).max(1000),
  expectedOutcome: z.string().max(1000).optional(),
});
export type VerificationStep = z.infer<typeof verificationStepSchema>;

export const createSkillSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  triggerConditions: z.array(triggerConditionSchema).max(10).optional().default([]),
  verificationSteps: z.array(verificationStepSchema).max(10).optional().default([]),
  sourceMemoryIds: z.array(z.string().uuid()).max(20).optional().default([]),
  confidenceScore: z.number().min(0).max(1).optional().default(0.5),
});
export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const updateSkillSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(10000).optional(),
  status: skillStatusEnum.optional(),
  triggerConditions: z.array(triggerConditionSchema).max(10).optional(),
  verificationSteps: z.array(verificationStepSchema).max(10).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
});
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

export const skillFeedbackSchema = z.object({
  eventType: skillUsageEventTypeEnum,
  context: z.record(z.unknown()).optional(),
});
export type SkillFeedbackInput = z.infer<typeof skillFeedbackSchema>;

export const skillListQuerySchema = z.object({
  status: skillStatusEnum.optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  sortBy: z.enum(['confidence', 'usage', 'recency']).optional().default('confidence'),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});
export type SkillListQueryInput = z.infer<typeof skillListQuerySchema>;
