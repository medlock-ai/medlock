import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env, createExecutionContext } from 'cloudflare:test'
import worker from '../src/index'

describe('MCP Protocol Implementation', () => {
  let sessionId: string
  let mcpSessionId: string | null = null

  // Helper to parse SSE responses
  async function parseSSEResponse(response: Response): Promise<any> {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Look for the message event
        if (buffer.includes('event: message')) {
          break
        }
      }
    }

    // Parse the SSE message
    const lines = buffer.split('\n')
    let jsonData = ''
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.startsWith('data: ')) {
        jsonData = lines[i]!.substring(6)
        break
      }
    }

    return JSON.parse(jsonData)
  }

  // Helper to initialize MCP session
  async function initializeMcpSession(): Promise<string> {
    const response = await worker.fetch(
      new Request('https://api.your-domain.com/api/mcp', {
        method: 'POST',
        headers: {
          Cookie: `hc_session=${sessionId}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
          id: 1,
        }),
      }),
      env,
      createExecutionContext()
    )

    // Get the session ID from response headers
    const responseSessionId = response.headers.get('mcp-session-id')
    if (!responseSessionId) {
      throw new Error('No MCP session ID returned')
    }

    return responseSessionId
  }

  beforeEach(async () => {
    // Create authenticated session for tests
    // Use a unique userId for each test to avoid rate limiting
    const uniqueUserId = 'test-user-' + crypto.randomUUID()
    sessionId = 'test-session-' + crypto.randomUUID()
    await env.TOKENS.put(
      `session:${sessionId}`,
      JSON.stringify({
        userId: uniqueUserId,
        username: 'testuser',
        email: 'test@example.com',
        accessToken: 'test-token',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      }),
      { expirationTtl: 24 * 60 * 60 }
    )

    // Clear any mocked functions
    vi.clearAllMocks()
  })

  describe('JSON-RPC 2.0 Protocol', () => {
    it('should handle JSON-RPC requests via POST endpoint', async () => {
      const response = await worker.fetch(
        new Request('https://api.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              clientInfo: {
                name: 'test-client',
                version: '1.0.0',
              },
            },
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')

      const body = await parseSSEResponse(response)

      expect(body.jsonrpc).toBe('2.0')
      expect(body.id).toBe(1)
      expect(body.result).toMatchObject({
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: 'healthmcp-server',
          version: expect.any(String),
        },
      })
    }, 10000)

    it('should validate JSON-RPC request format', async () => {
      const response = await worker.fetch(
        new Request('https://api.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            method: 'test', // Missing jsonrpc field
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(400) // Invalid JSON-RPC returns 400
      const body = (await response.json()) as {
        jsonrpc: string
        error: { code: number; message: string }
      }

      expect(body.jsonrpc).toBe('2.0')
      expect(body.error).toMatchObject({
        code: -32700,
        message: 'Parse error: Invalid JSON-RPC message',
      })
    })

    it('should handle batch requests', async () => {
      // Initialize MCP session first
      mcpSessionId = await initializeMcpSession()

      const response = await worker.fetch(
        new Request('https://api.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': mcpSessionId,
          },
          body: JSON.stringify([
            {
              jsonrpc: '2.0',
              method: 'tools/list',
              id: 1,
            },
            {
              jsonrpc: '2.0',
              method: 'resources/list',
              id: 2,
            },
          ]),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')

      // For batch requests, we'll get the first response back via SSE
      const body = await parseSSEResponse(response)

      expect(body.jsonrpc).toBe('2.0')
      expect(body.id).toBe(1)
      expect(body.result).toMatchObject({
        tools: expect.any(Array),
      })
    }, 10000)

    it('should return method not found for unknown methods', async () => {
      // Initialize MCP session first
      mcpSessionId = await initializeMcpSession()

      const response = await worker.fetch(
        new Request('https://api.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': mcpSessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'unknown/method',
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')

      const body = await parseSSEResponse(response)
      expect(body.error).toMatchObject({
        code: -32601,
        message: 'Method not found',
      })
    }, 10000)
  })

  describe('Protocol Capabilities', () => {
    it('should list available tools', async () => {
      // Initialize MCP session first
      mcpSessionId = await initializeMcpSession()

      const response = await worker.fetch(
        new Request('https://api.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': mcpSessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')

      const body = await parseSSEResponse(response)
      expect(body.result.tools).toEqual([
        {
          name: 'solid_fetch_vitals',
          description: "Fetch latest vitals from the user's Solid Pod",
          inputSchema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: 'vitals_scan',
          description: 'Trigger camera-based vitals scan.',
          inputSchema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: {
              device: {
                type: 'string',
                enum: ['front', 'rear'],
              },
            },
            required: ['device'],
            additionalProperties: false,
          },
        },
      ])
    }, 10000)

    it('should handle notifications (no id)', async () => {
      // Initialize MCP session first
      mcpSessionId = await initializeMcpSession()

      const response = await worker.fetch(
        new Request('https://api.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': mcpSessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/progress',
            params: {
              progressToken: 'scan-123',
              progress: 0.5,
              total: 1.0,
            },
            // No id field for notifications
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(202) // Accepted for notifications
    })
  })
})
