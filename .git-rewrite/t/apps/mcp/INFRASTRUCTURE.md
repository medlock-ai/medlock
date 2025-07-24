# MCP Server Infrastructure Setup

Before deploying the MCP server, you need to set up the following Cloudflare infrastructure:

## 1. Create KV Namespaces

Create two KV namespaces for the MCP server:

```bash
# Create TOKENS namespace
npx wrangler kv namespace create "TOKENS"
# Note the ID returned

# Create TOKENS preview namespace
npx wrangler kv namespace create "TOKENS" --preview
# Note the preview ID returned

# Create AUDIT namespace
npx wrangler kv namespace create "AUDIT"
# Note the ID returned

# Create AUDIT preview namespace
npx wrangler kv namespace create "AUDIT" --preview
# Note the preview ID returned
```

## 2. Update wrangler.jsonc

Replace the placeholder values in `wrangler.jsonc` with the actual KV namespace IDs:

- Replace `PLACEHOLDER_TOKENS_KV_ID` with the TOKENS namespace ID
- Replace `PLACEHOLDER_TOKENS_PREVIEW_ID` with the TOKENS preview namespace ID
- Replace `PLACEHOLDER_AUDIT_KV_ID` with the AUDIT namespace ID
- Replace `PLACEHOLDER_AUDIT_PREVIEW_ID` with the AUDIT preview namespace ID

## 3. Set up Secrets

Add the GitHub OAuth credentials:

```bash
# For production
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET

# For staging (if using)
npx wrangler secret put GITHUB_CLIENT_ID --env staging
npx wrangler secret put GITHUB_CLIENT_SECRET --env staging
```

## 4. Deploy

After completing the above steps, you can deploy:

```bash
# Deploy to production
npx wrangler deploy -c wrangler.jsonc --env=''

# Deploy to staging
npx wrangler deploy -c wrangler.jsonc --env staging
```

## For CI/CD

For automated deployments, ensure:

1. KV namespaces are created manually through the Cloudflare dashboard
2. The wrangler.jsonc file is updated with the actual IDs
3. Secrets are added through the Cloudflare dashboard or wrangler CLI
