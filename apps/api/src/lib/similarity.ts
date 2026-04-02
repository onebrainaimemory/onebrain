/**
 * Deterministic string similarity using Dice coefficient (bigram overlap).
 * No ML, no embeddings — fully explainable.
 */

function bigrams(text: string): Set<string> {
  const lower = text.toLowerCase();
  const set = new Set<string>();
  for (let i = 0; i < lower.length - 1; i++) {
    set.add(lower.slice(i, i + 2));
  }
  return set;
}

/**
 * Compute Sorensen-Dice coefficient between two strings.
 * Returns value between 0.0 (no overlap) and 1.0 (identical).
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.toLowerCase() === b.toLowerCase()) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;
  if (a.length === 1 && b.length === 1) {
    return a.toLowerCase() === b.toLowerCase() ? 1.0 : 0.0;
  }

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);

  if (bigramsA.size === 0 && bigramsB.size === 0) return 1.0;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0.0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) {
      intersection++;
    }
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Check if two strings are similar enough to be considered a match.
 * Default threshold: 0.6 (tuned for memory title/body comparison).
 */
export function isSimilar(a: string, b: string, threshold = 0.6): boolean {
  return diceCoefficient(a, b) >= threshold;
}
