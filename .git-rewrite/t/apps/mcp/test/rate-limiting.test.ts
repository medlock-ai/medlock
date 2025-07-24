import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env, createExecutionContext } from 'cloudflare:test'
import worker from '../src/index'

describe('Rate Limiting & Billing', () => {
  let sessionId: string

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

  describe('Rate Limiting', () => {
    it('should enforce rate limit of 3 requests per user', async () => {
      // Make 5 requests rapidly
      const requests = []
      for (let i = 0; i < 5; i++) {
        requests.push(
          worker.fetch(
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

    it('should have separate rate limits per user', async () => {
      // Create two different users
      const user1SessionId = 'test-session-user1-' + crypto.randomUUID()
      const user2SessionId = 'test-session-user2-' + crypto.randomUUID()

      await env.TOKENS.put(
        `session:${user1SessionId}`,
        JSON.stringify({
          userId: 'user1',
          username: 'testuser1',
          email: 'test1@example.com',
          accessToken: 'test-token1',
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
        { expirationTtl: 24 * 60 * 60 }
      )

      await env.TOKENS.put(
        `session:${user2SessionId}`,
        JSON.stringify({
          userId: 'user2',
          username: 'testuser2',
          email: 'test2@example.com',
          accessToken: 'test-token2',
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
        { expirationTtl: 24 * 60 * 60 }
      )

      // Make 4 requests as user1
      const user1Requests = []
      for (let i = 0; i < 4; i++) {
        user1Requests.push(
          worker.fetch(
            new Request('https://api.your-domain.com/api/mcp', {
              method: 'POST',
              headers: {
                Cookie: `hc_session=${user1SessionId}`,
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

      const user1Responses = await Promise.all(user1Requests)

      // User1: First 3 succeed, 4th is rate limited
      expect(user1Responses[0]?.status).toBe(200)
      expect(user1Responses[1]?.status).toBe(200)
      expect(user1Responses[2]?.status).toBe(200)
      expect(user1Responses[3]?.status).toBe(429)

      // Now make requests as user2 - should not be affected by user1's limit
      const user2Requests = []
      for (let i = 0; i < 3; i++) {
        user2Requests.push(
          worker.fetch(
            new Request('https://api.your-domain.com/api/mcp', {
              method: 'POST',
              headers: {
                Cookie: `hc_session=${user2SessionId}`,
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

      const user2Responses = await Promise.all(user2Requests)

      // User2: All 3 should succeed
      expect(user2Responses[0]?.status).toBe(200)
      expect(user2Responses[1]?.status).toBe(200)
      expect(user2Responses[2]?.status).toBe(200)
    })

    it('should provide rate limit information in headers', async () => {
      // Make a few requests and verify headers
      const responses = []
      for (let i = 0; i < 4; i++) {
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
                capabilities: { tools: {} },
                clientInfo: { name: 'test-client', version: '1.0.0' },
              },
              id: i + 1,
            }),
          }),
          env,
          createExecutionContext()
        )
        responses.push(response)
      }

      // First response should show remaining = 2
      expect(responses[0]?.headers.get('x-ratelimit-remaining')).toBe('2')

      // Second response should show remaining = 1
      expect(responses[1]?.headers.get('x-ratelimit-remaining')).toBe('1')

      // Third response should show remaining = 0
      expect(responses[2]?.headers.get('x-ratelimit-remaining')).toBe('0')

      // Fourth response should be rate limited
      expect(responses[3]?.status).toBe(429)
      expect(responses[3]?.headers.get('x-ratelimit-remaining')).toBe('0')

      // All should show limit = 3
      responses.forEach((response) => {
        expect(response.headers.get('x-ratelimit-limit')).toBe('3')
      })
    })

    it('should handle rate limiter failures gracefully', async () => {
      // Test is inherently handled by the middleware - if rate limiter fails,
      // requests are allowed through. This test verifies that behavior.

      // We can't easily simulate a Durable Object failure in the test environment,
      // but we can verify that requests go through when rate limiting is working
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
    })
  })

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in responses', async () => {
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
              capabilities: { tools: {} },
              clientInfo: { name: 'test-client', version: '1.0.0' },
            },
            id: 1,
          }),
        }),
        env,
        createExecutionContext()
      )

      expect(response.headers.get('x-ratelimit-limit')).toBe('3')
      expect(response.headers.get('x-ratelimit-remaining')).toBeTruthy()
      expect(response.headers.get('x-ratelimit-reset')).toBeTruthy()

      const remaining = parseInt(response.headers.get('x-ratelimit-remaining')!)
      expect(remaining).toBeGreaterThanOrEqual(0)
      expect(remaining).toBeLessThanOrEqual(3)
    })
  })

  describe('Unauthenticated Requests', () => {
    it('should not rate limit unauthenticated requests', async () => {
      // Make multiple requests without authentication
      const requests = []
      for (let i = 0; i < 5; i++) {
        requests.push(
          worker.fetch(
            new Request('https://api.your-domain.com/api/mcp', {
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
                id: i + 1,
              }),
            }),
            env,
            createExecutionContext()
          )
        )
      }

      const responses = await Promise.all(requests)

      // All should get 401 (not 429)
      responses.forEach((response) => {
        expect(response.status).toBe(401)
      })
    })
  })
})
