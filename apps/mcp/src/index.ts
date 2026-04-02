#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getUserContext,
  searchMemory,
  writeMemory,
  writeMemoryBatch,
  upsertEntity,
  getProjectContext,
  deepSearch,
  listSkills,
  recordSkillFeedback,
  getBriefingConfig,
  listBriefings,
  ApiClientError,
} from './lib/api-client.js';

const API_KEY = process.env['ONEBRAIN_API_KEY'] ?? '';

function formatError(err: unknown): string {
  if (err instanceof ApiClientError) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

const server = new McpServer({
  name: 'onebrain',
  version: '0.9.0',
});

// ─────────────────────────────────────────────
// Tool: get_user_context
// ─────────────────────────────────────────────

server.tool(
  'get_user_context',
  'Get the full brain context: profile, recent memories, top entities, active projects, and stats.',
  {},
  async () => {
    try {
      const context = await getUserContext(API_KEY);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(context, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: search_memory
// ─────────────────────────────────────────────

server.tool(
  'search_memory',
  'Search and filter memory items by type and status.',
  {
    type: z
      .enum(['fact', 'preference', 'decision', 'goal', 'experience', 'skill'])
      .optional()
      .describe('Filter by memory type'),
    status: z
      .enum(['active', 'candidate', 'archived', 'conflicted'])
      .optional()
      .describe('Filter by memory status'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Number of results (default 20, max 100)'),
  },
  async (params) => {
    try {
      const result = await searchMemory(API_KEY, params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: write_memory
// ─────────────────────────────────────────────

server.tool(
  'write_memory',
  'Create a new memory item via extraction. Creates a candidate memory and source event.',
  {
    type: z
      .enum(['fact', 'preference', 'decision', 'goal', 'experience', 'skill'])
      .describe('Type of memory'),
    title: z.string().min(1).max(500).describe('Short title for the memory'),
    body: z.string().min(1).describe('Full memory content'),
    sourceType: z
      .enum(['user_input', 'system_inference', 'ai_extraction', 'user_confirmed'])
      .optional()
      .describe('How this memory was captured (default: ai_extraction)'),
  },
  async (params) => {
    try {
      const result = await writeMemory(API_KEY, {
        type: params.type,
        title: params.title,
        body: params.body,
        sourceType: params.sourceType ?? 'ai_extraction',
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: write_memory_batch
// ─────────────────────────────────────────────

server.tool(
  'write_memory_batch',
  'Create multiple memories at once (1-10). More token-efficient than individual calls. Duplicates auto-detected.',
  {
    items: z
      .array(
        z.object({
          type: z.enum(['fact', 'preference', 'decision', 'goal', 'experience', 'skill']),
          title: z.string().min(1).max(500),
          body: z.string().min(1),
          sourceType: z
            .enum(['user_input', 'system_inference', 'ai_extraction', 'user_confirmed'])
            .optional(),
        }),
      )
      .min(1)
      .max(10)
      .describe('Array of memories to create'),
  },
  async (params) => {
    try {
      const result = await writeMemoryBatch(
        API_KEY,
        params.items.map((item) => ({
          ...item,
          sourceType: item.sourceType ?? 'ai_extraction',
        })),
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: upsert_entity
// ─────────────────────────────────────────────

server.tool(
  'upsert_entity',
  'Create or update an entity (person, place, organization, etc.).',
  {
    name: z.string().min(1).max(255).describe('Entity name'),
    type: z.string().min(1).max(100).describe('Entity type (person, place, org, etc.)'),
    description: z.string().optional().describe('Entity description'),
  },
  async (params) => {
    try {
      const result = await upsertEntity(API_KEY, params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: get_project_context
// ─────────────────────────────────────────────

server.tool(
  'get_project_context',
  'Get project details or list active projects.',
  {
    projectId: z
      .string()
      .uuid()
      .optional()
      .describe('Specific project ID, or omit for all active projects'),
  },
  async (params) => {
    try {
      const result = await getProjectContext(API_KEY, params.projectId);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: deep_search (DeepRecall)
// ─────────────────────────────────────────────

server.tool(
  'deep_search',
  'Semantic search across memories using DeepRecall. Supports keyword, vector, or hybrid mode. Returns ranked results with relevance scores.',
  {
    query: z.string().min(1).describe('Natural language search query'),
    mode: z
      .enum(['keyword', 'vector', 'hybrid'])
      .optional()
      .describe(
        'Search mode (default: hybrid). Keyword=Dice coefficient, Vector=cosine similarity, Hybrid=fused',
      ),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('Number of results to return (default 10, max 50)'),
    alpha: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Hybrid fusion weight (0=keyword only, 1=vector only, default 0.6)'),
  },
  async (params) => {
    try {
      const result = await deepSearch(API_KEY, params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: list_skills (SkillForge)
// ─────────────────────────────────────────────

server.tool(
  'list_skills',
  'List learned skills from SkillForge. Skills are patterns the brain has extracted from memory and usage. Requires Pro or Team plan.',
  {
    status: z
      .enum(['candidate', 'active', 'archived', 'dismissed'])
      .optional()
      .describe('Filter by skill status (default: all)'),
    minConfidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Minimum confidence threshold (0-1)'),
    sortBy: z
      .enum(['confidence', 'usage', 'recency'])
      .optional()
      .describe('Sort order (default: confidence)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Number of results (default 20, max 100)'),
  },
  async (params) => {
    try {
      const result = await listSkills(API_KEY, params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: skill_feedback (SkillForge)
// ─────────────────────────────────────────────

server.tool(
  'skill_feedback',
  'Record feedback on a skill — whether it was applied, referenced, or dismissed. This improves skill confidence scoring over time.',
  {
    skillId: z.string().describe('The skill ID to give feedback on'),
    eventType: z
      .enum(['applied', 'referenced', 'dismissed'])
      .describe(
        'What happened: applied (+confidence), referenced (+minor), dismissed (-confidence)',
      ),
    context: z.record(z.unknown()).optional().describe('Optional metadata about the usage context'),
  },
  async (params) => {
    try {
      const result = await recordSkillFeedback(
        API_KEY,
        params.skillId,
        params.eventType,
        params.context as Record<string, unknown> | undefined,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: get_briefing_config (BrainPulse)
// ─────────────────────────────────────────────

server.tool(
  'get_briefing_config',
  'Get the BrainPulse briefing configuration: enabled status, timezone, quiet hours, and delivery channels.',
  {},
  async () => {
    try {
      const result = await getBriefingConfig(API_KEY);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Tool: list_briefings (BrainPulse)
// ─────────────────────────────────────────────

server.tool(
  'list_briefings',
  'List recent BrainPulse briefings. Filter by type (morning, evening, weekly_health) or status (delivered, pending, failed).',
  {
    type: z
      .enum(['morning', 'midday', 'evening', 'event_triggered', 'weekly_health'])
      .optional()
      .describe('Filter by briefing type'),
    status: z
      .enum(['pending', 'generating', 'ready', 'delivered', 'failed'])
      .optional()
      .describe('Filter by briefing status'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Number of results (default 20, max 100)'),
  },
  async (params) => {
    try {
      const result = await listBriefings(API_KEY, params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: formatError(err) }],
        isError: true,
      };
    }
  },
);

// ─────────────────────────────────────────────
// Start server (stdio transport)
// ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
