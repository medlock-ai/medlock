export interface Bindings {
  // KV namespaces
  TOKENS: KVNamespace
  AUDIT: KVNamespace

  // Durable Objects
  RATE_LIMITER: DurableObjectNamespace
  MCP_AGENT: DurableObjectNamespace

  // Environment variables
  OAUTH_CLIENT_ID: string
  OAUTH_CLIENT_SECRET: string
  BASE_URL?: string
  MCP_VERSION?: string
}

export interface SessionData {
  userId: string
  username: string
  email?: string
  accessToken: string
  createdAt: number
  expiresAt: number
  type?: 'oauth' | 'api_key'
  scopes?: string[]
}

declare module 'hono' {
  interface ContextVariableMap {
    session: SessionData
    userId: string
  }
}

export interface Tool {
  name: string
  description: string
  inputSchema: any
  handler: (params: any, context: any) => Promise<any>
}
