export interface CloudflareEnv {
  WAITLIST_KV: KVNamespace
}

export interface WaitlistEntry {
  email: string
  timestamp: number
  ip: string
  userAgent?: string
  source: string
}

export interface WaitlistMetadata {
  timestamp: number
  ip: string
}
