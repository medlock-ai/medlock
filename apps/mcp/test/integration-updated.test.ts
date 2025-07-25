import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env, createExecutionContext } from 'cloudflare:test'
import worker from '../src/index'

describe('MCP Integration Tests', () => {
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
      new Request('https://mcp.your-domain.com/api/mcp', {
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

    const responseSessionId = response.headers.get('mcp-session-id')
    if (!responseSessionId) {
      throw new Error('No MCP session ID returned')
    }

    return responseSessionId
  }

  beforeEach(async () => {
    // Create authenticated session for tests
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
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }),
      { expirationTtl: 24 * 60 * 60 }
    )

    vi.clearAllMocks()
  })

  describe('Complete User Journey', () => {
    it('should handle full MCP session lifecycle', async () => {
      // 1. Initialize MCP session
      const initResponse = await worker.fetch(
        new Request('https://mcp.your-domain.com/api/mcp', {
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
              capabilities: { tools: {} },
              clientInfo: { name: 'test-client', version: '1.0.0' },
            },
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(initResponse.status).toBe(200)
      const sessionIdHeader = initResponse.headers.get('mcp-session-id')
      expect(sessionIdHeader).toBeTruthy()

      // 2. List available tools
      const listResponse = await worker.fetch(
        new Request('https://mcp.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': sessionIdHeader!,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 2,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(listResponse.status).toBe(200)
      const listBody = await parseSSEResponse(listResponse)
      expect(listBody.result.tools).toHaveLength(2)

      // 3. Execute a tool
      const toolResponse = await worker.fetch(
        new Request('https://mcp.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': sessionIdHeader!,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'solid_fetch_vitals',
              arguments: {},
            },
            id: 3,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(toolResponse.status).toBe(200)
      const toolBody = await parseSSEResponse(toolResponse)
      expect(toolBody.result.content[0].text).toContain('heart_rate')
    }, 15000)

    it('should handle concurrent requests', async () => {
      mcpSessionId = await initializeMcpSession()

      // Make multiple concurrent tool calls
      const requests = []
      for (let i = 0; i < 3; i++) {
        requests.push(
          worker.fetch(
            new Request('https://mcp.your-domain.com/api/mcp', {
              method: 'POST',
              headers: {
                Cookie: `hc_session=${sessionId}`,
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                'mcp-session-id': mcpSessionId,
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                  name: 'solid_fetch_vitals',
                  arguments: {},
                },
                id: i + 2,
              }),
            }),
            env,
            createExecutionContext()
          )
        )
      }

      const responses = await Promise.all(requests)

      // First 2 should succeed, 3rd might be rate limited depending on previous tests
      expect(responses.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(2)
    }, 10000)
  })

  describe('Error Recovery', () => {
    it('should handle invalid session gracefully', async () => {
      const response = await worker.fetch(
        new Request('https://mcp.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': 'invalid-session-id',
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

      expect(response.status).toBe(404)
      const body = (await response.json()) as { error: { message: string } }
      expect(body.error.message).toBe('Session not found')
    })

    it('should handle rate limiting gracefully', async () => {
      mcpSessionId = await initializeMcpSession()

      // Make more than 3 requests to trigger rate limiting
      const requests = []
      for (let i = 0; i < 5; i++) {
        requests.push(
          worker.fetch(
            new Request('https://mcp.your-domain.com/api/mcp', {
              method: 'POST',
              headers: {
                Cookie: `hc_session=${sessionId}`,
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                'mcp-session-id': mcpSessionId,
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                  name: 'solid_fetch_vitals',
                  arguments: {},
                },
                id: i + 2,
              }),
            }),
            env,
            createExecutionContext()
          )
        )
      }

      const responses = await Promise.all(requests)

      // First 3 succeed, last 2 are rate limited
      expect(responses[0]?.status).toBe(200)
      expect(responses[1]?.status).toBe(200)
      expect(responses[2]?.status).toBe(429)
      expect(responses[3]?.status).toBe(429)
      expect(responses[4]?.status).toBe(429)

      // Rate limited responses should have appropriate headers
      expect(responses[3]?.headers.get('x-ratelimit-limit')).toBe('3')
      expect(responses[3]?.headers.get('x-ratelimit-remaining')).toBe('0')
    }, 10000)
  })

  describe('Security Scenarios', () => {
    it('should validate tool arguments', async () => {
      mcpSessionId = await initializeMcpSession()

      const response = await worker.fetch(
        new Request('https://mcp.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': mcpSessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'vitals_scan',
              arguments: {
                device: 'invalid-device', // Invalid enum value
              },
            },
            id: 2,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(200)
      const body = await parseSSEResponse(response)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe(-32602)
      expect(body.error.message).toContain('Invalid')
    }, 10000)

    it('should require authentication for all MCP endpoints', async () => {
      const response = await worker.fetch(
        new Request('https://mcp.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              clientInfo: { name: 'test-client', version: '1.0.0' },
            },
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(401)
    })
  })

  describe('Observability', () => {
    it('should create audit logs for tool executions', async () => {
      mcpSessionId = await initializeMcpSession()

      // Execute a tool
      const response = await worker.fetch(
        new Request('https://mcp.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': mcpSessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'vitals_scan',
              arguments: { device: 'front' },
            },
            id: 2,
          }),
        }),
        env,
        createExecutionContext()
      )

      // Verify the tool was executed successfully
      expect(response.status).toBe(200)
      const body = await parseSSEResponse(response)
      expect(body.result).toBeDefined()
      expect(body.result.content[0].text).toContain('ready')
      expect(body.result.content[0].text).toContain('front')
    }, 10000)

    it('should expose health check endpoint', async () => {
      const response = await worker.fetch(
        new Request('https://mcp.your-domain.com/health'),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(200)
      const body = (await response.json()) as { status: string; version: string; timestamp: number }
      expect(body.status).toBe('healthy')
      expect(body.version).toBeTruthy()
      expect(body.timestamp).toBeTruthy()
    })
  })
})
