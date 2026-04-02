import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  listSkills,
  recordSkillFeedback,
  getBriefingConfig,
  listBriefings,
  type SkillListResponse,
  type BriefingConfigResponse,
  type BriefingListResponse,
} from '../lib/api-client.js';

function mockJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve({ data }),
  };
}

function mockErrorResponse(code: string, message: string, status = 403) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code, message } }),
  };
}

describe('MCP API Client — SkillForge Tools (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listSkills()', () => {
    it('should call GET /v1/skills with auth header', async () => {
      const mockData: SkillListResponse = {
        items: [
          {
            id: 'skill-1',
            title: 'Parse CSV',
            body: 'Detect headers automatically',
            status: 'active',
            confidenceScore: 0.85,
            usageCount: 12,
            triggerConditions: ['CSV file detected'],
          },
        ],
        pagination: { cursor: null, hasMore: false },
      };

      mockFetch.mockResolvedValueOnce(mockJsonResponse(mockData));

      const result = await listSkills('test-key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/skills'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'ApiKey test-key',
          }),
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe('Parse CSV');
    });

    it('should pass filter parameters as query string', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          items: [],
          pagination: { cursor: null, hasMore: false },
        }),
      );

      await listSkills('test-key', {
        status: 'active',
        minConfidence: 0.5,
        sortBy: 'confidence',
        limit: 10,
      });

      const calledUrl = mockFetch.mock.calls[0]![0] as string;
      expect(calledUrl).toContain('status=active');
      expect(calledUrl).toContain('minConfidence=0.5');
      expect(calledUrl).toContain('sortBy=confidence');
      expect(calledUrl).toContain('limit=10');
    });

    it('should throw on plan limit error', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse('PLAN_LIMIT_EXCEEDED', 'SkillForge requires Pro plan', 403),
      );

      await expect(listSkills('test-key')).rejects.toThrow('SkillForge requires Pro plan');
    });
  });

  describe('recordSkillFeedback()', () => {
    it('should call POST /v1/skills/:id/feedback', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ recorded: true }));

      await recordSkillFeedback('test-key', 'skill-1', 'applied', {
        query: 'parse CSV',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/skills/skill-1/feedback'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            eventType: 'applied',
            context: { query: 'parse CSV' },
          }),
        }),
      );
    });

    it('should handle feedback without context', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ recorded: true }));

      await recordSkillFeedback('test-key', 'skill-2', 'dismissed');

      const body = JSON.parse((mockFetch.mock.calls[0]![1] as { body: string }).body);
      expect(body.eventType).toBe('dismissed');
      expect(body.context).toBeUndefined();
    });
  });
});

describe('MCP API Client — BrainPulse Tools (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBriefingConfig()', () => {
    it('should call GET /v1/briefings/config', async () => {
      const mockConfig: BriefingConfigResponse = {
        id: 'cfg-1',
        isEnabled: true,
        timezone: 'Europe/Berlin',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        channels: ['email', 'in_app'],
      };

      mockFetch.mockResolvedValueOnce(mockJsonResponse(mockConfig));

      const result = await getBriefingConfig('test-key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/briefings/config'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'ApiKey test-key',
          }),
        }),
      );
      expect(result.timezone).toBe('Europe/Berlin');
    });

    it('should throw on plan limit error', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse('PLAN_LIMIT_EXCEEDED', 'BrainPulse requires plan', 403),
      );

      await expect(getBriefingConfig('test-key')).rejects.toThrow('BrainPulse requires plan');
    });
  });

  describe('listBriefings()', () => {
    it('should call GET /v1/briefings with filters', async () => {
      const mockData: BriefingListResponse = {
        items: [
          {
            id: 'br-1',
            type: 'morning',
            status: 'delivered',
            title: 'Morning Briefing',
            createdAt: '2026-03-31T07:00:00Z',
          },
        ],
        pagination: { cursor: null, hasMore: false },
      };

      mockFetch.mockResolvedValueOnce(mockJsonResponse(mockData));

      const result = await listBriefings('test-key', {
        type: 'morning',
        limit: 5,
      });

      const calledUrl = mockFetch.mock.calls[0]![0] as string;
      expect(calledUrl).toContain('type=morning');
      expect(calledUrl).toContain('limit=5');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.type).toBe('morning');
    });

    it('should call without filters', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          items: [],
          pagination: { cursor: null, hasMore: false },
        }),
      );

      await listBriefings('test-key');

      const calledUrl = mockFetch.mock.calls[0]![0] as string;
      expect(calledUrl).toMatch(/\/v1\/briefings$/);
    });
  });
});
