/**
 * Normalize text for storage or comparison.
 *
 * @param text - The text to normalize.
 * @param options.lowercase - Also lowercase the text (default: false).
 *   Use true for matching/comparison, false for storage normalization.
 */
export function normalize(text: string, options: { lowercase?: boolean } = {}): string {
  let result = text.replace(/\s+/g, ' ').trim();
  if (options.lowercase) {
    result = result.toLowerCase();
  }
  return result;
}

/**
 * Similarity thresholds used across the codebase.
 * Defined once, imported everywhere to keep behavior consistent.
 */
export const SimilarityThresholds = {
  /** For exact duplicate detection (e.g., findDuplicateMemory) */
  DEDUP: 0.8,
  /** For consolidation merging of similar memories */
  MERGE: 0.7,
  /** For conflict detection (same topic, different body) */
  CONFLICT: 0.5,
} as const;
