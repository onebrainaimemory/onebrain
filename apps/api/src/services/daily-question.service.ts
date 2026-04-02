import { getClient } from '@onebrain/db';
import { audit } from '../lib/audit.js';

// ─────────────────────────────────────────────
// Question Templates (deterministic, no LLM)
// ─────────────────────────────────────────────

export const QUESTION_TEMPLATES: Record<string, string[]> = {
  fact: [
    'What is something new you learned recently?',
    'Is there an important fact about yourself that has changed?',
    'What has been on your mind today?',
  ],
  preference: [
    'Have any of your preferences changed recently?',
    'What do you prefer for your daily workflow?',
    "Is there something you enjoy that you haven't mentioned before?",
  ],
  goal: [
    'What goals are you currently working toward?',
    'Have you made progress on any of your goals?',
    "Is there a new goal you'd like to track?",
  ],
  experience: [
    'What was a meaningful experience you had recently?',
    'Is there something notable that happened to you today?',
    'What experience has shaped your thinking recently?',
  ],
  decision: [
    'Have you made any important decisions recently?',
    "Is there a decision you're currently weighing?",
    'What trade-offs have you been considering?',
  ],
  skill: [
    'What skills are you currently developing?',
    'Have you learned a new technique or tool recently?',
    'What skill would you like to improve?',
  ],
};

const DEFAULT_QUESTIONS = [
  'Tell me something about yourself that I should remember.',
  "What's been most important to you this week?",
  "Is there anything you'd like me to know about your current situation?",
];

interface MemorySnippet {
  type: string;
  title: string;
  body: string;
}

/**
 * Determine which memory types are least represented.
 */
function findMemoryGaps(memories: MemorySnippet[]): string[] {
  const typeCounts = new Map<string, number>();
  for (const m of memories) {
    typeCounts.set(m.type, (typeCounts.get(m.type) ?? 0) + 1);
  }

  const allTypes = Object.keys(QUESTION_TEMPLATES);
  const sorted = allTypes.sort((a, b) => (typeCounts.get(a) ?? 0) - (typeCounts.get(b) ?? 0));
  return sorted.slice(0, 3);
}

/**
 * Try to generate a question using an LLM provider.
 * Returns null if no API key is configured or if the call fails.
 */
async function generateLlmQuestion(
  profileSummary: string,
  memoryGaps: string[],
): Promise<string | null> {
  const geminiKey = process.env['GEMINI_API_KEY'];
  const openaiKey = process.env['OPENAI_API_KEY'];

  if (!geminiKey && !openaiKey) return null;

  const prompt =
    `Given this brain profile: ${profileSummary || 'No profile yet'}. ` +
    `And these memory gaps (types with fewest memories): ${memoryGaps.join(', ')}. ` +
    `Generate one thoughtful personal question to help the user ` +
    `reflect and add knowledge to their memory. ` +
    `Return only the question text, nothing else.`;

  try {
    if (geminiKey) {
      return await callGemini(geminiKey, prompt);
    }
    if (openaiKey) {
      return await callOpenai(openaiKey, prompt);
    }
  } catch {
    // Fallback to template-based generation
  }

  return null;
}

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    'gemini-2.0-flash-lite:generateContent?key=' +
    apiKey;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 100 },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() ?? null;
}

async function callOpenai(apiKey: string, prompt: string): Promise<string | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: 'You generate thoughtful personal reflection questions.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 100,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as {
    choices?: Array<{
      message?: { content?: string };
    }>;
  };

  const text = json.choices?.[0]?.message?.content;
  return text?.trim() ?? null;
}

/**
 * Generate a question based on existing memories.
 * Deterministic: uses template rotation, no LLM.
 */
export function generateQuestionFromMemories(memories: MemorySnippet[]): string {
  if (memories.length === 0) {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
    );
    return DEFAULT_QUESTIONS[dayOfYear % DEFAULT_QUESTIONS.length]!;
  }

  // Determine which memory types exist
  const typeCounts = new Map<string, number>();
  for (const m of memories) {
    typeCounts.set(m.type, (typeCounts.get(m.type) ?? 0) + 1);
  }

  // Find the least-represented type to ask about
  const allTypes = Object.keys(QUESTION_TEMPLATES);
  let targetType = allTypes[0]!;
  let minCount = Infinity;

  for (const type of allTypes) {
    const count = typeCounts.get(type) ?? 0;
    if (count < minCount) {
      minCount = count;
      targetType = type;
    }
  }

  const templates = QUESTION_TEMPLATES[targetType]!;
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  );
  return templates[dayOfYear % templates.length]!;
}

// ─────────────────────────────────────────────
// Answer Parsing (deterministic, no LLM)
// ─────────────────────────────────────────────

interface ParsedMemory {
  type: string;
  title: string;
  body: string;
  sourceType: string;
}

const TYPE_KEYWORDS: Record<string, string[]> = {
  goal: ['goal', 'want to', 'plan to', 'working toward', 'aiming', 'aspire'],
  preference: ['prefer', 'like', 'enjoy', 'favorite', 'rather', 'love'],
  decision: ['decided', 'chose', 'picked', 'going with', 'committed to'],
  skill: ['learning', 'practicing', 'studying', 'developing', 'improving'],
  experience: ['happened', 'experienced', 'went through', 'encountered'],
};

function detectTypeFromText(question: string, answer: string): string {
  const combined = `${question} ${answer}`.toLowerCase();

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return type;
      }
    }
  }

  return 'fact';
}

/**
 * Parse an answer into memory item candidates.
 * Returns empty array for empty or too-short answers.
 */
