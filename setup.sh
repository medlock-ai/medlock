#!/bin/bash

echo "🚀 Medlock Setup Script"
echo "======================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi

if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn not found. Installing..."
    corepack enable
    corepack prepare yarn@4.9.2 --activate
fi

if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. It will be installed with dependencies."
fi

echo "✅ Prerequisites check complete"
echo ""

# Install dependencies
echo "Installing dependencies..."
yarn install
echo ""

# Setup KV namespaces
echo "Setting up Cloudflare KV namespaces..."
echo "Please make sure you're logged in to Wrangler (wrangler login)"
echo ""

cd apps/mcp
echo "Creating MCP KV namespaces..."
wrangler kv namespace create TOKENS
wrangler kv namespace create AUDIT
echo ""

cd ../web
echo "Creating Web KV namespaces..."
wrangler kv namespace create WAITLIST_KV
echo ""

cd ../..

echo ""
echo "📝 Next steps:"
echo "1. Update wrangler.jsonc files with your KV namespace IDs"
echo "2. Set up secrets using wrangler secret put:"
echo "   - GITHUB_CLIENT_ID"
echo "   - GITHUB_CLIENT_SECRET"
echo "   - SOLID_SIGNING_KEY"
echo "   - METRICS_KEY"
echo "3. Update domain configurations in wrangler.jsonc files"
echo "4. Run 'yarn dev' to start development"
echo ""
echo "✅ Setup complete!"