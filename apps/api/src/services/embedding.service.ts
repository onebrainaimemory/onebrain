import { getClient } from '@onebrain/db';
import { diceCoefficient } from '../lib/similarity.js';

const OPENROUTER_API_KEY = process.env['OPENROUTER_API_KEY'] ?? '';
const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] ?? '';
const EMBEDDING_MODEL = process.env['EMBEDDING_MODEL'] ?? 'text-embedding-3-small';

// ─── Configuration ───

export function isEmbeddingEnabled(): boolean {
  return !!(OPENROUTER_API_KEY || OPENAI_API_KEY);
}

function getApiConfig(): { url: string; key: string } {
  if (OPENROUTER_API_KEY) {
    return {
      url: 'https://openrouter.ai/api/v1/embeddings',
      key: OPENROUTER_API_KEY,
    };
  }
  return {
    url: 'https://api.openai.com/v1/embeddings',
    key: OPENAI_API_KEY,
  };
}

// ─── Embedding Generation ───

async function getEmbedding(text: string): Promise<{ embedding: number[]; tokensUsed: number }> {
  const { url, key } = getApiConfig();
  if (!key) {
    throw new Error('No embedding API key configured (OPENROUTER_API_KEY or OPENAI_API_KEY)');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API request failed: ${response.status} ${err}`);
  }

  const json = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
    usage?: { total_tokens?: number };
  };

  return {
    embedding: json.data[0]!.embedding,
    tokensUsed: json.usage?.total_tokens ?? 0,
  };
}

// ─── Storage ───

export async function storeEmbedding(memoryItemId: string, text: string): Promise<number> {
  if (!isEmbeddingEnabled()) return 0;

  const prisma = getClient();
  const { embedding, tokensUsed } = await getEmbedding(text);

  await prisma.$executeRaw`
    INSERT INTO embeddings (memory_item_id, content, embedding)
    VALUES (${memoryItemId}::uuid, ${text}, ${JSON.stringify(embedding)}::vector)
    ON CONFLICT (memory_item_id) DO UPDATE
      SET content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
  `;

  // Update embedding status
  await prisma.memoryItem.update({
    where: { id: memoryItemId },
    data: { embeddingStatus: 'completed' },
  });

  return tokensUsed;
}

export async function deleteEmbedding(memoryItemId: string): Promise<void> {
  if (!isEmbeddingEnabled()) return;

  const prisma = getClient();
  await prisma.$executeRaw`DELETE FROM embeddings WHERE memory_item_id = ${memoryItemId}::uuid`;
}

/**
 * Mark a memory as pending embedding generation.
 * Used for async/fire-and-forget embedding pipeline.
 */
export async function markEmbeddingPending(memoryItemId: string): Promise<void> {
  const prisma = getClient();
  await prisma.memoryItem.update({
    where: { id: memoryItemId },
    data: { embeddingStatus: 'pending' },
  });
}

/**
 * Mark a memory's embedding as failed.
 */
export async function markEmbeddingFailed(memoryItemId: string): Promise<void> {
  const prisma = getClient();
  await prisma.memoryItem.update({
    where: { id: memoryItemId },
    data: { embeddingStatus: 'failed' },
  });
}

// ─── Search ───

export interface SemanticSearchResult {
  memoryItemId: string;
  score: number;
  title: string;
  body: string;
  type: string;
  confidence: number;
}

export async function semanticSearch(
  userId: string,
  query: string,
  topK = 10,
): Promise<SemanticSearchResult[]> {
  if (!isEmbeddingEnabled()) return [];

  const prisma = getClient();
  const { embedding: queryEmbedding } = await getEmbedding(query);

  const embeddingStr = JSON.stringify(queryEmbedding);
  const results = await prisma.$queryRaw<
    Array<{
      memory_item_id: string;
      title: string;
      body: string;
      type: string;
      confidence: number;
      score: number;
    }>
  >`
    SELECT m.id as memory_item_id, m.title, m.body, m.type, m.confidence,
           1 - (e.embedding <=> ${embeddingStr}::vector) as score
    FROM embeddings e
    JOIN memory_items m ON m.id = e.memory_item_id
    WHERE m.user_id = ${userId}::uuid
      AND m.deleted_at IS NULL
      AND m.status = 'active'
    ORDER BY e.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `;

  return results.map((r) => ({
    memoryItemId: r.memory_item_id,
    score: Math.round(r.score * 1000) / 1000,
    title: r.title,
    body: r.body,
    type: r.type,
    confidence: r.confidence,
  }));
}

/**
 * Keyword-only search using Dice coefficient scoring.
 * Deterministic, explainable — the OneBrain default.
 */
export async function keywordSearch(
  userId: string,
  query: string,
  topK = 10,
): Promise<Array<SemanticSearchResult & { diceScore: number }>> {
  const prisma = getClient();
  const memories = await prisma.memoryItem.findMany({
    where: {
      userId,
      deletedAt: null,
      status: 'active',
    },
    select: { id: true, title: true, body: true, type: true, confidence: true },
    take: 200,
    orderBy: { updatedAt: 'desc' },
  });

  const scored = memories
    .map((m) => {
      const titleDice = diceCoefficient(query, m.title);
      const bodyDice = diceCoefficient(query, m.body.slice(0, 500));
      const diceScore = titleDice * 0.6 + bodyDice * 0.4;
      return {
        memoryItemId: m.id,
        title: m.title,
        body: m.body,
        type: m.type,
        confidence: m.confidence,
        score: Math.round(diceScore * 1000) / 1000,
        diceScore: Math.round(diceScore * 1000) / 1000,
      };
    })
    .filter((m) => m.diceScore > 0.05);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export interface HybridSearchResult extends SemanticSearchResult {
  vectorScore: number;
  diceScore: number;
  searchMode: 'keyword' | 'vector' | 'hybrid';
}

/**
 * DeepRecall hybrid search: fuses vector cosine similarity with Dice coefficient.
 * score = alpha * vectorScore + (1 - alpha) * diceScore
 */
export async function hybridSearch(
  userId: string,
  query: string,
  topK = 10,
  alpha = 0.6,
): Promise<HybridSearchResult[]> {
  // Run both searches in parallel
  const [vectorResults, diceResults] = await Promise.all([
    semanticSearch(userId, query, topK * 2),
    keywordSearch(userId, query, topK * 2),
  ]);

  const merged = new Map<
    string,
    { item: SemanticSearchResult; vectorScore: number; diceScore: number }
  >();

  for (const vr of vectorResults) {
    merged.set(vr.memoryItemId, {
      item: vr,
      vectorScore: vr.score,
      diceScore: 0,
    });
  }

  for (const dr of diceResults) {
    const existing = merged.get(dr.memoryItemId);
    if (existing) {
      existing.diceScore = dr.diceScore;
    } else {
      merged.set(dr.memoryItemId, {
        item: dr,
        vectorScore: 0,
        diceScore: dr.diceScore,
      });
    }
  }

  const results: HybridSearchResult[] = Array.from(merged.values()).map((entry) => {
    const fusedScore = entry.vectorScore * alpha + entry.diceScore * (1 - alpha);
    return {
      ...entry.item,
      score: Math.round(fusedScore * 1000) / 1000,
      vectorScore: entry.vectorScore,
      diceScore: entry.diceScore,
      searchMode: 'hybrid' as const,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
