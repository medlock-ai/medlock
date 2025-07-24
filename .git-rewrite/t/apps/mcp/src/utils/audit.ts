import type { Bindings } from '../types'

export function createAuditLogger(env: Bindings, userId: string) {
  return async (action: string, details: any) => {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      action,
      ...details,
    }

    await env.AUDIT.put(
      `audit:${entry.id}`,
      JSON.stringify(entry),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    )
  }
}
