import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  WebStandardStreamableHTTPServerTransport 
} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClioClient, ClioClient } from '@/lib/clio-client-production';
import { MockClioClient } from '@/lib/clio-client-mock';
import { safeLog } from '@/lib/pii-redaction';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  MatterIntelligenceBriefSchema,
  EthicalConflictCheckSchema,
  AuditUnbilledActivitiesSchema,
} from '@/lib/tool-schemas';
import { getMatterIntelligenceBrief } from '@/lib/tools/matter-intelligence-brief';
import { performEthicalConflictCheck } from '@/lib/tools/ethical-conflict-check';
import { auditUnbilledActivities } from '@/lib/tools/audit-unbilled-activities';

// Initialize server and transport (singleton pattern for serverless)
let serverInstance: Server | null = null;
let transportInstance: WebStandardStreamableHTTPServerTransport | null = null;

// Store current HTTP request for tool handlers (set per-request)
let currentHttpRequest: Request | undefined = undefined;

function getServer(): Server {
  if (!serverInstance) {
    serverInstance = new Server(
      {
        name: 'Clio-Agent-Bridge',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Register tools list handler
    serverInstance.setRequestHandler(ListToolsRequestSchema, async (request) => {
      safeLog('info', 'ListTools request received');
      
      const tools = [
        {
          name: 'get_matter_intelligence_brief',
          description: 'Get a comprehensive intelligence brief for a legal matter. Aggregates matter details, recent file notes (last 5), and upcoming calendar entries. Returns a structured Markdown brief with Recent Activity, Pending Tasks, and Case Metadata including Custom Fields.',
          inputSchema: {
            type: 'object',
            properties: {
              matter_id: {
                type: 'string',
                description: 'The ID of the matter to retrieve intelligence for',
              },
            },
            required: ['matter_id'],
          },
        },
        {
          name: 'perform_ethical_conflict_check',
          description: 'Perform an ethical conflict check by searching contacts and matters simultaneously. Specifically flags matches found in Related Contacts or Custom Fields (e.g., Opposing Counsel). Returns a JSON report categorized by Direct Matches, Related Party Matches, and Closed Matter History.',
          inputSchema: {
            type: 'object',
            properties: {
              search_query: {
                type: 'string',
                description: 'Name of person or entity to search for',
              },
            },
            required: ['search_query'],
          },
        },
        {
          name: 'audit_unbilled_activities',
          description: 'Audit all unbilled activities for a matter. Returns a list with flags for Vague Descriptions (entries under 15 characters or matching vague patterns) that might be rejected by insurance.',
          inputSchema: {
            type: 'object',
            properties: {
              matter_id: {
                type: 'string',
                description: 'The ID of the matter to audit',
              },
            },
            required: ['matter_id'],
          },
        },
      ];

      safeLog('info', `Returning ${tools.length} tools`);
      return { tools };
    });

    // Register resources list handler
    serverInstance.setRequestHandler(ListResourcesRequestSchema, async (request) => {
      safeLog('info', 'ListResources request received');
      
      const resources = [
        {
          uri: 'clio://api-documentation',
          name: 'Clio API Documentation',
          description: 'Official Clio API v4 documentation for reference',
          mimeType: 'text/plain',
        },
      ];

      return { resources };
    });

    // Register resource read handler
    serverInstance.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      safeLog('info', `ReadResource request for: ${uri}`);

      if (uri === 'clio://api-documentation') {
        return {
          contents: [
            {
              uri: 'clio://api-documentation',
              mimeType: 'text/plain',
              text: 'Clio API v4 Documentation:\n\n' +
                    'Base URL: https://app.clio.com/api/v4\n\n' +
                    'Key Endpoints:\n' +
                    '- GET /matters - List matters\n' +
                    '- GET /matters/{id} - Get matter details\n' +
                    '- GET /matters/{id}/file_notes - Get file notes\n' +
                    '- GET /matters/{id}/calendar_entries - Get calendar entries\n' +
                    '- GET /matters/{id}/activities - Get activities\n' +
                    '- GET /contacts - Search contacts\n\n' +
                    'Full Documentation: https://docs.developers.clio.com/api-documentation/\n' +
                    'Authentication: OAuth 2.0 Bearer token required\n' +
                    'Rate Limits: Check X-RateLimit-Remaining header\n',
            },
          ],
        };
      }

      return {
        contents: [],
      };
    });

    // Register tool handler
    serverInstance.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args } = request.params;
      const toolStartTime = Date.now();

      safeLog('info', `Tool execution started: ${name}`, { tool: name });

      try {
        // Validate request has HTTP context
        if (!currentHttpRequest) {
          throw new Error('No HTTP request context available');
        }

        // Create Clio client (supports both real and mock modes)
        const clioClient = await createClioClient(currentHttpRequest);

        // Route to appropriate tool handler with validation
        let result: string;

        switch (name) {
          case 'get_matter_intelligence_brief': {
            // Validate input
            const validated = MatterIntelligenceBriefSchema.parse(args);
            result = await getMatterIntelligenceBrief(clioClient, validated.matter_id);
            break;
          }

          case 'perform_ethical_conflict_check': {
            // Validate input
            const validated = EthicalConflictCheckSchema.parse(args);
            result = await performEthicalConflictCheck(clioClient, validated.search_query);
            break;
          }

          case 'audit_unbilled_activities': {
            // Validate input
            const validated = AuditUnbilledActivitiesSchema.parse(args);
            result = await auditUnbilledActivities(clioClient, validated.matter_id);
            break;
          }

          default:
            const duration = Date.now() - toolStartTime;
            safeLog('error', `Unknown tool: ${name}`, { tool: name, duration: `${duration}ms` });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: `Unknown tool: ${name}` }),
                },
              ],
              isError: true,
            };
        }

        const duration = Date.now() - toolStartTime;
        safeLog('info', `Tool execution completed: ${name}`, { 
          tool: name, 
          duration: `${duration}ms`,
        });

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      } catch (error) {
        const duration = Date.now() - toolStartTime;
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        
        // Handle Zod validation errors
        if (error && typeof error === 'object' && 'issues' in error) {
          const zodError = error as { issues: Array<{ path: string[]; message: string }> };
          const validationErrors = zodError.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ');
          
          safeLog('error', `Tool validation error: ${name}`, {
            tool: name,
            duration: `${duration}ms`,
            validation_errors: validationErrors,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Validation error',
                  details: validationErrors,
                }),
              },
            ],
            isError: true,
          };
        }

        safeLog('error', `Tool execution error: ${name}`, {
          tool: name,
          duration: `${duration}ms`,
          error: errorMessage,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: errorMessage,
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }
  return serverInstance;
}

