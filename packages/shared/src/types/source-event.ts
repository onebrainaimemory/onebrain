export interface SourceEvent {
  id: string;
  userId: string;
  sourceType: string;
  rawContent: string;
  isProcessed: boolean;
  memoryItemId: string | null;
  createdAt: string;
}
