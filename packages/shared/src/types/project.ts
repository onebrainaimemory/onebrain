export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemoryLink {
  id: string;
  projectId: string;
  memoryItemId: string;
  linkType: string;
  createdAt: string;
}
