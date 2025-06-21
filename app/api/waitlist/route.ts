import { NextRequest, NextResponse } from 'next/server'
import type { CloudflareEnv, WaitlistEntry } from '@/types/cloudflare'

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Rate limit settings
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 3

export async function POST(request: NextRequest) {
  try {
    // Get Cloudflare bindings from request
    const env = (request as unknown as { env: CloudflareEnv }).env

    if (!env?.WAITLIST_KV) {
      console.error('KV namespace not available')
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Validate content type
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Parse request body
    let body
    try {
      const text = await request.text()
      if (!text) {
        return NextResponse.json(
          { error: 'Request body required' },
          {
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Content-Type': 'application/json',
            },
          }
        )
      }
      body = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Validate email
    const email = body.email?.trim().toLowerCase()
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Get client IP
    const ip =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      '127.0.0.1'

    // Check rate limit
    const rateLimitKey = `ratelimit:${ip}`
    const rateLimitData = await env.WAITLIST_KV.get(rateLimitKey)

    if (rateLimitData) {
      const attempts = parseInt(rateLimitData)
      if (attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please wait before trying again' },
          {
            status: 429,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Content-Type': 'application/json',
            },
          }
        )
      }
    }

    // Check if email already exists
    const existingEntry = await env.WAITLIST_KV.get(`waitlist:${email}`)
    if (existingEntry) {
      return NextResponse.json(
        { error: 'Email already registered on waitlist' },
        {
          status: 409,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Prepare entry data
    const timestamp = Date.now()
    const userAgent = request.headers.get('User-Agent') || undefined

    const entry: WaitlistEntry = {
      email,
      timestamp,
      ip,
      userAgent,
      source: 'website',
    }

    // Store in KV
    await env.WAITLIST_KV.put(`waitlist:${email}`, JSON.stringify(entry), {
      metadata: {
        timestamp,
        ip,
      },
    })

    // Update rate limit
    const currentAttempts = rateLimitData ? parseInt(rateLimitData) + 1 : 1
    await env.WAITLIST_KV.put(rateLimitKey, currentAttempts.toString(), {
      expirationTtl: Math.floor(RATE_LIMIT_WINDOW / 1000),
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully added to waitlist',
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Waitlist error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
