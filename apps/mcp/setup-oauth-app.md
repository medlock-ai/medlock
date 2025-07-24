# Setting up GitHub OAuth App for HealthMCP

**Note**: GitHub OAuth Apps cannot be created programmatically via API. They must be created manually through the GitHub web interface.

## Instructions

1. Go to GitHub Settings:

   - Navigate to https://github.com/settings/developers
   - Or go to Settings → Developer settings → OAuth Apps

2. Click "New OAuth App"

3. Fill in the application details:

   - **Application name**: HealthMCP Development
   - **Homepage URL**: https://your-domain.com
   - **Application description**: Health monitoring MCP server with Solid Pod integration
   - **Authorization callback URLs**:
     - https://api.your-domain.com/auth/callback
     - http://localhost:8787/auth/callback

4. Click "Register application"

5. After creating the app, you'll see:

   - **Client ID**: Copy this value
   - **Client Secret**: Click "Generate a new client secret" and copy the value

6. Update your Cloudflare Worker environment variables:

   ```bash
   # For local development, add to .dev.vars:
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here

   # For production, set via wrangler:
   npx wrangler secret put GITHUB_CLIENT_ID
   # (Enter the client ID when prompted)

   npx wrangler secret put GITHUB_CLIENT_SECRET
   # (Enter the client secret when prompted)

   # Note: These commands will create a new version and deploy immediately.
   # For gradual deployments (Wrangler 3.73.0+), use:
   # npx wrangler versions secret put GITHUB_CLIENT_ID
   # npx wrangler versions secret put GITHUB_CLIENT_SECRET
   ```

## Testing the OAuth Flow

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Visit http://localhost:8787/auth/login

3. You should be redirected to GitHub for authorization

4. After authorizing, you'll be redirected back to the callback URL

## Production Deployment

Before deploying to production:

1. Ensure the production domain is correctly set in the OAuth app settings
2. Update the callback URLs if your production domain differs
3. Set the secrets in Cloudflare:

   ```bash
   # Run each command and enter the value when prompted:
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET

   # Alternative: List all secrets to verify they're set
   npx wrangler secret list
   ```

## Security Notes

- Never commit the client secret to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your client secret
- Consider implementing additional security measures like state parameter validation
