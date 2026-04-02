export interface BrainProfile {
  id: string;
  userId: string;
  summary: string | null;
  traits: Record<string, unknown>;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BrainVersion {
  id: string;
  userId: string;
  version: number;
  snapshot: Record<string, unknown>;
  mergeLog: MergeLogEntry[];
  createdAt: string;
}

export interface MergeLogEntry {
  action: 'merge' | 'conflict' | 'archive';
  memoryIds: string[];
  reason: string;
  timestamp: string;
}
