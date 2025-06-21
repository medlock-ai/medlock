import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import type { CloudflareEnv } from '@/types/cloudflare'

// Mock the getCloudflareContext function
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}))

// Mock KV namespace
const mockKV = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  getWithMetadata: vi.fn(),
}

// Import getCloudflareContext to get proper typing
import { getCloudflareContext } from '@opennextjs/cloudflare'

// Mock request
const createMockRequest = (body: unknown) => {
  return new Request('http://localhost:3000/api/waitlist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '127.0.0.1',
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('Waitlist API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock getCloudflareContext to return our mock KV
    const mockGetCloudflareContext = vi.mocked(getCloudflareContext)
    mockGetCloudflareContext.mockReturnValue({
      env: {
        WAITLIST_KV: mockKV,
      } as CloudflareEnv,
      cf: {},
      ctx: {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      },
    } as ReturnType<typeof getCloudflareContext>)
  })

  describe('POST /api/waitlist', () => {
    it('validates email format', async () => {
      const invalidEmails = [
        '',
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
      ]

      for (const email of invalidEmails) {
        const request = createMockRequest({ email })
        const response = await POST(request)

        expect(response.status).toBe(400)
        const data = (await response.json()) as { error: string }
        expect(data.error).toMatch(/invalid email/i)
        expect(mockKV.put).not.toHaveBeenCalled()
      }
    })

    it('successfully adds new email to waitlist', async () => {
      const email = 'test@example.com'
      mockKV.get.mockResolvedValueOnce(null) // Email doesn't exist
      mockKV.put.mockResolvedValueOnce(undefined)

      const request = createMockRequest({ email })
      const response = await POST(request)

      expect(response.status).toBe(200)
      const data = (await response.json()) as { success: boolean; message: string }
      expect(data.success).toBe(true)
      expect(data.message).toMatch(/added to waitlist/i)

      // Verify KV operations
      expect(mockKV.get).toHaveBeenCalledWith(`waitlist:${email}`)
      expect(mockKV.put).toHaveBeenCalledWith(
        `waitlist:${email}`,
        expect.stringContaining(email),
        expect.objectContaining({
          metadata: expect.objectContaining({
            timestamp: expect.any(Number),
            ip: '127.0.0.1',
          }),
        })
      )
    })

    it('prevents duplicate email submissions', async () => {
      const email = 'existing@example.com'
      mockKV.get.mockImplementation((key: string) => {
        if (key === `waitlist:${email}`) {
          return Promise.resolve('existing-data') // Email exists
        }
        return Promise.resolve(null)
      })

      const request = createMockRequest({ email })
      const response = await POST(request)

      expect(response.status).toBe(409)
      const data = (await response.json()) as { error: string }
      expect(data.error).toMatch(/already registered/i)
      expect(mockKV.put).not.toHaveBeenCalledWith(
        expect.stringContaining('waitlist:'),
        expect.anything(),
        expect.anything()
      )
    })

    it('implements rate limiting per IP', async () => {
      const email = 'ratelimit@example.com'
      const ip = '192.168.1.1'

      // Mock rate limit check
      mockKV.get.mockImplementation((key: string) => {
        if (key.startsWith('ratelimit:')) {
          return Promise.resolve('5') // 5 attempts already
        }
        return Promise.resolve(null)
      })

      const request = new Request('http://localhost:3000/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': ip,
        },
        body: JSON.stringify({ email }),
      }) as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(429)
      const data = (await response.json()) as { error: string }
      expect(data.error).toMatch(/rate limit/i)
      expect(mockKV.put).not.toHaveBeenCalledWith(
        expect.stringContaining('waitlist:'),
        expect.anything(),
        expect.anything()
      )
    })

    it('stores metadata with submission', async () => {
      const email = 'metadata@example.com'
      const ip = '10.0.0.1'
      const userAgent = 'Mozilla/5.0 Test Browser'

      mockKV.get.mockResolvedValueOnce(null)
      mockKV.put.mockResolvedValueOnce(undefined)

      const request = new Request('http://localhost:3000/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': ip,
          'User-Agent': userAgent,
        },
        body: JSON.stringify({ email }),
      }) as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockKV.put).toHaveBeenCalledWith(
        `waitlist:${email}`,
        expect.stringContaining(email),
        expect.objectContaining({
          metadata: expect.objectContaining({
            timestamp: expect.any(Number),
            ip,
          }),
        })
      )
    })

    it('handles KV storage errors gracefully', async () => {
      const email = 'error@example.com'
      mockKV.get.mockRejectedValueOnce(new Error('KV connection error'))

      const request = createMockRequest({ email })
      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = (await response.json()) as { error: string }
      expect(data.error).toMatch(/internal server error/i)
    })

    it('implements CORS headers', async () => {
      const request = createMockRequest({ email: 'cors@example.com' })
      mockKV.get.mockResolvedValueOnce(null)
      mockKV.put.mockResolvedValueOnce(undefined)

      const response = await POST(request)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('validates request content type', async () => {
      const request = new Request('http://localhost:3000/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'not json',
      }) as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = (await response.json()) as { error: string }
      expect(data.error).toMatch(/invalid content type/i)
    })

    it('handles missing request body', async () => {
      const request = new Request('http://localhost:3000/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }) as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = (await response.json()) as { error: string }
      expect(data.error).toMatch(/request body required/i)
    })

    it('trims and normalizes email addresses', async () => {
      const email = '  TEST@EXAMPLE.COM  '
      const normalizedEmail = 'test@example.com'

      mockKV.get.mockResolvedValueOnce(null)
      mockKV.put.mockResolvedValueOnce(undefined)

      const request = createMockRequest({ email })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockKV.get).toHaveBeenCalledWith(`waitlist:${normalizedEmail}`)
      expect(mockKV.put).toHaveBeenCalledWith(
        `waitlist:${normalizedEmail}`,
        expect.stringContaining(normalizedEmail),
        expect.anything()
      )
    })

    it('handles missing Cloudflare context gracefully', async () => {
      const mockGetCloudflareContext = vi.mocked(getCloudflareContext)
      mockGetCloudflareContext.mockReturnValueOnce({
        env: {} as CloudflareEnv, // No WAITLIST_KV
        cf: {},
        ctx: {
          waitUntil: vi.fn(),
          passThroughOnException: vi.fn(),
        },
      } as ReturnType<typeof getCloudflareContext>)

      const request = createMockRequest({ email: 'test@example.com' })
      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe('Internal server error')
    })

    it('handles getCloudflareContext throwing error', async () => {
      const mockGetCloudflareContext = vi.mocked(getCloudflareContext)
      mockGetCloudflareContext.mockImplementationOnce(() => {
        throw new Error('Context not available')
      })

      const request = createMockRequest({ email: 'test@example.com' })
      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe('Internal server error')
    })
  })
})
