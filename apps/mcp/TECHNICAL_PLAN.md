# HealthMCP Server - Technical Implementation Plan

## Executive Summary

This document outlines the technical implementation plan for HealthMCP's Model Context Protocol (MCP) server. The server will enable secure, privacy-preserving AI interactions with health data stored in Solid Pods, using Cloudflare Workers for edge deployment and following MCP standards for LLM integration.

## Architecture Overview

### Core Technologies

- **Runtime**: Cloudflare Workers (edge deployment)
- **Protocol**: Model Context Protocol (MCP) with Streamable HTTP transport
- **Authentication**: GitHub OAuth2 via `@cloudflare/workers-oauth-provider`
- **MCP Framework**: `@cloudflare/agents` with McpAgent
- **Storage**: Cloudflare KV (tokens, audit logs) and Durable Objects (rate limiting)
- **Data Source**: Solid Pods (decentralized health data storage)

### Key Design Principles

1. **Privacy First**: User data never stored on our servers
2. **Security by Design**: OAuth2, signed URLs, input validation, audit trails
3. **Scalability**: Edge deployment, distributed rate limiting
4. **Reliability**: Graceful degradation, session resumption, error recovery
5. **Compliance Ready**: Comprehensive audit logging, data retention policies

## Technical Components

### 1. Authentication & Authorization

#### OAuth2 Flow (GitHub)

```typescript
// Using @cloudflare/workers-oauth-provider
const provider = new OAuthProvider({
  redirectUrl: '/oauth/callback',
  auth: (env) => GitHubAuth(env),
  storage: {
    get: (id, ctx) => ctx.env.TOKENS.get(id),
    put: (id, val, ctx) => ctx.env.TOKENS.put(id, val, { expirationTtl: 7776000 }),
    delete: (id, ctx) => ctx.env.TOKENS.delete(id),
  },
})
```

#### Session Management

- HTTP-only secure cookies (`hc_session`)
- Session tokens stored in KV with metadata
- 90-day expiration with sliding window
- CSRF protection via state parameter

### 2. MCP Implementation

#### McpAgent Setup

```typescript
export class HealthMcpAgent extends McpAgent {
  constructor(props: { env: Env; user: User }) {
    super()
    this.server = new McpServer({
      name: 'healthmcp-server',
      version: 'v0.1.0',
    })
  }

  async init() {
    // Register tools
    this.server.tool('solid_fetch_vitals', z.object({}), async () => this.fetchVitals())

    this.server.tool(
      'vitals_scan',
      z.object({ device: z.enum(['front', 'rear']) }),
      async ({ device }) => this.scanVitals(device)
    )
  }
}
```

#### Transport Layer

- Streamable HTTP with optional SSE
- JSON-RPC 2.0 message format
- Session ID management (`Mcp-Session-Id` header)
- Event replay for reconnection

### 3. Tool Implementation

#### solid_fetch_vitals

- Fetches health data from user's Solid Pod
- Signs URLs with time-limited tokens
- Validates Pod URL format
- Sanitizes returned data

#### vitals_scan

- Triggers camera-based vital scanning
- Streams progress updates
- Stores results temporarily
- Shorter audit retention (7 days)

### 4. Rate Limiting & Billing

#### Durable Objects for Rate Limiting

```typescript
export class RateLimiter extends DurableObject {
  private requests: Map<string, number[]> = new Map()

  async fetch(request: Request) {
    const { userId } = await request.json()
    const now = Date.now()
    const windowStart = now - 1000 // 1 second window

    // Sliding window algorithm
    const userRequests = this.requests.get(userId) || []
    const validRequests = userRequests.filter((t) => t > windowStart)

    if (validRequests.length >= 3) {
      return Response.json({
        allowed: false,
        retryAfter: 1000 - (now - validRequests[0]),
      })
    }

    validRequests.push(now)
    this.requests.set(userId, validRequests)

    return Response.json({ allowed: true, remaining: 3 - validRequests.length })
  }
}
```

#### Billing Integration

- Check billing status before tool execution
- Different rate limits per plan
- Usage tracking in KV
- Graceful degradation for free tier

### 5. Security Implementation

#### Input Validation

- JSON Schema validation for all tool inputs
- Sanitize user-provided data
- Validate Solid Pod URLs
- Prevent SSRF attacks

#### Output Sanitization

- Remove sensitive data from responses
- Filter allowed fields from Solid Pod data
- Escape user content in audit logs

