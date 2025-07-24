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

1. Create KV namespaces:
```bash
cd apps/mcp
wrangler kv namespace create TOKENS
wrangler kv namespace create AUDIT

cd ../web
wrangler kv namespace create WAITLIST_KV
```

2. Update `wrangler.jsonc` files with your namespace IDs

3. Set secrets:
```bash
cd apps/mcp
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SOLID_SIGNING_KEY
wrangler secret put METRICS_KEY
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

```bash
# Deploy MCP server
cd apps/mcp
yarn deploy

# Deploy web app
cd apps/web
yarn deploy
```

## MCP Tools

- `solid_fetch_vitals`: Retrieve vital signs from Solid Pod
- `vitals_scan`: Analyze health trends and provide insights

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE)