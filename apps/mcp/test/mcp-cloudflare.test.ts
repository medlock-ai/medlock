import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env, createExecutionContext } from 'cloudflare:test'
import worker from '../src/index'

describe('Cloudflare MCP Implementation', () => {
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

  describe('McpAgent Integration', () => {
    it('should use McpAgent.serve() for handling MCP requests', async () => {
      const response = await worker.fetch(
        new Request('https://api.healthmcp.ai/api/mcp', {
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

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      expect(response.headers.get('mcp-session-id')).toBeTruthy()
    }, 10000)

    it('should maintain session state across requests', async () => {
      // Initialize session
      const initResponse = await worker.fetch(
        new Request('https://api.healthmcp.ai/api/mcp', {
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

      const sessionIdHeader = initResponse.headers.get('mcp-session-id')
      expect(sessionIdHeader).toBeTruthy()

      // Make another request with the session ID
      const listResponse = await worker.fetch(
        new Request('https://api.healthmcp.ai/api/mcp', {
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
      const body = await parseSSEResponse(listResponse)
      expect(body.result.tools).toHaveLength(2)
    }, 10000)
  })

  describe('Durable Objects Integration', () => {
    it('should use Durable Objects for rate limiting', async () => {
      // Make multiple requests to trigger rate limiting
      const requests = []
      for (let i = 0; i < 5; i++) {
        requests.push(
          worker.fetch(
            new Request('https://api.healthmcp.ai/api/mcp', {
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
                id: i + 1,
              }),
            }),
            env,
            createExecutionContext()
          )
        )
      }

      const responses = await Promise.all(requests)

      // First 3 should succeed
      expect(responses[0]?.status).toBe(200)
      expect(responses[1]?.status).toBe(200)
      expect(responses[2]?.status).toBe(200)

      // 4th and 5th should be rate limited
      expect(responses[3]?.status).toBe(429)
      expect(responses[4]?.status).toBe(429)

      // Check rate limit headers
      expect(responses[3]?.headers.get('x-ratelimit-limit')).toBe('3')
      expect(responses[3]?.headers.get('x-ratelimit-remaining')).toBe('0')
    })
  })

  describe('KV Storage', () => {
    it('should store session data in KV', async () => {
      // The session was already stored in beforeEach
      const storedSession = await env.TOKENS.get(`session:${sessionId}`)
      expect(storedSession).toBeTruthy()

      const sessionData = JSON.parse(storedSession!)
      expect(sessionData.userId).toMatch(/^test-user-/)
      expect(sessionData.username).toBe('testuser')
    })

    it('should store MCP session mapping in KV', async () => {
      // Initialize MCP session
      const response = await worker.fetch(
        new Request('https://api.healthmcp.ai/api/mcp', {
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

      const mcpSessionId = response.headers.get('mcp-session-id')
      expect(mcpSessionId).toBeTruthy()

      // Check that MCP session ID was stored
      const sessionData = JSON.parse(await env.TOKENS.get(`session:${sessionId}`)!)
      const storedMcpSessionId = await env.TOKENS.get(`mcp-session:${sessionData.userId}`)
      expect(storedMcpSessionId).toBe(mcpSessionId)
    }, 10000)
  })

  describe('Security Features', () => {
    it('should enforce authentication', async () => {
      const response = await worker.fetch(
        new Request('https://api.healthmcp.ai/api/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {},
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(401)
    })

    it('should set security headers', async () => {
      const response = await worker.fetch(
        new Request('https://api.healthmcp.ai/health'),
        env,
        createExecutionContext()
      )

      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block')
      expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await worker.fetch(
        new Request('https://api.healthmcp.ai/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: 'invalid json',
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(400)
      const body = (await response.json()) as { error: { code: number; message: string } }
      expect(body.error.code).toBe(-32700)
      expect(body.error.message).toContain('Parse error')
    })

    it('should handle missing session gracefully', async () => {
      const response = await worker.fetch(
        new Request('https://api.healthmcp.ai/api/mcp', {
          method: 'POST',
          headers: {
            Cookie: `hc_session=${sessionId}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': 'non-existent-session',
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
      const body = (await response.json()) as { error: { code: number; message: string } }
      expect(body.error.code).toBe(-32001)
      expect(body.error.message).toBe('Session not found')
    })
  })
})
