import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

/**
 * OpenAPI 3.1 specification endpoint.
 *
 * GET /v1/openapi.json — public, no auth required.
 * Returns the OpenAPI spec so ChatGPT Actions, function-calling AIs,
 * and other tools can discover OneBrain API capabilities.
 */
export async function openapiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/openapi.json', async (_request, reply) => {
    const baseUrl = process.env['API_PUBLIC_URL'] ?? `http://${config.api.host}:${config.api.port}`;

    const spec = buildSpec(baseUrl);

    return reply
      .status(200)
      .header('Content-Type', 'application/json')
      .header('Cache-Control', 'public, max-age=3600')
      .send(spec);
  });
}

function buildSpec(serverUrl: string): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'OneBrain API',
      version: '1.0.0',
      description:
        'OneBrain is your personal AI memory layer. ' +
        'Connect any AI tool to your brain context — preferences, ' +
        'knowledge, projects, and decisions — via a single API.',
    },
    servers: [{ url: serverUrl }],
    tags: [
      {
        name: 'registration',
        description:
          'Register as an agent to get an API key. ' +
          'No auth required — use self-registration or an invite code.',
      },
      {
        name: 'connect',
        description: 'Universal AI integration endpoint',
      },
      {
        name: 'context',
        description: 'Optimized LLM context retrieval',
      },
      {
        name: 'memory',
        description: 'Create, list, and extract memories',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'API key in the format: ApiKey ob_PREFIX_SECRET',
        },
      },
      schemas: {
        MemoryType: {
          type: 'string',
          enum: ['fact', 'preference', 'decision', 'goal', 'experience', 'skill'],
        },
        MemoryStatus: {
          type: 'string',
          enum: ['active', 'archived', 'deleted'],
        },
        Memory: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { $ref: '#/components/schemas/MemoryType' },
            title: { type: 'string' },
            body: { type: 'string' },
            status: { $ref: '#/components/schemas/MemoryStatus' },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['id', 'type', 'title', 'body', 'status'],
        },
        CreateMemoryBody: {
          type: 'object',
          properties: {
            type: { $ref: '#/components/schemas/MemoryType' },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 500,
            },
            body: {
              type: 'string',
              minLength: 1,
              maxLength: 10000,
            },
          },
          required: ['type', 'title', 'body'],
        },
        ApiError: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: {
              type: 'array',
              items: { type: 'object' },
            },
          },
          required: ['code', 'message'],
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { $ref: '#/components/schemas/ApiError' },
            meta: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            cursor: {
              type: 'string',
              nullable: true,
            },
            hasMore: { type: 'boolean' },
            total: { type: 'integer' },
          },
        },
        RegisterAgentBody: {
          type: 'object',
          description:
            'Self-register as an agent. No auth required. ' +
            'Returns a read-only API key (scopes: connect.read, brain.read, entity.read).',
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              pattern: '^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,98}[a-zA-Z0-9]$',
              description: 'Unique agent name (letters, numbers, spaces, dots, hyphens)',
            },
            description: {
              type: 'string',
              minLength: 10,
              maxLength: 1000,
              description: 'What does your agent do?',
            },
            contactUrl: {
              type: 'string',
              format: 'uri',
              maxLength: 500,
              description: 'Optional contact or homepage URL',
            },
          },
          required: ['name', 'description'],
        },
        InviteRegisterBody: {
          type: 'object',
          description:
            'Register via invite code. No auth required. ' + 'Returns a read-only API key.',
          properties: {
            code: {
              type: 'string',
              minLength: 4,
              maxLength: 50,
              description: 'Invite code (from invite URL or admin)',
            },
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              pattern: '^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,98}[a-zA-Z0-9]$',
              description: 'Unique agent name',
            },
            description: {
              type: 'string',
              minLength: 10,
              maxLength: 1000,
              description: 'What does your agent do?',
            },
            contactUrl: {
              type: 'string',
              format: 'uri',
              maxLength: 500,
              description: 'Optional contact URL',
            },
          },
          required: ['code', 'name', 'description'],
        },
        AgentRegistrationResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                agentId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Your agent account ID',
                },
                name: { type: 'string' },
                apiKey: {
                  type: 'object',
                  properties: {
                    prefix: {
                      type: 'string',
                      description: 'Key prefix for identification (safe to log)',
                    },
                    fullKey: {
                      type: 'string',
                      description:
                        'Full API key (format: ob_PREFIX_SECRET). ' +
                        'Save immediately — shown only once!',
                    },
                    scopes: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Granted scopes (read-only by default)',
                    },
                    expiresAt: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                      description: 'Key expiration (90 days from creation)',
                    },
                  },
                },
                trustLevel: {
                  type: 'string',
                  description: 'Trust level (review = pending admin approval for upgrades)',
                },
                message: { type: 'string' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
              },
            },
          },
        },
        InviteInfoResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                label: { type: 'string' },
                description: { type: 'string', nullable: true },
                remainingUses: {
                  type: 'integer',
                  nullable: true,
                  description: 'null = unlimited',
                },
                expiresAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
    paths: {
      // ── Registration (no auth) ──────────────────
      '/v1/agents/register': {
        post: {
          operationId: 'selfRegisterAgent',
          summary: 'Self-register as an agent (no auth required)',
          description:
            'Creates a new agent account and returns a read-only API key. ' +
            'No authentication needed. Rate limited to 5 requests/hour per IP. ' +
            'The returned API key grants scopes: connect.read, brain.read, entity.read. ' +
            'Key expires after 90 days. Contact an admin to upgrade scopes.',
          tags: ['registration'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RegisterAgentBody',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Agent created. Save the fullKey immediately — it is only shown once.',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AgentRegistrationResponse',
                  },
                },
              },
            },
            '400': {
              description: 'Validation error (name format, description too short, etc.)',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '409': {
              description: 'Agent name already taken',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded (5/hour per IP)',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/v1/invite/{code}/info': {
        get: {
          operationId: 'getInviteInfo',
          summary: 'Validate an invite code (no auth required)',
          description:
            'Returns info about an invite code — label, description, remaining uses. ' +
            'Use this to check if a code is valid before registering.',
          tags: ['registration'],
          parameters: [
            {
              name: 'code',
              in: 'path',
              required: true,
              description: 'The invite code to validate',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Valid invite code',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/InviteInfoResponse',
                  },
                },
              },
            },
            '403': {
              description: 'Invite registration is globally disabled',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '404': {
              description: 'Invalid or inactive invite code',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '410': {
              description: 'Invite expired or used up',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/v1/invite/register': {
        post: {
          operationId: 'registerViaInvite',
          summary: 'Register agent via invite code (no auth required)',
          description:
            'Creates an agent account using an invite code. ' +
            'Returns a read-only API key. Rate limited to 5/hour per IP. ' +
            'Invite codes can be obtained from OneBrain admins or via /invite/{code} URLs.',
          tags: ['registration'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InviteRegisterBody',
                },
              },
            },
          },
          responses: {
            '201': {
              description:
                'Agent registered. Save the fullKey immediately — it is only shown once.',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AgentRegistrationResponse',
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '403': {
              description: 'Invite registration is globally disabled',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '404': {
              description: 'Invalid or inactive invite code',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '409': {
              description: 'Agent name already taken',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '410': {
              description: 'Invite expired or used up',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      // ── Connect (API key in URL) ────────────────
      '/v1/connect/{apiKey}': {
        get: {
          operationId: 'getConnectContext',
          summary: 'Get user brain context as a system prompt',
          description:
            "Returns the user's full brain context formatted as a " +
            'system prompt that any AI tool can consume. ' +
            'The API key is passed in the URL path. ' +
            'Requires connect.read scope.',
          tags: ['connect'],
          parameters: [
            {
              name: 'apiKey',
              in: 'path',
              required: true,
              description:
                'OneBrain API key with connect.read scope ' + '(format: ob_PREFIX_SECRET)',
              schema: { type: 'string' },
            },
            {
              name: 'Accept',
              in: 'header',
              required: false,
              description:
                'Set to application/json for JSON envelope, ' + 'otherwise returns plain text',
              schema: {
                type: 'string',
                default: 'text/plain',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Brain context as system prompt',
              content: {
                'text/plain': {
                  schema: { type: 'string' },
                },
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          systemPrompt: { type: 'string' },
                          meta: {
                            type: 'object',
                            properties: {
                              tokenEstimate: {
                                type: 'integer',
                              },
                              scope: { type: 'string' },
                              generatedAt: {
                                type: 'string',
                                format: 'date-time',
                              },
                            },
                          },
                        },
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          requestId: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Invalid or missing API key',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            '403': {
              description: 'API key missing connect.read scope',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/v1/connect/{apiKey}/memories': {
        post: {
          operationId: 'batchWriteMemories',
          summary: 'Batch write up to 10 memories',
          description:
            'Saves 1-10 memories in a single request. More token-efficient ' +
            'than individual writes. Duplicates detected per item. ' +
            'Requires connect.write scope.',
          tags: ['connect'],
          parameters: [
            {
              name: 'apiKey',
              in: 'path',
              required: true,
              description: 'OneBrain API key with connect.write scope',
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 10,
                  items: {
                    $ref: '#/components/schemas/CreateMemoryBody',
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Batch results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                status: {
                                  type: 'string',
                                  enum: ['created', 'duplicate'],
                                },
                                id: { type: 'string', format: 'uuid' },
                                title: { type: 'string' },
                              },
                            },
                          },
                          created: { type: 'integer' },
                          duplicates: { type: 'integer' },
                        },
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          requestId: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            '401': {
              description: 'Invalid or missing API key',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            '403': {
              description: 'Missing connect.write scope',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/v1/context/{scope}': {
        get: {
          operationId: 'getOptimizedContext',
          summary: 'Get optimized LLM context by scope',
          description:
            "Returns the user's brain context optimized for a " +
            'specific use case. Requires brain.read scope via ' +
            'ApiKey header.',
          tags: ['context'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: 'scope',
              in: 'path',
              required: true,
              description: 'Context scope level',
              schema: {
                type: 'string',
                enum: ['brief', 'assistant', 'project', 'deep'],
              },
            },
          ],
          responses: {
            '200': {
              description: 'Optimized context for the scope',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          formatted: { type: 'string' },
                          meta: {
                            type: 'object',
                            properties: {
                              tokenEstimate: {
                                type: 'integer',
                              },
                              truncated: {
                                type: 'boolean',
                              },
                            },
                          },
                        },
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          requestId: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                'text/plain': {
                  schema: { type: 'string' },
                },
              },
            },
            '400': {
              description: 'Invalid scope value',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/v1/memory': {
        get: {
          operationId: 'listMemories',
          summary: 'List memories',
          description:
            "Returns a paginated list of the user's memories. " +
            'Requires brain.read scope via ApiKey header.',
          tags: ['memory'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: 'cursor',
              in: 'query',
              required: false,
              description: 'Pagination cursor from previous response',
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Items per page (default 20, max 100)',
              schema: {
                type: 'integer',
                default: 20,
                minimum: 1,
                maximum: 100,
              },
            },
            {
              name: 'type',
              in: 'query',
              required: false,
              description: 'Filter by memory type',
              schema: {
                $ref: '#/components/schemas/MemoryType',
              },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Filter by memory status',
              schema: {
                $ref: '#/components/schemas/MemoryStatus',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Paginated list of memories',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Memory',
                        },
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          requestId: { type: 'string' },
                          pagination: {
                            $ref: '#/components/schemas/PaginationMeta',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createMemory',
          summary: 'Create a memory',
          description:
            "Creates a new memory item in the user's brain. " +
            'Requires brain.write scope via ApiKey header.',
          tags: ['memory'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateMemoryBody',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Memory created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        $ref: '#/components/schemas/Memory',
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          requestId: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/v1/memory/extract': {
        post: {
          operationId: 'extractMemory',
          summary: 'Extract and create a memory from AI',
          description:
            'Extracts structured memory from AI-generated content ' +
            'and stores it. Requires memory.extract.write scope ' +
            'via ApiKey header.',
          tags: ['memory'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateMemoryBody',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Memory extracted and created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        $ref: '#/components/schemas/Memory',
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          requestId: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
