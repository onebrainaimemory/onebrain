import type { FastifyInstance } from 'fastify';

/**
 * ChatGPT Actions plugin manifest and OpenAPI spec.
 *
 * GET /.well-known/ai-plugin.json       — plugin manifest
 * GET /.well-known/openapi-actions.json  — slimmed-down OpenAPI spec
 *
 * Both endpoints are public (no auth required) and cached for 1 hour.
 */
export async function aiPluginRoutes(app: FastifyInstance): Promise<void> {
  const baseUrl = process.env['API_PUBLIC_URL'] ?? 'https://api.onebrain.rocks';

  app.get('/.well-known/ai-plugin.json', async (_request, reply) => {
    const manifest = buildManifest(baseUrl);

    return reply
      .status(200)
      .header('Content-Type', 'application/json')
      .header('Cache-Control', 'public, max-age=3600')
      .send(manifest);
  });

  app.get('/.well-known/openapi-actions.json', async (_request, reply) => {
    const spec = buildActionsSpec(baseUrl);

    return reply
      .status(200)
      .header('Content-Type', 'application/json')
      .header('Cache-Control', 'public, max-age=3600')
      .send(spec);
  });
}

function buildManifest(baseUrl: string): Record<string, unknown> {
  return {
    schema_version: 'v1',
    name_for_human: 'OneBrain',
    name_for_model: 'onebrain',
    description_for_human:
      'Connect ChatGPT to your personal AI memory layer. ' +
      'OneBrain remembers your preferences, projects, ' +
      'decisions, and knowledge across every AI tool.',
    description_for_model:
      "OneBrain is the user's personal memory layer. " +
      'If you do NOT have an API key yet, call selfRegisterAgent ' +
      'to create an agent account and get a read-only key. ' +
      'At the START of every conversation, call readContext ' +
      "to load the user's brain context (preferences, projects, " +
      'knowledge, decisions). Use this context to personalize ' +
      'your responses. When you learn NEW information about the ' +
      'user during the conversation, call writeMemory to save ' +
      'it so all their AI tools stay in sync. Use searchMemory ' +
      'to retrieve context scoped for a specific use case.',
    auth: {
      type: 'none',
    },
    api: {
      type: 'openapi',
      url: `${baseUrl}/.well-known/openapi-actions.json`,
    },
    logo_url: `${baseUrl}/logo.png`,
    contact_email: 'support@onebrain.rocks',
    legal_info_url: `${baseUrl}/legal/privacy`,
  };
}

function buildActionsSpec(baseUrl: string): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'OneBrain Actions',
      version: '1.0.0',
      description:
        'Slimmed-down OpenAPI spec for ChatGPT Actions. ' +
        'Provides operations: read brain context, ' +
        'write memories (single or batch), and search by scope.',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/v1/agents/register': {
        post: {
          operationId: 'selfRegisterAgent',
          summary: 'Self-register as an agent to get an API key (no auth needed)',
          description:
            'Creates a new agent account and returns a read-only API key. ' +
            'No authentication required. The key grants connect.read, brain.read, ' +
            'entity.read scopes and expires in 90 days. ' +
            'IMPORTANT: Save the fullKey from the response — it is shown only once.',
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
              description: 'Agent created — save the API key immediately',
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
            '409': {
              description: 'Agent name already taken',
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
      '/v1/connect/{apiKey}': {
        get: {
          operationId: 'readContext',
          summary: "Read the user's brain context as a system prompt",
          description:
            "Returns the user's full brain context — preferences, " +
            'projects, knowledge, and decisions — formatted as ' +
            'a plain-text system prompt. Call this at the START ' +
            'of every conversation. The API key is embedded in ' +
            'the URL path (no auth header needed).',
          parameters: [
            {
              name: 'apiKey',
              in: 'path',
              required: true,
              description:
                'OneBrain API key with connect.read scope ' + '(format: ob_PREFIX_SECRET)',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Brain context as plain-text system prompt',
              content: {
                'text/plain': {
                  schema: { type: 'string' },
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
          },
        },
      },
      '/v1/connect/{apiKey}/memory': {
        post: {
          operationId: 'writeMemory',
          summary: "Write a new memory to the user's brain",
          description:
            'Saves a new piece of information the AI learned ' +
            'about the user. Call this whenever you discover ' +
            'new preferences, decisions, goals, facts, skills, ' +
            'or experiences. Duplicates are automatically ' +
            'detected and skipped.',
          parameters: [
            {
              name: 'apiKey',
              in: 'path',
              required: true,
              description:
                'OneBrain API key with connect.write scope ' + '(format: ob_PREFIX_SECRET)',
              schema: { type: 'string' },
            },
          ],
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
                    $ref: '#/components/schemas/MemoryResponse',
                  },
                },
              },
            },
            '200': {
              description: 'Duplicate detected — existing memory returned',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/MemoryResponse',
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
              description: 'API key missing connect.write scope',
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
          operationId: 'writeMemoryBatch',
          summary: 'Batch write multiple memories at once',
          description:
            'Saves 1-10 memories in a single request. More efficient ' +
            'than calling writeMemory multiple times. Duplicates are ' +
            'automatically detected and skipped per item.',
          parameters: [
            {
              name: 'apiKey',
              in: 'path',
              required: true,
              description:
                'OneBrain API key with connect.write scope ' + '(format: ob_PREFIX_SECRET)',
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
              description: 'Batch results with per-item status',
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
                                id: { type: 'string' },
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
              description: 'API key missing connect.write scope',
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
          operationId: 'searchMemory',
          summary: 'Get optimized context by scope',
          description:
            "Returns the user's brain context optimized for a " +
            'specific use case. Scopes: brief (short summary), ' +
            'assistant (conversational), project (project-focused), ' +
            'deep (full context). Requires ApiKey header.',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: 'scope',
              in: 'path',
              required: true,
              description: 'Context scope: brief, assistant, project, or deep',
              schema: {
                type: 'string',
                enum: ['brief', 'assistant', 'project', 'deep'],
              },
            },
          ],
          responses: {
            '200': {
              description: 'Optimized context for the requested scope',
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
    },
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
        RegisterAgentBody: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
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
              description: 'Optional contact or homepage URL',
            },
          },
          required: ['name', 'description'],
        },
        AgentRegistrationResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                agentId: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                apiKey: {
                  type: 'object',
                  properties: {
                    prefix: { type: 'string' },
                    fullKey: {
                      type: 'string',
                      description: 'Full API key — save immediately, shown only once',
                    },
                    scopes: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    expiresAt: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                    },
                  },
                },
                trustLevel: { type: 'string' },
                message: { type: 'string' },
              },
            },
            meta: {
              type: 'object',
              properties: { requestId: { type: 'string' } },
            },
          },
        },
        MemoryType: {
          type: 'string',
          enum: ['fact', 'preference', 'decision', 'goal', 'experience', 'skill'],
        },
        CreateMemoryBody: {
          type: 'object',
          properties: {
            type: {
              $ref: '#/components/schemas/MemoryType',
            },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 500,
              description: 'Short summary of the memory',
            },
            body: {
              type: 'string',
              minLength: 1,
              maxLength: 10000,
              description: 'Full detail of the memory',
            },
          },
          required: ['type', 'title', 'body'],
        },
        MemoryResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                type: {
                  $ref: '#/components/schemas/MemoryType',
                },
                title: { type: 'string' },
                body: { type: 'string' },
                status: { type: 'string' },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
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
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
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
  };
}
