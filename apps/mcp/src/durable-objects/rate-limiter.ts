import type { DurableObjectState } from '@cloudflare/workers-types'

export class RateLimiter {
  private state: DurableObjectState
  private requests: Map<string, number[]> = new Map()

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get current time in seconds
    const now = Math.floor(Date.now() / 1000)
    const windowSize = 1 // 1 second window
    const maxRequests = 3 // 3 requests per second

    // Get user's request history
    const userRequests = this.requests.get(userId) || []

    // Filter out requests older than the window
    const recentRequests = userRequests.filter((timestamp) => timestamp > now - windowSize)

    // Check if rate limit exceeded
    if (recentRequests.length >= maxRequests) {
      return new Response(
        JSON.stringify({
          allowed: false,
          remaining: 0,
          resetAt: now + windowSize,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (now + windowSize).toString(),
          },
        }
      )
    }

    // Add current request
    recentRequests.push(now)
    this.requests.set(userId, recentRequests)

    // Clean up old entries periodically
    if (Math.random() < 0.1) {
      // 10% chance
      this.cleanup()
    }

    const remaining = maxRequests - recentRequests.length

    return new Response(
      JSON.stringify({
        allowed: true,
        remaining,
        resetAt: now + windowSize,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': (now + windowSize).toString(),
        },
      }
    )
  }

  private cleanup() {
    const now = Math.floor(Date.now() / 1000)
    const windowSize = 1

    // Remove users with no recent requests
    for (const [userId, requests] of this.requests.entries()) {
      const recentRequests = requests.filter((timestamp) => timestamp > now - windowSize)
      if (recentRequests.length === 0) {
        this.requests.delete(userId)
      } else {
        this.requests.set(userId, recentRequests)
      }
    }
  }
}
