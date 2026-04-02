import type { ContextStructured } from './types.js';

/**
 * Estimate token count from text length.
 *
 * NOTE: This is a rough approximation (~4 chars/token) suitable for
 * budgeting purposes only. Actual token counts vary by tokenizer
 * (tiktoken, BPE variants). Consider using tiktoken for production
 * accuracy — but this heuristic is fast, zero-dependency, and
 * consistently conservative.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate body text to maxLength characters with ellipsis.
 */
export function compressBody(body: string, maxLength: number): string {
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength)}...`;
}

/**
 * Estimate tokens for a full structured context.
 * Uses a tighter ratio (chars/3.2) for JSON because structural
 * characters (braces, brackets, quotes, colons, commas) tokenize
 * less efficiently than natural language text — roughly 15-25% overhead.
 *
 * NOTE: Like estimateTokens(), this is a heuristic. Actual JSON token
 * counts depend on the tokenizer. The ratio 3.2 is calibrated against
 * typical BPE tokenizers on JSON payloads.
 */
function estimateStructuredTokens(structured: ContextStructured): number {
  const json = JSON.stringify(structured);
  return Math.ceil(json.length / 3.2);
}

/**
 * Compress structured context to fit within a token budget.
 *
 * Strategy (deterministic, in order):
 * 1. Truncate memory bodies to progressively shorter lengths
 * 2. Remove entity descriptions
 * 3. Drop lowest-confidence memories
 *
 * Returns the compressed structured data and metadata.
 */
export function compressToTokenBudget(
  structured: ContextStructured,
  tokenBudget: number,
): { structured: ContextStructured; tokenEstimate: number; truncated: boolean } {
  const current = deepClone(structured);
  let estimate = estimateStructuredTokens(current);
  let truncated = false;

  // Step 1: Truncate memory bodies progressively
  const bodyLimits = [300, 150, 80, 40];
  for (const limit of bodyLimits) {
    if (estimate <= tokenBudget) break;
    truncated = true;
    current.memories = current.memories.map((m) => ({
      ...m,
      body: compressBody(m.body, limit),
    }));
    estimate = estimateStructuredTokens(current);
  }

  // Step 2: Remove entity descriptions
  if (estimate > tokenBudget) {
    truncated = true;
    current.entities = current.entities.map((e) => ({
      ...e,
      description: null,
    }));
    estimate = estimateStructuredTokens(current);
  }

  // Step 3: Remove project descriptions
  if (estimate > tokenBudget) {
    truncated = true;
    current.projects = current.projects.map((p) => ({
      ...p,
      description: null,
    }));
    estimate = estimateStructuredTokens(current);
  }

  // Step 4: Drop lowest-confidence memories one by one
  while (estimate > tokenBudget && current.memories.length > 1) {
    truncated = true;
    // Remove the last memory (already sorted by relevance, lowest confidence last)
    current.memories = current.memories.slice(0, -1);
    estimate = estimateStructuredTokens(current);
  }

  // Step 5: Truncate skill bodies
  if (estimate > tokenBudget && current.skills.length > 0) {
    truncated = true;
    current.skills = current.skills.map((s) => ({
      ...s,
      body: compressBody(s.body, 80),
      triggerConditions: s.triggerConditions.slice(0, 1),
    }));
    estimate = estimateStructuredTokens(current);
  }

  // Step 5b: Drop skills if still over
  while (estimate > tokenBudget && current.skills.length > 0) {
    truncated = true;
    current.skills = current.skills.slice(0, -1);
    estimate = estimateStructuredTokens(current);
  }

  // Step 6: Drop entities if still over
  while (estimate > tokenBudget && current.entities.length > 0) {
    truncated = true;
    current.entities = current.entities.slice(0, -1);
    estimate = estimateStructuredTokens(current);
  }

  // Step 8: Drop projects if still over
  while (estimate > tokenBudget && current.projects.length > 0) {
    truncated = true;
    current.projects = current.projects.slice(0, -1);
    estimate = estimateStructuredTokens(current);
  }

  // Step 9: Remove stats if still over (but NEVER remove profile/identity)
  if (estimate > tokenBudget && current.stats) {
    truncated = true;
    current.stats = undefined;
    estimate = estimateStructuredTokens(current);
  }

  // Identity (profile) is NEVER dropped — it's always included
  return { structured: current, tokenEstimate: estimate, truncated };
}

function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}
