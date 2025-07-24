import { Context, Next } from 'hono'
import type { Bindings } from '../types'

export async function rateLimitMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const userId = c.get('userId')

  if (!userId) {
    // No user ID means not authenticated, skip rate limiting
    return next()
  }

  try {
    // Get Durable Object instance for this user
    const id = c.env.RATE_LIMITER.idFromName(userId)
    const rateLimiter = c.env.RATE_LIMITER.get(id)

    // Check rate limit
    const response = await rateLimiter.fetch(
      new Request(`https://rate-limiter.local/check?userId=${userId}`)
    )

    const result = (await response.json()) as {
      allowed: boolean
      remaining: number
      resetAt: number
    }

    // Add rate limit headers to response
    c.header('X-RateLimit-Limit', '3')
    c.header('X-RateLimit-Remaining', result.remaining.toString())
    c.header('X-RateLimit-Reset', result.resetAt.toString())

    if (!result.allowed) {
      return c.json({ error: 'Rate limit exceeded' }, 429)
    }

    await next()
  } catch (error) {
    // If rate limiter fails, log error but allow request
    console.error('Rate limiter error:', error)
    await next()
  }
}
