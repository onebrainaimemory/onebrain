export interface Entity {
  id: string;
  userId: string;
  name: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntityLink {
  id: string;
  entityId: string;
  memoryItemId: string;
  linkType: string;
  createdAt: string;
}
