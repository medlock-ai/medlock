# Cloudflare Setup

Deploy your own Medlock instance.

## Prerequisites

- Cloudflare account with your domain
- Wrangler CLI (`npm install -g wrangler`)
- GitHub account

## 1. Authenticate

```bash
wrangler login
```

## 2. Create Storage

```bash
# MCP server storage
cd apps/mcp
wrangler kv namespace create TOKENS
wrangler kv namespace create AUDIT

# Web app storage  
cd ../web
wrangler kv namespace create WAITLIST_KV
```

Save the IDs.

## 3. Configure

Copy the local configs to create production configs:

```bash
cp apps/mcp/wrangler.local.jsonc apps/mcp/wrangler.production.jsonc
cp apps/web/wrangler.local.jsonc apps/web/wrangler.production.jsonc
```

Update production configs with your KV IDs and domain. Production configs are gitignored.

## 4. DNS

In Cloudflare dashboard → DNS:

```
@ → your-project.pages.dev (CNAME, proxied)
api → your-project.workers.dev (CNAME, proxied)
```

## 5. GitHub OAuth

[github.com/settings/developers](https://github.com/settings/developers) → New OAuth App

- Homepage: `https://your-domain.com`
- Callback: `https://api.your-domain.com/auth/callback`

## 6. Secrets

```bash
cd apps/mcp
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET  
wrangler secret put SOLID_SIGNING_KEY      # 32+ chars
wrangler secret put METRICS_KEY            # any string
```

## 7. Origins

Update `apps/mcp/src/index.ts` line 44:

```typescript
const allowedOrigins = ['https://your-domain.com', 'https://chat.openai.com']
```

## 8. Deploy

```bash
# API
cd apps/mcp && wrangler deploy

# Web
cd ../web && wrangler pages deploy .open-next
```

## 9. Verify

- Health: `https://api.your-domain.com/health`
- Logs: `wrangler tail`
- Metrics: `curl https://api.your-domain.com/metrics -H "Authorization: Bearer YOUR_KEY"`

## Local Development

```bash
yarn dev  # Both apps start locally
```