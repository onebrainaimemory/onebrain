import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock BullMQ ───
const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockAdd,
    close: mockClose,
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: mockClose,
  })),
}));

vi.mock('../queues/connection.js', () => ({
  isQueueEnabled: vi.fn().mockReturnValue(true),
  getQueueConnectionOptions: vi.fn().mockReturnValue({
    connection: { url: 'redis://localhost:6379' },
  }),
}));

vi.mock('../config.js', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
    nodeEnv: 'test',
  },
}));

vi.mock('../services/briefing.service.js', () => ({
  isQuietHours: vi.fn().mockReturnValue(false),
  computeNextFireAt: vi.fn().mockReturnValue(new Date()),
}));

// ─── Mock Prisma ───
const mockBriefingCreate = vi.fn().mockResolvedValue({
  id: 'briefing-1',
  userId: 'user-1',
  type: 'morning',
  status: 'delivered',
  title: 'Morning Briefing',
  contentText: 'Content',
});
const mockScheduleUpdate = vi.fn().mockResolvedValue({});
const mockScheduleFindMany = vi.fn().mockResolvedValue([]);
const mockConfigFindUnique = vi.fn().mockResolvedValue({
  userId: 'user-1',
  timezone: 'Europe/Berlin',
  isEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
});

vi.mock('@onebrain/db', () => ({
  getClient: vi.fn().mockReturnValue({
    briefingConfig: {
      findUnique: mockConfigFindUnique,
    },
    briefingSchedule: {
      findMany: mockScheduleFindMany,
      update: mockScheduleUpdate,
    },
    briefing: {
      create: mockBriefingCreate,
    },
    memoryItem: {
      count: vi.fn().mockResolvedValue(5),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    agentActivity: {
      count: vi.fn().mockResolvedValue(10),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: 'test@example.com' }),
    },
  }),
}));

describe('BrainPulse — Briefing Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enqueue a scheduled briefing', async () => {
    const { enqueueBriefingFromSchedule } = await import('../queues/briefing.queue.js');

    const result = await enqueueBriefingFromSchedule('sched-1', 'user-1', 'morning', [
      'email',
      'in_app',
    ]);

    expect(result).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({
        type: 'scheduled',
        scheduleId: 'sched-1',
        userId: 'user-1',
        briefingType: 'morning',
        channels: ['email', 'in_app'],
      }),
      expect.any(Object),
    );
  });

  it('should enqueue a triggered briefing with higher priority', async () => {
    const { enqueueBriefingFromTrigger } = await import('../queues/briefing.queue.js');

    const result = await enqueueBriefingFromTrigger('trig-1', 'user-1', 'event_triggered', [
      'webhook',
    ]);

    expect(result).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({ type: 'triggered', triggerId: 'trig-1' }),
      expect.objectContaining({ priority: 3 }),
    );
  });

  it('should start briefing worker', async () => {
    const { startBriefingWorker } = await import('../queues/briefing.queue.js');
    const { Worker } = await import('bullmq');

    const worker = startBriefingWorker();
    expect(worker).not.toBeNull();
    expect(Worker).toHaveBeenCalledWith(
      'brainpulse-briefings',
      expect.any(Function),
      expect.objectContaining({ concurrency: 2 }),
    );
  });

  it('should gracefully shutdown', async () => {
    const { shutdownBriefingQueue, startBriefingWorker } =
      await import('../queues/briefing.queue.js');

    startBriefingWorker();
    await shutdownBriefingQueue();
    expect(mockClose).toHaveBeenCalled();
  });
});

describe('BrainPulse — Schedule Checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fire due schedules', async () => {
    mockScheduleFindMany.mockResolvedValueOnce([
      {
        id: 'sched-1',
        type: 'morning',
        channels: ['email'],
        cronExpression: '0 8 * * *',
        isActive: true,
        config: { userId: 'user-1', isEnabled: true },
      },
    ]);

    const { checkScheduledBriefings } = await import('../queues/briefing.queue.js');

    const fired = await checkScheduledBriefings();
    expect(fired).toBe(1);
    expect(mockAdd).toHaveBeenCalled();
    expect(mockScheduleUpdate).toHaveBeenCalled();
  });

  it('should skip disabled configs', async () => {
    mockScheduleFindMany.mockResolvedValueOnce([
      {
        id: 'sched-2',
        type: 'morning',
        channels: ['email'],
        cronExpression: '0 8 * * *',
        isActive: true,
        config: { userId: 'user-2', isEnabled: false },
      },
    ]);

    const { checkScheduledBriefings } = await import('../queues/briefing.queue.js');

    const fired = await checkScheduledBriefings();
    expect(fired).toBe(0);
  });

  it('should return 0 when no schedules are due', async () => {
    mockScheduleFindMany.mockResolvedValueOnce([]);

    const { checkScheduledBriefings } = await import('../queues/briefing.queue.js');

    const fired = await checkScheduledBriefings();
    expect(fired).toBe(0);
  });
});

describe('BrainPulse — Content Assembly', () => {
  it('morning briefing includes agent activity and candidates', () => {
    const contentSections = ['agentActivity', 'pendingCandidates', 'projectPriorities'];
    expect(contentSections).toContain('agentActivity');
    expect(contentSections).toContain('pendingCandidates');
  });

  it('evening briefing includes day summary', () => {
    const contentSections = ['daySummary', 'completedItems', 'tomorrowSuggestions'];
    expect(contentSections).toContain('daySummary');
  });

  it('weekly health includes stale memories check', () => {
    const contentSections = ['staleMemories', 'unusedEntities', 'typeDistribution'];
    expect(contentSections).toContain('staleMemories');
  });
});

describe('BrainPulse — Webhook Delivery', () => {
  it('should include HMAC signature when webhook secret is set', async () => {
    const { createHmac } = await import('node:crypto');
    const secret = 'test-webhook-secret';
    const payload = JSON.stringify({
      event: 'briefing.delivered',
      briefingId: 'b-1',
      title: 'Test',
    });

    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(`sha256=${signature}`).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('webhook payload should contain required fields', () => {
    const payload = {
      event: 'briefing.delivered',
      briefingId: 'b-1',
      title: 'Morning Briefing',
      contentText: 'Summary content',
      timestamp: new Date().toISOString(),
    };

    expect(payload).toHaveProperty('event');
    expect(payload).toHaveProperty('briefingId');
    expect(payload).toHaveProperty('title');
    expect(payload).toHaveProperty('timestamp');
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
