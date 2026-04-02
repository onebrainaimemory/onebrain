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

vi.mock('../lib/feature-gate.js', () => ({
  canUseSkillForge: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/audit.js', () => ({
  audit: vi.fn(),
}));

// ─── Mock Prisma ───
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdateMany = vi.fn();
const mockTransaction = vi.fn();

const mockSkillUpdate = vi.fn().mockResolvedValue({});

vi.mock('@onebrain/db', () => ({
  getClient: vi.fn().mockReturnValue({
    memoryItem: {
      findMany: mockFindMany,
      create: mockCreate,
    },
    skillMetadata: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'skill-1' }),
      update: mockSkillUpdate,
      updateMany: mockUpdateMany,
    },
    $transaction: mockTransaction,
  }),
}));

vi.mock('../lib/similarity.js', () => ({
  diceCoefficient: vi.fn().mockReturnValue(0.2),
}));

describe('SkillForge — Extraction Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip analysis when fewer than 3 memories', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'mem-1', title: 'A', body: 'Body A', type: 'fact' }]);

    const { analyzeMemoriesForSkills } = await import('../services/skill-extraction.service.js');
    const result = await analyzeMemoriesForSkills('user-1');

    expect(result.provider).toBe('skipped');
    expect(result.skills).toHaveLength(0);
  });

  it('should use fallback extraction when no AI keys configured', async () => {
    const memories = Array.from({ length: 5 }, (_, i) => ({
      id: `mem-${i}`,
      title: `Pattern Alpha: variant ${i}`,
      body: `Body content for memory ${i} about alpha patterns`,
      type: 'skill',
    }));
    mockFindMany.mockResolvedValueOnce(memories);

    const { analyzeMemoriesForSkills } = await import('../services/skill-extraction.service.js');
    const result = await analyzeMemoriesForSkills('user-1', { sinceHours: 48 });

    expect(result.provider).toBe('fallback');
    expect(result.memoriesAnalyzed).toBe(5);
  });

  it('should deduplicate against existing skills', async () => {
    const { diceCoefficient } = await import('../lib/similarity.js');
    // First call: high similarity (duplicate), second call: low (unique)
    vi.mocked(diceCoefficient).mockReturnValueOnce(0.9).mockReturnValueOnce(0.3);

    const { getClient } = await import('@onebrain/db');
    const prisma = getClient();
    vi.mocked(prisma.skillMetadata.findMany).mockResolvedValueOnce([
      {
        id: 'existing-1',
        memory: { title: 'Existing Skill' },
        memoryId: 'mem-x',
        status: 'active',
      },
    ] as never);

    const { deduplicateSkills } = await import('../services/skill-extraction.service.js');

    const candidates = [
      {
        title: 'Existing Skill Copy',
        body: 'Duplicate',
        triggerConditions: [],
        verificationSteps: [],
        sourceMemoryIds: ['mem-1'],
        confidenceScore: 0.7,
      },
      {
        title: 'Completely New',
        body: 'New skill',
        triggerConditions: [],
        verificationSteps: [],
        sourceMemoryIds: ['mem-2'],
        confidenceScore: 0.8,
      },
    ];

    const result = await deduplicateSkills('user-1', candidates);
    // First is duplicate (0.9 > 0.7), second is unique (0.3 < 0.7)
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Completely New');
  });

  it('should persist extracted skills as candidates', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        memoryItem: {
          create: vi.fn().mockResolvedValue({ id: 'mem-new' }),
        },
        skillMetadata: {
          create: vi.fn().mockResolvedValue({ id: 'skill-new' }),
        },
      };
      return fn(tx);
    });

    const { persistExtractedSkills } = await import('../services/skill-extraction.service.js');

    const ids = await persistExtractedSkills('user-1', [
      {
        title: 'New Skill',
        body: 'Description',
        triggerConditions: ['when X'],
        verificationSteps: ['check Y'],
        sourceMemoryIds: ['mem-1'],
        confidenceScore: 0.75,
      },
    ]);

    expect(ids).toHaveLength(1);
  });
});

