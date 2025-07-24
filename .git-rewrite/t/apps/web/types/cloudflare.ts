// Cloudflare environment types
export interface CloudflareEnv {
  WAITLIST_KV?: KVNamespace
  NEXTJS_ENV?: string
  ASSETS?: Fetcher
}

// Waitlist entry type
export interface WaitlistEntry {
  email: string
  timestamp: number
  source?: string
  ip?: string
  userAgent?: string
}

// Rate limit data type
export interface RateLimitData {
  count: number
  firstAttempt: number
}
