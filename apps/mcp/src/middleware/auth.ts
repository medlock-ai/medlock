import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings, SessionData } from '../types'

export async function authMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
): Promise<Response | void> {
  // Check for session cookie
  const sessionCookie = getCookie(c, 'hc_session')

  // Also check for Bearer token (for API access)
  const authHeader = c.req.header('Authorization')
  let sessionId: string | null = null

  if (sessionCookie) {
    sessionId = sessionCookie
  } else if (authHeader?.startsWith('Bearer ')) {
    sessionId = authHeader.substring(7)
  }

  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Retrieve session from KV
  const sessionData = await c.env.TOKENS.get(`session:${sessionId}`)
  if (!sessionData) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  const session: SessionData = JSON.parse(sessionData)

  // Check if session is expired
  if (session.expiresAt < Date.now()) {
    await c.env.TOKENS.delete(`session:${sessionId}`)
    return c.json({ error: 'Session expired' }, 401)
  }

  // Add session to context
  c.set('session', session)
  c.set('userId', session.userId)

  await next()
}

// Validate session format and signature
export function validateSessionFormat(sessionId: string): boolean {
  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(sessionId)
}