export function parseAnswerToMemories(question: string, answer: string): ParsedMemory[] {
  const trimmed = answer.trim();
  if (trimmed.length < 3) return [];

  const type = detectTypeFromText(question, trimmed);

  // Create a title from the first ~60 chars of the answer
  const title = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;

  return [
    {
      type,
      title,
      body: trimmed,
      sourceType: 'user_input',
    },
  ];
}

// ─────────────────────────────────────────────
// Streak Logic
// ─────────────────────────────────────────────

/**
 * Update user streak after answering a daily question.
 * Increments if last streak was yesterday, resets to 1 if gap.
 */
async function updateStreak(userId: string): Promise<void> {
  const prisma = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakCount: true, lastStreakDate: true },
  });

  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastDate = user.lastStreakDate ? new Date(user.lastStreakDate) : null;

  if (lastDate) {
    lastDate.setHours(0, 0, 0, 0);
  }

  let newStreak = 1;

  if (lastDate) {
    const diffMs = today.getTime() - lastDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays === 0) {
      // Already answered today, keep current streak
      return;
    }

    if (diffDays === 1) {
      // Consecutive day: increment
      newStreak = (user.streakCount ?? 0) + 1;
    }
    // If > 1 day gap, reset to 1 (default)
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      streakCount: newStreak,
      lastStreakDate: today,
    },
  });
}

// ─────────────────────────────────────────────
// Database Operations
// ─────────────────────────────────────────────

interface DailyQuestionDto {
  id: string;
  userId: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  memoryItemsCreated: string[];
  createdAt: string;
}

/**
 * Get or generate today's question for the user.
 * Uses LLM generation if AI API key is configured.
 */
export async function getTodayQuestion(userId: string): Promise<DailyQuestionDto> {
  const prisma = getClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if a question already exists for today
  const existing = await prisma.dailyQuestion.findFirst({
    where: {
      userId,
      createdAt: { gte: today, lt: tomorrow },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    audit(userId, 'read', 'daily_question', existing.id);
    return toDto(existing);
  }

  // Generate a new question based on existing memories
  const recentMemories = await prisma.memoryItem.findMany({
    where: { userId, status: 'active' },
    select: { type: true, title: true, body: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Try LLM generation first
  let question: string | null = null;

  const profile = await prisma.brainProfile.findUnique({
    where: { userId },
    select: { summary: true },
  });

  const gaps = findMemoryGaps(recentMemories);
  question = await generateLlmQuestion(profile?.summary ?? '', gaps);

  // Fallback to template-based
  if (!question) {
    question = generateQuestionFromMemories(recentMemories);
  }

  const created = await prisma.dailyQuestion.create({
    data: { userId, question },
  });

  audit(userId, 'create', 'daily_question', created.id);
  return toDto(created);
}

/**
 * Submit an answer to a daily question.
 * Converts the answer into memory item candidates.
 * Updates user streak.
 */
export async function answerQuestion(
  userId: string,
  questionId: string,
  answer: string,
): Promise<DailyQuestionDto | null> {
  const prisma = getClient();

  const question = await prisma.dailyQuestion.findFirst({
    where: { id: questionId, userId },
  });

  if (!question) return null;
  if (question.answer) return null; // Already answered

  // Parse answer into memory candidates
  const parsed = parseAnswerToMemories(question.question, answer);
  const memoryIds: string[] = [];

  for (const mem of parsed) {
    const item = await prisma.memoryItem.create({
      data: {
        userId,
        type: mem.type as 'fact' | 'preference' | 'decision' | 'goal' | 'experience' | 'skill',
        title: mem.title,
        body: mem.body,
        sourceType: mem.sourceType as 'user_input',
        confidence: 1.0,
        status: 'candidate',
      },
    });
    memoryIds.push(item.id);

    // Create source event
    await prisma.sourceEvent.create({
      data: {
        userId,
        sourceType: 'daily_question',
        rawContent: answer,
        memoryItemId: item.id,
        isProcessed: true,
      },
    });
  }

  const updated = await prisma.dailyQuestion.update({
    where: { id: questionId },
    data: {
      answer,
      answeredAt: new Date(),
      memoryItemsCreated: memoryIds,
    },
  });

  // Update user streak
  await updateStreak(userId);

  audit(userId, 'update', 'daily_question', questionId, {
    memoriesCreated: memoryIds.length,
  });

  return toDto(updated);
}

/**
 * List past daily questions for a user.
 */
export async function listQuestions(
  userId: string,
  options: { cursor?: string; limit: number },
): Promise<{
  items: DailyQuestionDto[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}> {
  const prisma = getClient();
  const { cursor, limit } = options;

  const [items, total] = await Promise.all([
    prisma.dailyQuestion.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dailyQuestion.count({ where: { userId } }),
  ]);

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1]!.id : null;

  audit(userId, 'list', 'daily_questions', undefined, {
    count: resultItems.length,
  });

  return {
    items: resultItems.map(toDto),
    cursor: nextCursor,
    hasMore,
    total,
  };
}

function toDto(q: {
  id: string;
  userId: string;
  question: string;
  answer: string | null;
  answeredAt: Date | null;
  memoryItemsCreated: string[];
  createdAt: Date;
}): DailyQuestionDto {
  return {
    id: q.id,
    userId: q.userId,
    question: q.question,
    answer: q.answer,
    answeredAt: q.answeredAt?.toISOString() ?? null,
    memoryItemsCreated: q.memoryItemsCreated,
    createdAt: q.createdAt.toISOString(),
  };
}
