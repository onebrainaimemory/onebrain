import type { ContextStructured } from './types.js';

/**
 * Format context as a human/LLM-readable plain text string.
 * No IDs, no timestamps — only high-signal content.
 */
export function formatAsText(structured: ContextStructured): string {
  const sections: string[] = [];

  // Profile
  if (structured.profile) {
    sections.push('## User Profile');
    if (structured.profile.summary) {
      sections.push(structured.profile.summary);
    }
    const traits = Object.entries(structured.profile.traits);
    if (traits.length > 0) {
      sections.push(`Traits: ${traits.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
    const prefs = Object.entries(structured.profile.preferences);
    if (prefs.length > 0) {
      sections.push(`Preferences: ${prefs.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
    sections.push('');
  }

  // Memories
  if (structured.memories.length > 0) {
    sections.push('## Known Facts & Memories');
    for (const mem of structured.memories) {
      sections.push(`- [${mem.type}] ${mem.title}: ${mem.body}`);
    }
    sections.push('');
  }

  // Entities
  if (structured.entities.length > 0) {
    sections.push('## Key Entities');
    for (const ent of structured.entities) {
      const desc = ent.description ? ` — ${ent.description}` : '';
      sections.push(`- ${ent.name} (${ent.type})${desc}`);
    }
    sections.push('');
  }

  // Projects
  if (structured.projects.length > 0) {
    sections.push('## Projects');
    for (const proj of structured.projects) {
      const desc = proj.description ? ` — ${proj.description}` : '';
      sections.push(`- ${proj.name} [${proj.status}]${desc}`);
    }
    sections.push('');
  }

  // Skills (SkillForge)
  if (structured.skills.length > 0) {
    sections.push('## Learned Skills');
    for (const skill of structured.skills) {
      const triggers =
        skill.triggerConditions.length > 0
          ? ` (triggers: ${skill.triggerConditions.join(', ')})`
          : '';
      sections.push(`- ${skill.title}: ${skill.body}${triggers}`);
    }
    sections.push('');
  }

  // Stats
  if (structured.stats) {
    sections.push('## Stats');
    sections.push(
      `Memories: ${structured.stats.totalMemories}, ` +
        `Entities: ${structured.stats.totalEntities}, ` +
        `Projects: ${structured.stats.totalProjects}` +
        (structured.stats.latestVersion ? `, Version: ${structured.stats.latestVersion}` : ''),
    );
  }

  return sections.join('\n');
}

/**
 * Format context as a minified JSON string for programmatic consumption.
 */
export function formatAsJson(structured: ContextStructured): string {
  return JSON.stringify(structured);
}
