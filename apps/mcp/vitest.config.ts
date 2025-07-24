import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    globals: true,
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['ajv'],
        },
      },
    },
    poolOptions: {
      workers: {
        main: './src/index.ts',
        isolatedStorage: false,
        miniflare: {
          compatibilityDate: '2024-01-21',
          compatibilityFlags: ['nodejs_compat', 'rpc'],
          bindings: {
            MCP_VERSION: 'v0.1.0-test',
            ALLOWED_ORIGINS: 'https://your-domain.com',
            SOLID_POD_DOMAIN: 'storage.solidpod.com',
            GITHUB_CLIENT_ID: 'test-client-id',
            GITHUB_CLIENT_SECRET: 'test-client-secret',
            SOLID_SIGNING_KEY: 'test-signing-key-32-chars-minimum',
          },
          kvNamespaces: {
            TOKENS: 'TOKENS',
            AUDIT: 'AUDIT',
          },
          durableObjects: {
            RATE_LIMITER: 'RateLimiter',
            MCP_AGENT: {
              className: 'MedlockMcpAgent',
              useSQLite: true,
            },
          },
        },
      },
    },
    setupFiles: ['./test/setup.ts'],
    // Disable coverage as node:inspector is not available in Workers
    coverage: {
      enabled: false,
    },
  },
})
