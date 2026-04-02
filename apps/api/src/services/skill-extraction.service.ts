import { getClient } from '@onebrain/db';
import { diceCoefficient } from '../lib/similarity.js';
import { audit } from '../lib/audit.js';

// ─── SkillForge Extraction Engine ───

const SKILL_EXTRACT_PROMPT = `Analyze the following memories written by an AI agent and identify reusable skills or patterns.

For each skill found, return a JSON array of objects:
- title: short skill name (max 80 chars, e.g. "Parse CSV with header detection")
- body: detailed description of the skill/pattern (what, when, how to apply)
- triggerConditions: array of strings describing when this skill should activate
- verificationSteps: array of strings to verify the skill was applied correctly
- sourceMemoryIds: array of memory IDs that contributed to this skill
- confidenceScore: number 0-1 based on how consistent the pattern is across memories

Rules:
- Only extract skills that appear in 2+ memories (patterns, not one-offs)
- Focus on actionable, reusable knowledge
- Prefer specificity over generality
- Return [] if no clear patterns found

Only return the JSON array, no other text.`;

interface ExtractedSkill {
  title: string;
  body: string;
  triggerConditions: string[];
  verificationSteps: string[];
  sourceMemoryIds: string[];
  confidenceScore: number;
}

interface SkillExtractionResult {
  skills: ExtractedSkill[];
  provider: string;
  memoriesAnalyzed: number;
}

/**
 * Analyze recent agent-written memories for a user and extract skills.
 * Uses the configured AI provider (Gemini > OpenAI > fallback).
 */
export async function analyzeMemoriesForSkills(
  userId: string,
  options: { limit?: number; sinceHours?: number } = {},
): Promise<SkillExtractionResult> {
  const prisma = getClient();
  const limit = options.limit ?? 50;
  const sinceHours = options.sinceHours ?? 24;

  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  // Fetch recent agent-written memories (sourceType = ai_extraction)
  const memories = await prisma.memoryItem.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { in: ['active', 'candidate'] },
      sourceType: { in: ['ai_extraction', 'system_inference'] },
      createdAt: { gte: since },
    },
    select: { id: true, title: true, body: true, type: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  if (memories.length < 3) {
    return { skills: [], provider: 'skipped', memoriesAnalyzed: memories.length };
  }

  const memoryText = memories
    .map((m) => `[ID: ${m.id}] [${m.type}] ${m.title}\n${m.body}`)
    .join('\n---\n');

  const { skills, provider } = await callSkillExtraction(memoryText);

  // Validate sourceMemoryIds reference actual memories
  const memoryIds = new Set(memories.map((m) => m.id));
  const validated = skills
    .filter((s) => s.sourceMemoryIds.some((id) => memoryIds.has(id)))
    .map((s) => ({
      ...s,
      sourceMemoryIds: s.sourceMemoryIds.filter((id) => memoryIds.has(id)),
    }));

  audit(userId, 'skill_extraction', 'skill_metadata', undefined, {
    provider,
    memoriesAnalyzed: memories.length,
    skillsFound: validated.length,
  });

  return {
    skills: validated,
    provider,
    memoriesAnalyzed: memories.length,
  };
}

/**
 * Deduplicate extracted skills against existing ones.
 * Returns only genuinely new skills (title similarity < 0.7).
 */
export async function deduplicateSkills(
  userId: string,
  candidates: ExtractedSkill[],
): Promise<ExtractedSkill[]> {
  if (candidates.length === 0) return [];

  const prisma = getClient();
  const existingSkills = await prisma.skillMetadata.findMany({
    where: {
      memory: { userId, deletedAt: null },
      status: { in: ['active', 'candidate'] },
    },
    include: { memory: { select: { title: true } } },
    take: 200,
  });

  return candidates.filter((candidate) => {
    return !existingSkills.some((existing) => {
      const sim = diceCoefficient(candidate.title, existing.memory.title);
      return sim > 0.7;
    });
  });
}

/**
 * Persist extracted skills as candidate SkillMetadata entries.
 */
export async function persistExtractedSkills(
  userId: string,
  skills: ExtractedSkill[],
): Promise<string[]> {
  const prisma = getClient();
  const ids: string[] = [];

  for (const skill of skills) {
    const result = await prisma.$transaction(async (tx) => {
      const memory = await tx.memoryItem.create({
        data: {
          userId,
          type: 'skill',
          title: skill.title.slice(0, 500),
          body: skill.body.slice(0, 10000),
          sourceType: 'system_inference',
          confidence: skill.confidenceScore,
          status: 'candidate',
        },
      });

      const meta = await tx.skillMetadata.create({
        data: {
          memoryId: memory.id,
          status: 'candidate',
          triggerConditions: skill.triggerConditions,
          verificationSteps: skill.verificationSteps,
          sourceMemoryIds: skill.sourceMemoryIds,
          confidenceScore: skill.confidenceScore,
        },
      });

      return meta.id;
    });

    ids.push(result);
  }

  audit(userId, 'skill_persist', 'skill_metadata', undefined, {
    count: ids.length,
  });

  return ids;
}

// ─── Skill Lifecycle ───

/**
 * Run the daily skill lifecycle job:
 * 1. Apply decay to all active skills not used in 7+ days
 * 2. Auto-archive stale skills (low decay + low usage + old)
 * 3. Auto-promote high-performing candidates
 */
export async function runSkillLifecycle(): Promise<{
  decayed: number;
  archived: number;
  promoted: number;
}> {
  const prisma = getClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Decay: reduce decayScore for unused skills
  const staleSkills = await prisma.skillMetadata.findMany({
    where: {
      status: 'active',
      OR: [{ lastUsedAt: { lt: sevenDaysAgo } }, { lastUsedAt: null }],
      decayScore: { gt: 0 },
    },
    select: { id: true, decayScore: true },
  });

  let decayed = 0;
  for (const skill of staleSkills) {
    const newDecay = Math.max(0, Math.round((skill.decayScore - 0.05) * 100) / 100);
    await prisma.skillMetadata.update({
      where: { id: skill.id },
      data: { decayScore: newDecay },
    });
    decayed++;
  }

  // 2. Archive: low decay + low usage + older than 30 days
  const archiveResult = await prisma.skillMetadata.updateMany({
    where: {
      status: 'active',
      decayScore: { lt: 0.2 },
      usageCount: { lt: 3 },
      createdAt: { lt: thirtyDaysAgo },
    },
    data: { status: 'archived' },
  });

  // 3. Promote: high-performing candidates
  const promoteResult = await prisma.skillMetadata.updateMany({
    where: {
      status: 'candidate',
      confidenceScore: { gt: 0.8 },
      usageCount: { gte: 5 },
    },
    data: { status: 'active' },
  });

  return {
    decayed,
    archived: archiveResult.count,
    promoted: promoteResult.count,
  };
}

// ─── AI Provider Calls ───

async function callSkillExtraction(
  memoryText: string,
): Promise<{ skills: ExtractedSkill[]; provider: string }> {
  const geminiKey = process.env['GEMINI_API_KEY'] ?? '';
  const openaiKey = process.env['OPENAI_API_KEY'] ?? '';

  if (geminiKey) {
    try {
      const skills = await callGeminiSkillExtract(geminiKey, memoryText);
      return { skills, provider: 'gemini' };
    } catch {
      // Fall through
    }
  }

  if (openaiKey) {
    try {
      const skills = await callOpenAiSkillExtract(openaiKey, memoryText);
      return { skills, provider: 'openai' };
    } catch {
      // Fall through
    }
  }

  return { skills: fallbackSkillExtract(memoryText), provider: 'fallback' };
}

async function callGeminiSkillExtract(apiKey: string, text: string): Promise<ExtractedSkill[]> {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    'gemini-2.0-flash-lite:generateContent?key=' +
    apiKey;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SKILL_EXTRACT_PROMPT}\n\nMemories:\n${text}` }] }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const candidates = data['candidates'] as Array<Record<string, unknown>> | undefined;
  const parts = (candidates?.[0]?.['content'] as Record<string, unknown>)?.['parts'] as
    | Array<Record<string, unknown>>
    | undefined;
  const content = (parts?.[0]?.['text'] as string) ?? '[]';
  return parseSkillResponse(content);
}

async function callOpenAiSkillExtract(apiKey: string, text: string): Promise<ExtractedSkill[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: SKILL_EXTRACT_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const choices = data['choices'] as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.['message'] as Record<string, unknown> | undefined;
  const content = (message?.['content'] as string) ?? '[]';
  return parseSkillResponse(content);
}

/**
 * Deterministic fallback: cluster memories by title similarity
 * and extract patterns without LLM.
 */
function fallbackSkillExtract(text: string): ExtractedSkill[] {
  const blocks = text.split('\n---\n');
  if (blocks.length < 3) return [];

  const parsed = blocks
    .map((block) => {
      const idMatch = block.match(/\[ID: ([^\]]+)\]/);
      const typeMatch = block.match(/\[([^\]]+)\]\s+(.+)/);
      return {
        id: idMatch?.[1] ?? '',
        title: typeMatch?.[2]?.split('\n')[0] ?? '',
        body: block,
      };
    })
    .filter((p) => p.id && p.title);

  // Cluster by title similarity
  const clusters: Array<{ title: string; ids: string[]; bodies: string[] }> = [];

  for (const item of parsed) {
    let matched = false;
    for (const cluster of clusters) {
      if (diceCoefficient(item.title, cluster.title) > 0.5) {
        cluster.ids.push(item.id);
        cluster.bodies.push(item.body);
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({ title: item.title, ids: [item.id], bodies: [item.body] });
    }
  }

  // Only clusters with 2+ items are patterns
  return clusters
    .filter((c) => c.ids.length >= 2)
    .slice(0, 10)
    .map((c) => ({
      title: `Pattern: ${c.title}`,
      body: `Observed ${c.ids.length} times. Common in agent interactions.`,
      triggerConditions: ['Similar context detected'],
      verificationSteps: ['Check if pattern applies'],
      sourceMemoryIds: c.ids,
      confidenceScore: Math.min(0.9, 0.5 + c.ids.length * 0.1),
    }));
}

function parseSkillResponse(rawContent: string): ExtractedSkill[] {
  const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: unknown) => {
        if (!item || typeof item !== 'object') return false;
        const obj = item as Record<string, unknown>;
        return typeof obj['title'] === 'string' && typeof obj['body'] === 'string';
      })
      .map((item: Record<string, unknown>) => ({
        title: String(item['title']).slice(0, 500),
        body: String(item['body']).slice(0, 10000),
        triggerConditions: Array.isArray(item['triggerConditions'])
          ? (item['triggerConditions'] as string[]).map(String)
          : [],
        verificationSteps: Array.isArray(item['verificationSteps'])
          ? (item['verificationSteps'] as string[]).map(String)
          : [],
        sourceMemoryIds: Array.isArray(item['sourceMemoryIds'])
          ? (item['sourceMemoryIds'] as string[]).map(String)
          : [],
        confidenceScore:
          typeof item['confidenceScore'] === 'number'
            ? Math.min(1, Math.max(0, item['confidenceScore']))
            : 0.6,
      }))
      .slice(0, 20);
  } catch {
    return [];
  }
}
