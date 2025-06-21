// Cloudflare environment bindings
export interface Bindings {
  // KV Namespaces
  TOKENS: KVNamespace
  AUDIT: KVNamespace

  // Durable Objects
  RATE_LIMITER: DurableObjectNamespace

  // AI binding
  AI: Ai

  // Environment variables
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  SOLID_SIGNING_KEY: string
  METRICS_KEY: string
  BASE_URL?: string
  MCP_VERSION?: string
  ALLOWED_ORIGINS?: string
  SOLID_POD_DOMAIN?: string
}

// Session data structure
export interface SessionData {
  userId: string
  username: string
  email?: string
  accessToken: string
  createdAt: number
  expiresAt: number
}

// MCP request/response types
export interface MCPRequest {
  jsonrpc: '2.0'
  method: string
  params?: any
  id?: string | number
}

export interface MCPResponse {
  jsonrpc: '2.0'
  result?: any
  error?: MCPError
  id?: string | number
}

export interface MCPError {
  code: number
  message: string
  data?: any
}

// Tool types
export interface Tool {
  name: string
  description: string
  inputSchema: Record<string, any>
  handler: (params: any, context: ToolContext) => Promise<any>
}

export interface ToolContext {
  userId: string
  session: SessionData
  env: Bindings
  auditLog: (action: string, details: any) => Promise<void>
}

// Audit log types
export interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  action: string
  toolName?: string
  params?: any
  result?: any
  error?: any
  duration?: number
  ipAddress?: string
}

// Rate limiting types
export interface RateLimitInfo {
  userId: string
  requests: number
  windowStart: number
  blocked: boolean
}
