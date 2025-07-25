import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env, createExecutionContext } from 'cloudflare:test'
import worker from '../src/index'

describe('Tools Implementation', () => {
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

    // Get the session ID from response headers
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

    // Clear any mocked functions
    vi.clearAllMocks()
  })

  describe('Tool Execution', () => {
    it('should execute solid_fetch_vitals tool', async () => {
      // Initialize MCP session first
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
              name: 'solid_fetch_vitals',
              arguments: {},
            },
            id: 2,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(200)
      const body = await parseSSEResponse(response)

      expect(body.result).toMatchObject({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('heart_rate'),
          },
        ],
      })
    }, 10000)

    it('should validate tool input schema', async () => {
      // Initialize MCP session first
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

      expect(body.error).toMatchObject({
        code: -32602,
        message: expect.stringContaining('Invalid'),
      })
    }, 10000)

    it('should execute vitals_scan tool with valid arguments', async () => {
      // Initialize MCP session first
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
                device: 'front',
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

      expect(body.result).toMatchObject({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('ready'),
          },
        ],
      })

      // Parse the result to check the scan instructions
      const resultData = JSON.parse(body.result.content[0].text)
      expect(resultData.status).toBe('ready')
      expect(resultData.instructions).toContain('camera')
      expect(resultData.scanUrl).toContain('/scan/front')
    }, 10000)
  })

  describe('Tool Listing', () => {
    it('should list available tools', async () => {
      // Initialize MCP session first
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
            method: 'tools/list',
            id: 2,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(200)
      const body = await parseSSEResponse(response)

      expect(body.result.tools).toHaveLength(2)

      const toolNames = body.result.tools.map((t: any) => t.name)
      expect(toolNames).toContain('solid_fetch_vitals')
      expect(toolNames).toContain('vitals_scan')
    }, 10000)
  })

  describe('Tool Audit Logging', () => {
    it('should log tool executions to audit KV', async () => {
      // Initialize MCP session first
      mcpSessionId = await initializeMcpSession()

      // Execute a tool
      await worker.fetch(
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
            id: 2,
          }),
        }),
        env,
        createExecutionContext()
      )

      // Check audit log - need to list all keys since we don't know the exact key
      const auditKeys = await env.AUDIT.list({ prefix: 'audit:' })

      // Should have at least one audit entry
      expect(auditKeys.keys.length).toBeGreaterThan(0)

      // Find the audit entry for solid_fetch_vitals
      let foundAuditEntry = false
      for (const key of auditKeys.keys) {
        const auditEntry = await env.AUDIT.get(key.name)
        if (auditEntry) {
          const auditData = JSON.parse(auditEntry)
          if (
            auditData.action === 'tool_execution' &&
            auditData.details.tool === 'solid_fetch_vitals'
          ) {
            expect(auditData.userId).toMatch(/^test-user-/)
            foundAuditEntry = true
            break
          }
        }
      }

      expect(foundAuditEntry).toBe(true)
    }, 10000)
  })

  describe('Tool Security', () => {
    it('should require authentication for tool execution', async () => {
      const response = await worker.fetch(
        new Request('https://mcp.your-domain.com/api/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'solid_fetch_vitals',
              arguments: {},
            },
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.status).toBe(401)
    })

    it('should enforce rate limiting on tool executions', async () => {
      // Initialize MCP session first
      mcpSessionId = await initializeMcpSession()

      // Make multiple tool calls to trigger rate limiting
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

      // Should get rate limited after 3 requests
      expect(responses[0]?.status).toBe(200)
      expect(responses[1]?.status).toBe(200)
      expect(responses[2]?.status).toBe(429) // Rate limited
      expect(responses[3]?.status).toBe(429)
      expect(responses[4]?.status).toBe(429)
    })
  })
})
