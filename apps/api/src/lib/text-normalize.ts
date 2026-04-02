/**
 * Normalize text for storage: trim and collapse whitespace.
 * Preserves original casing.
 */
export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize text for comparison: trim, collapse whitespace, lowercase.
 * Used only for matching — never stored as the canonical value.
 */
export function normalizeForComparison(text: string): string {
  return normalize(text).toLowerCase();
}
