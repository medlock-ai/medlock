import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from 'hono/logger'
import { getCookie, setCookie } from 'hono/cookie'
import type { Bindings } from './types'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { MedlockMcpAgent } from './mcp-agent'

// Create Hono app
const app = new Hono<{ Bindings: Bindings }>()

// Apply global middleware
app.use('*', logger())

// Global error handler
app.onError((err, c) => {
  console.error('Global error:', err)
  return c.json(
    {
      error: 'Internal server error',
      message: err.message,
      stack: err.stack,
    },
    500
  )
})
app.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    xXssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin',
  })
)

// Configure CORS
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowedOrigins = [c.env.ALLOWED_ORIGINS?.split(',') || ['https://medlock.ai', 'https://chat.openai.com']].flat()
      if (!origin || allowedOrigins.includes(origin)) {
        return origin || allowedOrigins[0]
      }
      return null
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
  })
)

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: c.env.MCP_VERSION || 'v0.1.0',
    timestamp: new Date().toISOString(),
  })
})

// Test auth endpoint
app.get('/test-auth', authMiddleware, (c) => {
  return c.json({ message: 'Authenticated', userId: c.get('userId') })
})

// Metrics are handled by Cloudflare Analytics
// Access via Cloudflare Dashboard or GraphQL API:
// - Workers Analytics for request metrics
// - Durable Objects Analytics for session metrics
// - Logpush for detailed logs
// No public metrics endpoint needed

// GitHub OAuth helper functions
const getGitHubAuthUrl = (env: Bindings, state: string) => {
  const params = new URLSearchParams({
    client_id: env.OAUTH_CLIENT_ID,
    redirect_uri: `${env.BASE_URL || 'https://api.medlock.ai'}/auth/callback`,
    scope: 'user:email',
    state: state,
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

const exchangeGitHubCode = async (env: Bindings, code: string) => {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Medlock/1.0',
    },
    body: JSON.stringify({
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      code: code,
    }),
  })

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.statusText}`)
  }

  return (await response.json()) as { access_token: string; token_type: string; scope: string }
}

interface GitHubUserInfo {
  id: string
  login: string
  email?: string
}

const getGitHubUserInfo = async (accessToken: string): Promise<GitHubUserInfo> => {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Medlock/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub user info fetch failed: ${response.statusText}`)
  }

  return (await response.json()) as GitHubUserInfo
}

// OAuth login endpoint
app.get('/auth/login', async (c) => {
  // Generate state for CSRF protection
  const state = crypto.randomUUID()

  // Store state in KV with short TTL
  await c.env.TOKENS.put(
    `oauth_state:${state}`,
    JSON.stringify({ timestamp: Date.now() }),
    { expirationTtl: 600 } // 10 minutes
  )

  const authUrl = getGitHubAuthUrl(c.env, state)
  return c.redirect(authUrl)
})

// OAuth callback endpoint
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400)
  }

  // Verify state
  const stateData = await c.env.TOKENS.get(`oauth_state:${state}`)
  if (!stateData) {
    return c.json({ error: 'Invalid state' }, 400)
  }

  // Clean up state
  await c.env.TOKENS.delete(`oauth_state:${state}`)

  try {
    // Exchange code for access token
    const tokens = await exchangeGitHubCode(c.env, code)

    // Get user info
    const userInfo = await getGitHubUserInfo(tokens.access_token)

    // Create session
    const sessionId = crypto.randomUUID()
    const sessionData = {
      userId: userInfo.id,
      username: userInfo.login || userInfo.email?.split('@')[0] || 'user',
      email: userInfo.email,
      accessToken: tokens.access_token,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    }

    // Store session in KV
    await c.env.TOKENS.put(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
      { expirationTtl: 24 * 60 * 60 } // 24 hours
    )

    // Set secure session cookie
    const isSecure = new URL(c.req.url).protocol === 'https:'
    setCookie(c, 'hc_session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 86400, // 24 hours
    })

    // Redirect to success page
    return c.redirect(`${c.env.BASE_URL || 'https://medlock.ai'}/auth/success`)
  } catch (error) {
    console.error('OAuth error:', error)
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

// Logout endpoint
app.post('/auth/logout', async (c) => {
  const sessionCookie = getCookie(c, 'hc_session')

  if (sessionCookie) {
    // Delete session from KV
    await c.env.TOKENS.delete(`session:${sessionCookie}`)
  }

  // Clear cookie
  setCookie(c, 'hc_session', '', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0,
  })
  return c.json({ message: 'Logged out successfully' })
})

