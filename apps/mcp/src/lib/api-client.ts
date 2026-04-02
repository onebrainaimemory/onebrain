/**
 * HTTP client that calls the OneBrain REST API.
 * All MCP tools delegate to the API — no duplicated business logic.
 */

const API_BASE = process.env['ONEBRAIN_API_URL'] ?? 'http://localhost:3001';

interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
  meta?: Record<string, unknown>;
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `ApiKey ${apiKey}`,
  };

  const init: RequestInit = { method, headers };
  if (body) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || json.error) {
    throw new ApiClientError(
      json.error?.code ?? 'API_ERROR',
      json.error?.message ?? `API request failed with status ${response.status}`,
      response.status,
    );
  }

  return json.data as T;
}

// ─────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────

export interface BrainContext {
  formatted: string;
  structured: {
    profile?: {
      summary: string | null;
      traits: Record<string, unknown>;
      preferences: Record<string, unknown>;
    };
    memories: Array<{ type: string; title: string; body: string; confidence: number }>;
    entities: Array<{ name: string; type: string; description: string | null; linkCount: number }>;
    projects: Array<{ name: string; description: string | null; status: string }>;
    stats?: { totalMemories: number; totalEntities: number; totalProjects: number };
  };
  meta: { scope: string; tokenEstimate: number; truncated: boolean };
}

export interface MemoryItem {
  id: string;
  type: string;
  title: string;
  body: string;
  confidence: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryListResponse {
  items: MemoryItem[];
  pagination: { nextCursor: string | null; hasMore: boolean; total: number };
}

export interface ExtractResult {
  memory: MemoryItem;
  sourceEventId: string;
  isDuplicate: boolean;
}

export interface BatchResult {
  created: number;
  duplicates: number;
  items: MemoryItem[];
}

export interface EntityDto {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

// ─────────────────────────────────────────────
// Brain
// ─────────────────────────────────────────────

export async function getUserContext(apiKey: string): Promise<BrainContext> {
  return request<BrainContext>('GET', '/v1/brain/context', apiKey);
}

export async function getBrainProfile(apiKey: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('GET', '/v1/brain/profile', apiKey);
}

// ─────────────────────────────────────────────
// Memory
// ─────────────────────────────────────────────

export async function searchMemory(
  apiKey: string,
  params: { type?: string; status?: string; cursor?: string; limit?: number },
): Promise<MemoryListResponse> {
  const query = new URLSearchParams();
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return request<MemoryListResponse>('GET', `/v1/memory${qs ? `?${qs}` : ''}`, apiKey);
}

export async function writeMemory(
  apiKey: string,
  input: { type: string; title: string; body: string; sourceType?: string },
): Promise<ExtractResult> {
  return request<ExtractResult>('POST', '/v1/memory/extract', apiKey, input);
}

export async function writeMemoryBatch(
  apiKey: string,
  items: Array<{ type: string; title: string; body: string; sourceType?: string }>,
): Promise<BatchResult> {
  return request<BatchResult>('POST', '/v1/memory/batch', apiKey, items);
}

// ─────────────────────────────────────────────
// Entity
// ─────────────────────────────────────────────

export async function upsertEntity(
  apiKey: string,
  input: { name: string; type: string; description?: string },
): Promise<EntityDto> {
  // Try to find existing entity first, then create or update
  const entities = await request<{ items: EntityDto[] }>('GET', `/v1/entities?limit=100`, apiKey);

  const existing = entities.items?.find(
    (e) =>
      e.name.toLowerCase() === input.name.toLowerCase() &&
      e.type.toLowerCase() === input.type.toLowerCase(),
  );

  if (existing) {
    return request<EntityDto>('PATCH', `/v1/entities/${existing.id}`, apiKey, {
      description: input.description,
    });
  }

  return request<EntityDto>('POST', '/v1/entities', apiKey, input);
}

// ─────────────────────────────────────────────
// DeepRecall Search
// ─────────────────────────────────────────────

export interface DeepSearchResult {
  id: string;
  title: string;
  body: string;
  type: string;
  confidence: number;
  score: number;
  diceScore: number;
  vectorScore: number;
}

export interface DeepSearchResponse {
  results: DeepSearchResult[];
  searchMode: string;
  downgradedFrom?: string;
}

export async function deepSearch(
  apiKey: string,
  params: { query: string; mode?: string; top_k?: number; alpha?: number },
): Promise<DeepSearchResponse> {
  return request<DeepSearchResponse>('POST', '/v1/memory/search', apiKey, params);
}

// ─────────────────────────────────────────────
// SkillForge
// ─────────────────────────────────────────────

export interface SkillItem {
  id: string;
  title: string;
  body: string;
  status: string;
  confidenceScore: number;
  usageCount: number;
  triggerConditions: string[];
}

export interface SkillListResponse {
  items: SkillItem[];
  pagination: { cursor: string | null; hasMore: boolean };
}

export async function listSkills(
  apiKey: string,
  params: {
    status?: string;
    minConfidence?: number;
    sortBy?: string;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<SkillListResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.minConfidence !== undefined) {
    query.set('minConfidence', String(params.minConfidence));
  }
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);

  const qs = query.toString();
  return request<SkillListResponse>('GET', `/v1/skills${qs ? `?${qs}` : ''}`, apiKey);
}

export async function recordSkillFeedback(
  apiKey: string,
  skillId: string,
  eventType: string,
  context?: Record<string, unknown>,
): Promise<{ recorded: boolean }> {
  const body: { eventType: string; context?: Record<string, unknown> } = {
    eventType,
  };
  if (context) body.context = context;
  return request<{ recorded: boolean }>('POST', `/v1/skills/${skillId}/feedback`, apiKey, body);
}

// ─────────────────────────────────────────────
// BrainPulse
// ─────────────────────────────────────────────

export interface BriefingConfigResponse {
  id: string;
  isEnabled: boolean;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  channels: string[];
}

export interface BriefingItem {
  id: string;
  type: string;
  status: string;
  title: string;
  createdAt: string;
}

export interface BriefingListResponse {
  items: BriefingItem[];
  pagination: { cursor: string | null; hasMore: boolean };
}

export async function getBriefingConfig(apiKey: string): Promise<BriefingConfigResponse> {
  return request<BriefingConfigResponse>('GET', '/v1/briefings/config', apiKey);
}

export async function listBriefings(
  apiKey: string,
  params: {
    type?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<BriefingListResponse> {
  const query = new URLSearchParams();
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);

  const qs = query.toString();
  return request<BriefingListResponse>('GET', `/v1/briefings${qs ? `?${qs}` : ''}`, apiKey);
}

// ─────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────

export async function getProjectContext(
  apiKey: string,
  projectId?: string,
): Promise<ProjectDto | { items: ProjectDto[] }> {
  if (projectId) {
    return request<ProjectDto>('GET', `/v1/projects/${projectId}`, apiKey);
  }
  return request<{ items: ProjectDto[] }>('GET', '/v1/projects?status=active&limit=10', apiKey);
}
