import { getClient } from '@onebrain/db';
import { audit } from '../lib/audit.js';
import { nullableJson } from '../lib/prisma-json.js';

interface ExtractedEntity {
  name: string;
  type: string;
}

const URL_PATTERN = /https?:\/\/[^\s,)}\]]+/gi;

const LOCATION_KEYWORDS = [
  'berlin',
  'munich',
  'hamburg',
  'frankfurt',
  'london',
  'paris',
  'new york',
  'san francisco',
  'tokyo',
  'amsterdam',
  'vienna',
  'zurich',
  'barcelona',
  'madrid',
  'rome',
];

const ORG_SUFFIXES = [
  'gmbh',
  'ag',
  'inc',
  'corp',
  'ltd',
  'llc',
  'co',
  'company',
  'group',
  'foundation',
];

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'not',
  'no',
  'nor',
  'so',
  'if',
  'then',
  'than',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'my',
  'your',
  'his',
  'her',
  'our',
  'their',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'me',
  'him',
  'us',
  'them',
  'what',
  'which',
  'who',
  'whom',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'some',
  'any',
  'other',
  'such',
  'only',
  'own',
  'same',
  'just',
  'also',
  'very',
]);

/**
 * Determine entity type from a candidate name.
 */
function classifyEntity(name: string): string {
  const lower = name.toLowerCase();

  if (URL_PATTERN.test(name)) {
    return 'tool';
  }

  if (LOCATION_KEYWORDS.some((loc) => lower.includes(loc))) {
    return 'place';
  }

  const words = lower.split(/\s+/);
  if (words.some((w) => ORG_SUFFIXES.includes(w))) {
    return 'organization';
  }

  // Names with 2-3 capitalized words are likely persons
  const originalWords = name.split(/\s+/);
  const isCapitalized = originalWords.every((w) => w.length > 0 && w[0] === w[0]!.toUpperCase());
  if (isCapitalized && originalWords.length >= 2 && originalWords.length <= 4) {
    return 'person';
  }

  return 'concept';
}

/**
 * Extract capitalized proper noun sequences from text.
 */
function extractProperNouns(text: string): string[] {
  const results: string[] = [];
  const sentences = text.split(/[.!?\n]+/);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/);
    let currentGroup: string[] = [];

    for (let idx = 0; idx < words.length; idx++) {
      const word = words[idx]!;
      const cleaned = word.replace(/[^a-zA-ZäöüÄÖÜß'-]/g, '');

      if (!cleaned || cleaned.length < 2) {
        flushGroup(currentGroup, results, idx === 0);
        currentGroup = [];
        continue;
      }

      const isCapitalized =
        cleaned[0] === cleaned[0]!.toUpperCase() && cleaned[0] !== cleaned[0]!.toLowerCase();
      const isStopWord = STOP_WORDS.has(cleaned.toLowerCase());

      if (isCapitalized && !isStopWord) {
        currentGroup.push(cleaned);
      } else if (isCapitalized && isStopWord && currentGroup.length > 0) {
        // Allow stop words inside a proper noun group (e.g. "Bank of America")
        currentGroup.push(cleaned);
      } else {
        flushGroup(currentGroup, results, idx <= currentGroup.length);
        currentGroup = [];
      }
    }

    flushGroup(currentGroup, results, words.length === currentGroup.length);
  }

  return [...new Set(results)];
}

function flushGroup(group: string[], results: string[], isStartOfSentence: boolean): void {
  if (group.length < 2) return;

  // Skip if the first word is just a sentence start capitalization
  if (isStartOfSentence && group.length === 2) {
    const firstLower = group[0]!.toLowerCase();
    if (STOP_WORDS.has(firstLower)) return;
  }

  results.push(group.join(' '));
}

/**
 * Extract labeled entities from explicit patterns like "person: X".
 */
function extractLabeledEntities(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  const labelPattern =
    /\b(person|tool|place|organization|company|location|name):\s*([A-Z][A-Za-zäöüÄÖÜß\s'-]{1,60})/gi;

  let match = labelPattern.exec(text);
  while (match) {
    const label = match[1]!.toLowerCase();
    const name = match[2]!.trim();

    let type = 'concept';
    if (label === 'person' || label === 'name') type = 'person';
    else if (label === 'tool') type = 'tool';
    else if (label === 'place' || label === 'location') type = 'place';
    else if (label === 'organization' || label === 'company') {
      type = 'organization';
    }

    results.push({ name, type });
    match = labelPattern.exec(text);
  }

  return results;
}

/**
 * Extract URLs as tool entities.
 */
function extractUrls(text: string): ExtractedEntity[] {
  const urls = text.match(URL_PATTERN) ?? [];
  return urls.map((url) => ({
    name: url.replace(/\/+$/, ''),
    type: 'tool',
  }));
}

/**
 * Heuristic NLP: extract entities from free text.
 * Returns deduplicated list of {name, type}.
 */
export function extractEntitiesFromText(text: string): ExtractedEntity[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const labeled = extractLabeledEntities(text);
  const properNouns = extractProperNouns(text);
  const urls = extractUrls(text);

  const entityMap = new Map<string, ExtractedEntity>();

  // Labeled entities take priority
  for (const entity of labeled) {
    entityMap.set(entity.name.toLowerCase(), entity);
  }

  // Proper nouns
  for (const name of properNouns) {
    const key = name.toLowerCase();
    if (!entityMap.has(key)) {
      entityMap.set(key, { name, type: classifyEntity(name) });
    }
  }

  // URLs
  for (const entity of urls) {
    const key = entity.name.toLowerCase();
    if (!entityMap.has(key)) {
      entityMap.set(key, entity);
    }
  }

  return [...entityMap.values()];
}

/**
 * Auto-extract entities from a memory item's body, create them,
 * and link them to the memory.
 */
export async function autoExtractFromMemory(
  userId: string,
  memoryId: string,
): Promise<ExtractedEntity[]> {
  const prisma = getClient();

  const memory = await prisma.memoryItem.findFirst({
    where: { id: memoryId, userId },
    select: { id: true, title: true, body: true },
  });

  if (!memory) {
    return [];
  }

  const fullText = `${memory.title} ${memory.body}`;
  const extracted = extractEntitiesFromText(fullText);

  if (extracted.length === 0) {
    return [];
  }

  for (const entity of extracted) {
    const existing = await prisma.entity.findFirst({
      where: {
        userId,
        name: { equals: entity.name, mode: 'insensitive' },
        type: entity.type,
      },
      select: { id: true },
    });

    let entityId: string;

    if (existing) {
      entityId = existing.id;
    } else {
      const created = await prisma.entity.create({
        data: {
          userId,
          name: entity.name,
          type: entity.type,
          metadata: nullableJson(null),
        },
      });
      entityId = created.id;
      audit(userId, 'create', 'entity', entityId, {
        source: 'auto_extract',
      });
    }

    const linkExists = await prisma.entityLink.findFirst({
      where: { entityId, memoryItemId: memoryId },
      select: { id: true },
    });

    if (!linkExists) {
      const link = await prisma.entityLink.create({
        data: {
          entityId,
          memoryItemId: memoryId,
          linkType: 'mentioned_in',
        },
      });
      audit(userId, 'create', 'entity_link', link.id, {
        source: 'auto_extract',
        entityId,
        memoryItemId: memoryId,
      });
    }
  }

  audit(userId, 'auto_extract', 'entities', memoryId, {
    count: extracted.length,
  });

  return extracted;
}
