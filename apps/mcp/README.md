# HealthMCP Server

A secure, privacy-preserving Model Context Protocol (MCP) server that enables AI models to interact with health data stored in Solid Pods.

## 🎯 Overview

HealthMCP Server implements the Model Context Protocol to provide controlled access to personal health data for AI assistants like ChatGPT and Claude. Built on Cloudflare Workers for edge deployment, it ensures user data never leaves their control while enabling powerful AI-driven health insights.

## 🏗️ Architecture

- **Protocol**: Model Context Protocol (MCP) with Streamable HTTP transport
- **Runtime**: Cloudflare Workers (edge deployment)
- **Authentication**: GitHub OAuth2 via `@cloudflare/workers-oauth-provider`
- **Storage**: Cloudflare KV (tokens, audit) + Durable Objects (rate limiting)
- **Framework**: Hono + `@cloudflare/agents` McpAgent

## 📋 Features

### Core Functionality

- ✅ MCP-compliant server with JSON-RPC 2.0
- ✅ Streamable HTTP transport with SSE support
- ✅ GitHub OAuth2 authentication
- ✅ Session management with secure cookies
- ✅ Tool execution with progress streaming

### Available Tools

1. **solid_fetch_vitals** - Fetch health data from Solid Pod
2. **vitals_scan** - Camera-based vital signs scanning

### Security & Privacy

- 🔒 No health data stored on servers
- 🔒 Time-limited signed URLs (60s expiry)
- 🔒 Comprehensive audit logging
- 🔒 Input validation and output sanitization
- 🔒 CSRF, XSS, and SSRF protection

### Performance & Reliability

- ⚡ Edge deployment for low latency
- ⚡ Rate limiting (3 req/sec per user)
- ⚡ Session resumption on disconnect
- ⚡ Graceful degradation
- ⚡ Billing integration

## 🧪 Test-Driven Development

This project follows strict TDD principles. All tests were written before implementation:

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run with UI
pnpm test:ui
```

### Test Coverage

- **57 tests** across 6 test suites
- **100% failing** (as expected before implementation)
- Covers auth, protocol, tools, rate limiting, and integration

See [TEST_SUMMARY.md](./TEST_SUMMARY.md) for detailed test documentation.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Cloudflare account
- GitHub OAuth app

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Create KV namespaces
pnpm wrangler kv namespace create TOKENS
pnpm wrangler kv namespace create AUDIT

# Update wrangler.jsonc with KV IDs
```

### Development

```bash
# Start local dev server
pnpm dev

# Run tests in watch mode
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Deployment

```bash
# Deploy to staging
pnpm deploy:staging

# Deploy to production
pnpm deploy

# Monitor logs
pnpm tail
```

## 📁 Project Structure

```
apps/mcp/
├── src/
│   ├── index.ts           # Main app entry
│   ├── auth/              # OAuth handlers
│   ├── tools/             # MCP tools
│   ├── middleware/        # Auth, rate limiting
│   └── types.d.ts         # TypeScript types
├── test/
│   ├── auth.test.ts       # Authentication tests
│   ├── mcp-protocol.test.ts
│   ├── tools.test.ts
│   └── integration.test.ts
├── wrangler.jsonc         # Cloudflare config
└── package.json
```

## 🔧 Configuration

### Environment Variables

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Solid Pod
SOLID_SIGNING_KEY=32_byte_secret_key

# KV Namespace IDs (from wrangler kv namespace create)
TOKENS_KV_ID=xxx
AUDIT_KV_ID=xxx
```

### Wrangler Configuration

See [wrangler.jsonc](./wrangler.jsonc) for full configuration including:

- KV namespace bindings
- Durable Object bindings
- Custom domain routing
- Environment-specific settings

## 📚 Documentation

- [Technical Plan](./TECHNICAL_PLAN.md) - Comprehensive implementation guide
- [Test Summary](./TEST_SUMMARY.md) - Test suite documentation
- [MCP Specification](https://modelcontextprotocol.io) - Protocol documentation

## 🔐 Security

### Reporting Security Issues

Please open an issue or submit a pull request with details.

### Security Features

- OAuth2 with PKCE
- Signed URLs with expiry
- Rate limiting per user
- Input validation
- Output sanitization
- Comprehensive audit logs

## 📊 Monitoring

### Metrics Endpoint

```bash
curl https://api.your-domain.com/metrics \
  -H "Authorization: Bearer $METRICS_KEY"
```

### Available Metrics

- `mcp_requests_total` - Request count by method
- `mcp_tool_duration_seconds` - Tool execution time
- `mcp_errors_total` - Error count by type
- `mcp_active_sessions` - Current active sessions

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Write tests first (TDD)
4. Implement until tests pass
5. Commit changes (`git commit -m 'feat: add amazing feature'`)
6. Push to branch (`git push origin feature/amazing`)
7. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com) for edge computing
- [Model Context Protocol](https://modelcontextprotocol.io) for the specification
- [Solid Project](https://solidproject.org) for decentralized storage
- [Hono](https://hono.dev) for the web framework

---

Built with ❤️ for privacy-preserving AI health insights.
