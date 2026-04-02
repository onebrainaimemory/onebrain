import { audit } from '../lib/audit.js';

interface ExtractedMemory {
  title: string;
  body: string;
  type: string;
  confidence: number;
}

interface AiExtractResult {
  memories: ExtractedMemory[];
  provider: string;
}

const AI_PROMPT = `Extract structured memories from this text.
Return a JSON array of objects with these fields:
- title: short descriptive title (max 100 chars)
- body: the full content of the memory
- type: one of "fact", "preference", "decision", "goal", "experience", "skill"
- confidence: number between 0 and 1

Only return the JSON array, no other text.`;

async function callGemini(apiKey: string, text: string): Promise<ExtractedMemory[]> {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    'gemini-2.0-flash-lite:generateContent?key=' +
    apiKey;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `${AI_PROMPT}\n\nText:\n${text}` }],
        },
      ],
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
  return parseAiResponse(content);
}

async function callOpenAi(apiKey: string, text: string): Promise<ExtractedMemory[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: AI_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const choices = data['choices'] as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.['message'] as Record<string, unknown> | undefined;
  const content = (message?.['content'] as string) ?? '[]';
  return parseAiResponse(content);
}

function parseAiResponse(rawContent: string): ExtractedMemory[] {
  const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const validTypes = new Set(['fact', 'preference', 'decision', 'goal', 'experience', 'skill']);

    return parsed
      .filter((item: unknown) => {
        if (!item || typeof item !== 'object') return false;
        const obj = item as Record<string, unknown>;
        return typeof obj['title'] === 'string' && typeof obj['body'] === 'string';
      })
      .map((item: Record<string, unknown>) => ({
        title: String(item['title']).slice(0, 500),
        body: String(item['body']).slice(0, 10000),
        type: validTypes.has(String(item['type'])) ? String(item['type']) : 'fact',
        confidence:
          typeof item['confidence'] === 'number'
            ? Math.min(1, Math.max(0, item['confidence']))
            : 0.7,
      }))
      .slice(0, 50);
  } catch {
    return [];
  }
}

function fallbackExtract(text: string): ExtractedMemory[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 20);

  return paragraphs.slice(0, 50).map((paragraph) => {
    const trimmed = paragraph.trim();
    const firstLine = trimmed.split('\n')[0] ?? '';
    const title = firstLine.length > 100 ? firstLine.slice(0, 97) + '...' : firstLine;

    return {
      title: title || trimmed.slice(0, 100),
      body: trimmed,
      type: 'fact',
      confidence: 0.5,
    };
  });
}

export async function extractWithAi(
  userId: string,
  text: string,
  preferredProvider?: string,
): Promise<AiExtractResult> {
  const geminiKey = process.env['GEMINI_API_KEY'] ?? '';
  const openaiKey = process.env['OPENAI_API_KEY'] ?? '';

  let provider = 'fallback';
  let memories: ExtractedMemory[] = [];

  if (preferredProvider === 'gemini' && geminiKey) {
    try {
      memories = await callGemini(geminiKey, text);
      provider = 'gemini';
    } catch {
      memories = fallbackExtract(text);
    }
  } else if (preferredProvider === 'openai' && openaiKey) {
    try {
      memories = await callOpenAi(openaiKey, text);
      provider = 'openai';
    } catch {
      memories = fallbackExtract(text);
    }
  } else if (geminiKey) {
    try {
      memories = await callGemini(geminiKey, text);
      provider = 'gemini';
    } catch {
      memories = fallbackExtract(text);
    }
  } else if (openaiKey) {
    try {
      memories = await callOpenAi(openaiKey, text);
      provider = 'openai';
    } catch {
      memories = fallbackExtract(text);
    }
  } else {
    memories = fallbackExtract(text);
  }

  audit(userId, 'ai_extract', 'memory_items', undefined, {
    provider,
    count: memories.length,
  });

  return { memories, provider };
}
