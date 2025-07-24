# Medlock

Privacy-preserving health data platform using Model Context Protocol (MCP).

## What is Medlock?

Medlock enables AI models to interact with your personal health data stored in Solid Pods. You maintain full control while leveraging AI insights.

### Key Features

- **Privacy First**: Your health data stays in your Solid Pod
- **AI Integration**: Works with ChatGPT, Claude, and other MCP-compatible models
- **Time-Limited Access**: 60-second signed URLs for data security
- **Comprehensive Audit Logs**: Track every data access
- **GitHub OAuth**: Secure authentication

## Architecture

```
apps/
├── web/          # Marketing site (Next.js on Cloudflare Pages)
└── mcp/          # MCP server (Hono on Cloudflare Workers)
```

## Quick Start

### Prerequisites

- Node.js 20+
- Yarn 4
- Cloudflare account
- GitHub OAuth app

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/medlock.git
cd medlock

# Install dependencies
yarn install

# Set up environment
cp .env.example .env
```

### Cloudflare Setup

1. **Authenticate**: `wrangler login`

2. **Create KV namespaces**:
```bash
# MCP server
cd apps/mcp
wrangler kv namespace create TOKENS
wrangler kv namespace create AUDIT

# Web app
cd ../web
wrangler kv namespace create WAITLIST_KV
```

3. **Update configs** with your KV IDs and domain:
- `apps/mcp/wrangler.production.jsonc`
- `apps/web/wrangler.production.jsonc`

4. **Configure DNS** (Cloudflare Dashboard):
- `@` → your-project.pages.dev (CNAME, proxied)
- `api` → your-project.workers.dev (CNAME, proxied)

5. **Create GitHub OAuth App** ([github.com/settings/developers](https://github.com/settings/developers)):
- Homepage: `https://your-domain.com`
- Callback: `https://api.your-domain.com/auth/callback`

6. **Set secrets**:
```bash
cd apps/mcp
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SOLID_SIGNING_KEY  # 32+ chars
```

7. **Update allowed origins** in `apps/mcp/src/index.ts`:
```typescript
const allowedOrigins = ['https://your-domain.com', 'https://chat.openai.com']
```

### Development

```bash
# Run MCP server
cd apps/mcp
yarn dev

# Run web app
cd apps/web
yarn dev
```

### Deployment

**GitHub Actions** (recommended):
1. Add repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `SOLID_SIGNING_KEY`
2. Push to main branch

**Local deployment**:
```bash
# MCP server
cd apps/mcp && wrangler deploy -c wrangler.production.jsonc

# Web app
cd apps/web && wrangler pages deploy .open-next
```

## MCP Tools

- `solid_fetch_vitals`: Retrieve vital signs from Solid Pod
- `vitals_scan`: Analyze health trends and provide insights

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE)