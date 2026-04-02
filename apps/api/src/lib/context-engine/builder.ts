import type {
  ContextScope,
  RawMemoryItem,
  RawEntity,
  RawProject,
  ProfileSummary,
  ContextStats,
  ContextSkill,
  ContextResult,
} from './types.js';
import { SCOPE_TOKEN_BUDGETS } from './types.js';
import { filterByScope } from './filter.js';
import { compressToTokenBudget, estimateTokens } from './compress.js';
import { formatAsText } from './format.js';

/**
 * Build optimized context for an LLM.
 *
 * Pipeline (deterministic, explainable):
 * 1. Score all items by relevance
 * 2. Filter by scope limits
 * 3. Redact sensitive fields (IDs, timestamps)
 * 4. Compress to fit token budget (identity never dropped)
 * 5. Format as LLM-optimized text
 * 6. Attach metadata with token tracking
 */
export function buildContext(
  scope: ContextScope,
  memories: RawMemoryItem[],
  entities: RawEntity[],
  projects: RawProject[],
  profile: ProfileSummary,
  stats: ContextStats,
  skills: ContextSkill[] = [],
): ContextResult {
  const tokenBudget = SCOPE_TOKEN_BUDGETS[scope];

  // Steps 1-3: Score, filter, redact
  const filtered = filterByScope(scope, memories, entities, projects, profile, stats, skills);

  // Step 4: Compress to token budget (identity is never trimmed)
  const { structured, tokenEstimate, truncated } = compressToTokenBudget(filtered, tokenBudget);

  // Step 5: Format
  const formatted = formatAsText(structured);

  // Step 6: Token tracking metadata
  const formattedTokens = estimateTokens(formatted);
  const tokensUsed = Math.max(tokenEstimate, formattedTokens);

  return {
    scope,
    formatted,
    structured,
    meta: {
      scope,
      tokenEstimate: tokensUsed,
      tokensUsed,
      memoriesIncluded: structured.memories.length,
      entitiesIncluded: structured.entities.length,
      projectsIncluded: structured.projects.length,
      truncated,
      identityIncluded: structured.profile !== undefined,
    },
  };
}