// Create the MCP handler using McpAgent's serve method
// This properly handles the Streamable HTTP protocol
const mcpHandler = MedlockMcpAgent.serve('/api/mcp', {
  binding: 'MCP_AGENT',
  corsOptions: {
    origin: '*', // We handle CORS at the app level
    headers: 'Content-Type, Authorization, mcp-session-id',
    methods: 'GET, POST, OPTIONS',
    maxAge: 86400,
  },
})

// MCP endpoint with authentication
app.all('/api/mcp', authMiddleware, rateLimitMiddleware, async (c) => {
  const session = c.get('session')
  const userId = c.get('userId')

  try {
    // Check if this is a POST request with JSON-RPC content
    if (c.req.method === 'POST') {
      const contentType = c.req.header('Content-Type')
      if (contentType?.includes('application/json')) {
        let body: any
        try {
          body = await c.req.json()
        } catch (e) {
          // Invalid JSON - let McpAgent handle it
          return mcpHandler.fetch(c.req.raw, c.env, {
            waitUntil: (promise: Promise<any>) => c.executionCtx.waitUntil(promise),
            passThroughOnException: () => {},
            props: {
              userId: session.userId,
              username: session.username,
              email: session.email,
              accessToken: session.accessToken,
            },
          })
        }
        const isInitRequest = body.method === 'initialize'

        // For each user, we maintain a consistent MCP session ID
        // This ensures the same user always connects to the same Durable Object instance
        const userMcpSessionId = `user-${userId}`

        // Get or create headers
        const headers = new Headers(c.req.raw.headers)

        // Set the mcp-session-id header for non-initialization requests
        // For initialization requests, the library will generate a new session ID
        if (!isInitRequest) {
          // Check if we have a stored MCP session ID for this user
          const storedSessionId = await c.env.TOKENS.get(`mcp-session:${userId}`)
          if (storedSessionId) {
            headers.set('mcp-session-id', storedSessionId)
          } else {
            // If no stored session, this will trigger a "session not found" error
            // which is correct - the client should initialize first
            headers.set('mcp-session-id', userMcpSessionId)
          }
        }

        // Create a new request with modified headers
        const newRequest = new Request(c.req.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        // Create context with user props
        const ctx = {
          waitUntil: (promise: Promise<any>) => c.executionCtx.waitUntil(promise),
          passThroughOnException: () => {},
          props: {
            userId: session.userId,
            username: session.username,
            email: session.email,
            accessToken: session.accessToken,
          },
        }

        // Forward to the MCP handler
        const response = await mcpHandler.fetch(newRequest, c.env, ctx)

        // If initialization was successful, store the session ID for future requests
        if (isInitRequest && response.ok) {
          const responseSessionId = response.headers.get('mcp-session-id')
          if (responseSessionId) {
            await c.env.TOKENS.put(
              `mcp-session:${userId}`,
              responseSessionId,
              { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
            )
          }
        }

        return response
      }
    }

    // For non-JSON-RPC requests, just forward to the handler
    // This might be for SSE or other transport mechanisms
    const ctx = {
      waitUntil: (promise: Promise<any>) => c.executionCtx.waitUntil(promise),
      passThroughOnException: () => {},
      props: {
        userId: session.userId,
        username: session.username,
        email: session.email,
        accessToken: session.accessToken,
      },
    }

    return mcpHandler.fetch(c.req.raw, c.env, ctx)
  } catch (error) {
    console.error('MCP request error:', error)
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error',
        },
        id: null,
      },
      500
    )
  }
})

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    // Clean up expired sessions
    ctx.waitUntil(cleanupExpiredSessions(env))
  },
}

// Export Durable Objects
export { RateLimiter } from './durable-objects/rate-limiter'
export { MedlockMcpAgent } from './mcp-agent'

// Cleanup function for expired sessions
async function cleanupExpiredSessions(env: Bindings) {
  // This would be called periodically via cron trigger
  // For now, sessions expire automatically via KV TTL
  console.log('Running session cleanup...')
}
