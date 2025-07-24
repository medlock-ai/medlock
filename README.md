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
├── web/          # Marketing site (Next.js on Cloudflare Workers)
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
git clone https://github.com/medlock-ai/medlock.git
cd medlock

# Install dependencies
yarn install
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
- `@` → your-worker.workers.dev (CNAME, proxied)
- `api` → your-mcp-worker.workers.dev (CNAME, proxied)

5. **Create GitHub OAuth App** ([github.com/settings/developers](https://github.com/settings/developers)):
- Homepage: `https://your-domain.com`
- Callback: `https://api.your-domain.com/auth/callback`

6. **Generate secure signing key**:
```bash
# Generate a cryptographically secure 256-bit key (Solid spec recommendation)
openssl rand -base64 32
```

7. **Set secrets**:
```bash
cd apps/mcp
# For production environment (top-level)
wrangler secret put GITHUB_CLIENT_ID --env=""
wrangler secret put GITHUB_CLIENT_SECRET --env=""
wrangler secret put SOLID_SIGNING_KEY --env=""  # Use the key from step 6

# For staging environment (if needed)
wrangler secret put GITHUB_CLIENT_ID --env=staging
wrangler secret put GITHUB_CLIENT_SECRET --env=staging
wrangler secret put SOLID_SIGNING_KEY --env=staging
```

8. **Configure allowed origins** in `wrangler.production.jsonc`:
```jsonc
"ALLOWED_ORIGINS": "https://your-domain.com,https://chat.openai.com,https://claude.ai"
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
   - `CLOUDFLARE_API_TOKEN` - For CI/CD deployment
   - `GITHUB_CLIENT_ID` - OAuth app client ID
   - `GITHUB_CLIENT_SECRET` - OAuth app client secret
   - `SOLID_SIGNING_KEY` - Your generated signing key
2. Push to main branch

**Local deployment**:
```bash
# Build and deploy MCP server
cd apps/mcp && wrangler deploy -c wrangler.production.jsonc

# Build and deploy web app  
cd apps/web && yarn deploy
```

## MCP Tools

- `solid_fetch_vitals`: Retrieve vital signs from Solid Pod
- `vitals_scan`: Analyze health trends and provide insights

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE)