import type {
  ContextScope,
  RawMemoryItem,
  RawEntity,
  RawProject,
  ProfileSummary,
  ContextStats,
  ContextMemory,
  ContextEntity,
  ContextProject,
  ContextSkill,
  ContextStructured,
} from './types.js';
import { SCOPE_LIMITS } from './types.js';
import { scoreMemory, scoreEntity, scoreProject } from './relevance.js';

/**
 * Filter and rank raw data according to scope limits.
 * Returns a ContextStructured with redacted fields (no IDs, no timestamps).
 */
export function filterByScope(
  scope: ContextScope,
  memories: RawMemoryItem[],
  entities: RawEntity[],
  projects: RawProject[],
  profile: ProfileSummary,
  stats: ContextStats,
  skills: ContextSkill[] = [],
): ContextStructured {
  const limits = SCOPE_LIMITS[scope];

  // Score and sort memories (highest first)
  const scoredMemories = memories
    .map(scoreMemory)
    .sort((a, b) => b.score - a.score)
    .slice(0, limits.memories);

  // Score and sort entities
  const scoredEntities = entities
    .map(scoreEntity)
    .sort((a, b) => b.score - a.score)
    .slice(0, limits.entities);

  // Score and sort projects
  const scoredProjects = projects
    .map(scoreProject)
    .sort((a, b) => b.score - a.score)
    .slice(0, limits.projects);

  // Skills: already scored by SkillForge, just slice to limit
  const contextSkills = skills
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, limits.skills);

  // Redact: strip IDs and timestamps from output
  const contextMemories: ContextMemory[] = scoredMemories.map((s) => ({
    type: s.item.type,
    title: s.item.title,
    body: s.item.body,
    confidence: s.item.confidence,
  }));

  const contextEntities: ContextEntity[] = scoredEntities.map((s) => ({
    name: s.item.name,
    type: s.item.type,
    description: s.item.description,
    linkCount: s.item.linkCount,
  }));

  const contextProjects: ContextProject[] = scoredProjects.map((s) => ({
    name: s.item.name,
    description: s.item.description,
    status: s.item.status,
  }));

  return {
    ...(limits.includeProfile && {
      profile: {
        summary: profile.summary,
        traits: profile.traits,
        preferences: profile.preferences,
      },
    }),
    memories: contextMemories,
    entities: contextEntities,
    projects: contextProjects,
    skills: contextSkills,
    ...(limits.includeStats && { stats }),
  };
}
