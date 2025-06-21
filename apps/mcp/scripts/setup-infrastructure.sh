#!/bin/bash

# Setup infrastructure for MCP server
echo "Setting up Cloudflare infrastructure for MCP server..."

# Create KV namespaces
echo "Creating KV namespaces..."
TOKENS_KV_ID=$(npx wrangler kv namespace create "TOKENS" --preview=false | grep -oE '[a-f0-9]{32}' | head -1)
TOKENS_PREVIEW_ID=$(npx wrangler kv namespace create "TOKENS" --preview | grep -oE '[a-f0-9]{32}' | head -1)
AUDIT_KV_ID=$(npx wrangler kv namespace create "AUDIT" --preview=false | grep -oE '[a-f0-9]{32}' | head -1)
AUDIT_PREVIEW_ID=$(npx wrangler kv namespace create "AUDIT" --preview | grep -oE '[a-f0-9]{32}' | head -1)

echo "Created KV namespaces:"
echo "  TOKENS: $TOKENS_KV_ID (preview: $TOKENS_PREVIEW_ID)"
echo "  AUDIT: $AUDIT_KV_ID (preview: $AUDIT_PREVIEW_ID)"

# Update wrangler.jsonc with actual IDs
echo "Updating wrangler.jsonc with KV namespace IDs..."
sed -i.bak "s/PLACEHOLDER_TOKENS_KV_ID/$TOKENS_KV_ID/g" wrangler.jsonc
sed -i.bak "s/PLACEHOLDER_TOKENS_PREVIEW_ID/$TOKENS_PREVIEW_ID/g" wrangler.jsonc
sed -i.bak "s/PLACEHOLDER_AUDIT_KV_ID/$AUDIT_KV_ID/g" wrangler.jsonc
sed -i.bak "s/PLACEHOLDER_AUDIT_PREVIEW_ID/$AUDIT_PREVIEW_ID/g" wrangler.jsonc

# Clean up backup files
rm wrangler.jsonc.bak

echo "Infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "1. Set up OAuth secrets:"
echo "   npx wrangler secret put GITHUB_CLIENT_ID"
echo "   npx wrangler secret put GITHUB_CLIENT_SECRET"
echo "2. Deploy the worker:"
echo "   npx wrangler deploy -c wrangler.jsonc --env=''"