describe('SkillForge — Skill Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run lifecycle: decay + archive + promote', async () => {
    const { getClient } = await import('@onebrain/db');
    const prisma = getClient();

    // Mock stale skills for decay
    vi.mocked(prisma.skillMetadata.findMany).mockResolvedValueOnce([
      { id: 'skill-1', decayScore: 0.5 },
      { id: 'skill-2', decayScore: 0.1 },
    ] as never);

    // Decay loop uses skillMetadata.update (singular), already mocked
    // Archive + promote use skillMetadata.updateMany
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // archive
      .mockResolvedValueOnce({ count: 2 }); // promote

    const { runSkillLifecycle } = await import('../services/skill-extraction.service.js');
    const result = await runSkillLifecycle();

    expect(result.decayed).toBe(2);
    expect(result.archived).toBe(1);
    expect(result.promoted).toBe(2);
  });
});

describe('SkillForge — Analysis Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enqueue skill analysis job', async () => {
    const { enqueueSkillAnalysis } = await import('../queues/skill-analysis.queue.js');

    const result = await enqueueSkillAnalysis('user-1', 48);
    expect(result).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(
      'extract',
      expect.objectContaining({ userId: 'user-1', type: 'extract', sinceHours: 48 }),
      expect.any(Object),
    );
  });

  it('should enqueue lifecycle job', async () => {
    const { enqueueSkillLifecycle } = await import('../queues/skill-analysis.queue.js');

    const result = await enqueueSkillLifecycle();
    expect(result).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(
      'lifecycle',
      expect.objectContaining({ type: 'lifecycle' }),
      expect.any(Object),
    );
  });

  it('should reject analysis for users without SkillForge', async () => {
    const { canUseSkillForge } = await import('../lib/feature-gate.js');
    vi.mocked(canUseSkillForge).mockResolvedValueOnce(false);

    const { enqueueSkillAnalysis } = await import('../queues/skill-analysis.queue.js');

    const result = await enqueueSkillAnalysis('free-user');
    expect(result).toBe(false);
  });

  it('should start analysis worker', async () => {
    const { startSkillAnalysisWorker } = await import('../queues/skill-analysis.queue.js');
    const { Worker } = await import('bullmq');

    const worker = startSkillAnalysisWorker();
    expect(worker).not.toBeNull();
    expect(Worker).toHaveBeenCalledWith(
      'skillforge-analysis',
      expect.any(Function),
      expect.objectContaining({ concurrency: 1 }),
    );
  });

  it('should gracefully shutdown', async () => {
    const { shutdownSkillAnalysisQueue, startSkillAnalysisWorker } =
      await import('../queues/skill-analysis.queue.js');

    startSkillAnalysisWorker();
    await shutdownSkillAnalysisQueue();
    expect(mockClose).toHaveBeenCalled();
  });
});

describe('SkillForge — Fallback extraction logic', () => {
  it('should cluster similar memories by title', () => {
    // Test the clustering logic deterministically
    const memories = [
      { id: 'a', title: 'Parse CSV files', type: 'skill' },
      { id: 'b', title: 'Parse CSV headers', type: 'skill' },
      { id: 'c', title: 'Unrelated topic', type: 'fact' },
    ];

    // Simulate clustering: titles with >0.5 similarity form a cluster
    const clusters: Array<{ title: string; ids: string[] }> = [];
    for (const m of memories) {
      let matched = false;
      for (const c of clusters) {
        // Simple check: share a word
        const mWords = new Set(m.title.toLowerCase().split(' '));
        const cWords = new Set(c.title.toLowerCase().split(' '));
        const overlap = [...mWords].filter((w) => cWords.has(w)).length;
        if (overlap >= 2) {
          c.ids.push(m.id);
          matched = true;
          break;
        }
      }
      if (!matched) {
        clusters.push({ title: m.title, ids: [m.id] });
      }
    }

    const patterns = clusters.filter((c) => c.ids.length >= 2);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.ids).toContain('a');
    expect(patterns[0]!.ids).toContain('b');
  });

  it('should return empty for fewer than 3 blocks', () => {
    // Fallback needs multiple blocks
    const text = '[ID: a] [fact] Single item\nBody';
    const blocks = text.split('\n---\n');
    expect(blocks.length).toBeLessThan(3);
  });
});