function getTransport(): WebStandardStreamableHTTPServerTransport {
  if (!transportInstance) {
    transportInstance = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });
    
    // Connect server to transport
    const server = getServer();
    server.connect(transportInstance);
  }
  return transportInstance;
}

// Helper to add CORS headers if needed
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

// Handle all HTTP methods
export async function GET(request: Request) {
  try {
    // Check rate limit (10 requests per minute)
    const rateLimit = checkRateLimit(request, 10, 60000);
    
    if (!rateLimit.allowed) {
      safeLog('warn', 'Rate limit exceeded', {
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
      
      const response = new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...rateLimit.headers,
          },
        }
      );
      return addCorsHeaders(response);
    }

    safeLog('info', 'GET request to /api/mcp/sse', {
      remaining: rateLimit.remaining,
    });
    
    currentHttpRequest = request; // Store for tool handlers
    const transport = getTransport();
    const response = await transport.handleRequest(request);
    
    // Add rate limit headers to successful response
    const responseWithHeaders = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...rateLimit.headers,
      },
    });
    
    currentHttpRequest = undefined; // Clear after handling
    return addCorsHeaders(responseWithHeaders);
  } catch (error) {
    safeLog('error', 'GET request error', {
      error: error instanceof Error ? error.message : String(error),
    });
    currentHttpRequest = undefined;
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Check rate limit (10 requests per minute)
    const rateLimit = checkRateLimit(request, 10, 60000);
    
    if (!rateLimit.allowed) {
      safeLog('warn', 'Rate limit exceeded', {
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
      
      const response = new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...rateLimit.headers,
          },
        }
      );
      return addCorsHeaders(response);
    }

    const url = new URL(request.url);
    const sessionIdFromQuery = url.searchParams.get('sessionId');
    safeLog('info', 'POST request to /api/mcp/sse', {
      has_session_id: !!sessionIdFromQuery,
      remaining: rateLimit.remaining,
    });
    
    currentHttpRequest = request; // Store for tool handlers
    
    const transport = getTransport();
    const response = await transport.handleRequest(request);
    
    // Add rate limit headers to successful response
    const responseWithHeaders = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...rateLimit.headers,
      },
    });
    
    currentHttpRequest = undefined; // Clear after handling
    return addCorsHeaders(responseWithHeaders);
  } catch (error) {
    safeLog('error', 'POST request error', {
      error: error instanceof Error ? error.message : String(error),
    });
    currentHttpRequest = undefined;
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    safeLog('info', 'DELETE request to /api/mcp/sse');
    const transport = getTransport();
    const response = await transport.handleRequest(request);
    return addCorsHeaders(response);
  } catch (error) {
    safeLog('error', 'DELETE request error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version',
    },
  });
}
