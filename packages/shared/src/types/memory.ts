export const MemoryType = {
  FACT: 'fact',
  PREFERENCE: 'preference',
  DECISION: 'decision',
  GOAL: 'goal',
  EXPERIENCE: 'experience',
  SKILL: 'skill',
} as const;

export type MemoryType = (typeof MemoryType)[keyof typeof MemoryType];

export const MemoryStatus = {
  ACTIVE: 'active',
  CANDIDATE: 'candidate',
  ARCHIVED: 'archived',
  CONFLICTED: 'conflicted',
} as const;

export type MemoryStatus = (typeof MemoryStatus)[keyof typeof MemoryStatus];

export const SourceType = {
  USER_INPUT: 'user_input',
  SYSTEM_INFERENCE: 'system_inference',
  AI_EXTRACTION: 'ai_extraction',
  USER_CONFIRMED: 'user_confirmed',
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export interface MemoryItem {
  id: string;
  userId: string;
  type: MemoryType;
  title: string;
  body: string;
  sourceType: SourceType;
  confidence: number;
  status: MemoryStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
