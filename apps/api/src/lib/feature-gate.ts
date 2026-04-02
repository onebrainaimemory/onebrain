import { getActivePlan, isFeatureEnabled } from '../services/plan.service.js';

/**
 * Check if DeepRecall (hybrid vector + keyword search) is available for a user.
 * Requires: embedding API key configured AND user plan has deep_recall enabled.
 */
export async function canUseDeepRecall(userId: string): Promise<boolean> {
  if (!isEmbeddingApiConfigured()) return false;

  const plan = await getActivePlan(userId);
  return isFeatureEnabled(plan.features, 'deep_recall');
}

/**
 * Check if SkillForge (self-learning loop) is available for a user.
 */
export async function canUseSkillForge(userId: string): Promise<boolean> {
  const plan = await getActivePlan(userId);
  return isFeatureEnabled(plan.features, 'skill_forge');
}

/**
 * Check if BrainPulse (proactive briefings) is available for a user.
 * Returns the tier: 'weekly_email' | 'full' | false
 */
export async function getBrainPulseTier(userId: string): Promise<'weekly_email' | 'full' | false> {
  const plan = await getActivePlan(userId);
  const feature = plan.features.find((f) => f.key === 'brain_pulse');
  if (!feature || feature.value === 'false') return false;
  return feature.value as 'weekly_email' | 'full';
}

/**
 * Check if any embedding API key is configured (OpenRouter or OpenAI).
 */
export function isEmbeddingApiConfigured(): boolean {
  return !!(process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY']);
}
