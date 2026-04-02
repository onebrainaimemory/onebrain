export interface DailyQuestion {
  id: string;
  userId: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  memoryItemsCreated: string[];
  createdAt: string;
}