#### Audit Logging

```typescript
interface AuditEntry {
  event: 'tool_execution' | 'auth' | 'error'
  tool?: string
  user: string
  timestamp: number
  duration_ms: number
  success: boolean
  request: {
    id: string
    ip: string
    user_agent: string
  }
  billing: {
    plan: string
    cost_units: number
  }
  error?: string
  metadata: Record<string, any>
}
```

### 6. Error Handling

#### JSON-RPC Error Codes

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error (with sub-codes for specific errors)

#### Recovery Mechanisms

- Session resumption with event replay
- Graceful degradation on service failures
- Comprehensive error logging
- User-friendly error messages

## Deployment Strategy

### Monorepo Structure

```
healthmcp/
├── apps/
│   ├── site/        # Next.js marketing site
│   └── mcp/         # MCP server
│       ├── src/
│       │   ├── index.ts
│       │   ├── auth/
│       │   ├── tools/
│       │   └── types.d.ts
│       ├── test/
│       └── wrangler.jsonc
├── packages/        # Shared utilities
└── wrangler.workspaces.jsonc
```

### CI/CD Pipeline

1. Run tests on PR (Vitest)
2. Type checking (TypeScript strict mode)
3. Security scanning (dependencies)
4. Deploy to staging on merge
5. Production deploy with approval

### Environment Configuration

```jsonc
// wrangler.jsonc
{
  "name": "mcp-server",
  "compatibility_date": "2025-06-21",
  "kv_namespaces": [
    { "binding": "TOKENS", "id": "prod_tokens_id" },
    { "binding": "AUDIT", "id": "prod_audit_id" },
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "RATE_LIMITER",
        "class_name": "RateLimiter",
      },
    ],
  },
  "routes": [{ "pattern": "api.your-domain.com/*", "zone_name": "your-domain.com" }],
}
```

## Testing Strategy

### Unit Tests

- Tool execution logic
- Input validation
- URL signing
- Error handling

### Integration Tests

- Full OAuth flow
- MCP protocol compliance
- Rate limiting behavior
- Billing integration

### Security Tests

- CSRF protection
- XSS prevention
- SSRF protection
- Input fuzzing

### Performance Tests

- Concurrent connections
- Tool execution latency
- KV operation timing
- Memory usage

## Monitoring & Observability

### Metrics (Prometheus format)

- Request count by method
- Tool execution duration
- Error rates by type
- Active sessions
- Rate limit hits

### Logging

- Structured JSON logs
- Request tracing with IDs
- Error stack traces
- Performance timing

### Alerts

- High error rate (>1%)
- Rate limit abuse
- OAuth failures
- KV operation failures

## Security Considerations

### Data Privacy

- No health data stored
- Signed URLs expire in 60 seconds
- Audit logs exclude sensitive data
- GDPR-compliant data retention

### Access Control

- OAuth2 with GitHub
- Session-based authentication
- Tool-level permissions
- API key support (future)

### Network Security

- HTTPS only
- CORS validation
- DNS rebinding protection
- IP rate limiting

## Future Enhancements

### Phase 2 (Q2 2025)

- Additional OAuth providers (Google, Apple)
- More health data sources (Epic, Cerner)
- Advanced tools (trend analysis, predictions)
- WebSocket transport

### Phase 3 (Q3 2025)

- Multi-tenant support
- Custom tool creation
- Batch operations
- Compliance certifications (HIPAA, SOC2)

## Success Metrics

### Technical KPIs

- 99.9% uptime
- <100ms tool execution latency
- <10ms auth check latency
- Zero security breaches

### Business KPIs

- 10,000 active users
- 1M tool executions/month
- 50% premium conversion
- 4.5+ user satisfaction

## Risk Mitigation

### Technical Risks

- **Solid Pod unavailability**: Cache recent data, graceful degradation
- **Rate limit bypass**: Distributed enforcement, IP blocking
- **Data leakage**: Output sanitization, security reviews

### Operational Risks

- **Cost overruns**: Usage caps, billing alerts
- **Compliance issues**: Regular audits, legal review
- **Scaling challenges**: Load testing, gradual rollout

## Conclusion

This technical plan provides a comprehensive roadmap for implementing a secure, scalable, and privacy-preserving MCP server for HealthMCP. By following TDD principles and focusing on security from the start, we can deliver a production-ready service that enables innovative AI-powered health insights while maintaining user trust and data sovereignty.
