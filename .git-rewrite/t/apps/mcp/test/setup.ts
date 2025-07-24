import { beforeAll, afterEach, vi } from 'vitest'

// Fix for yargs/wrangler issue
global.process = global.process || {}
global.process.stdout = global.process.stdout || { columns: 80 }

// Set up test environment
beforeAll(() => {
  // Keep console methods for debugging
  // global.console = {
  //   ...console,
  //   log: vi.fn(),
  //   error: vi.fn(),
  //   warn: vi.fn(),
  //   info: vi.fn(),
  //   debug: vi.fn(),
  // }

  // Mock crypto for consistent test results
  global.crypto = {
    ...crypto,
    randomUUID: () =>
      `test-uuid-${Math.random().toString(36).substring(7)}` as `${string}-${string}-${string}-${string}-${string}`,
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      // Simple mock for testing
      if (array && 'length' in array) {
        const len = (array as any).length as number
        for (let i = 0; i < len; i++) {
          ;(array as any)[i] = Math.floor(Math.random() * 256)
        }
      }
      return array
    },
    subtle: {
      ...crypto.subtle,
      digestSync: (algorithm: string, data: ArrayBuffer) => {
        // Simple mock for testing
        const hash = new Uint8Array(32)
        for (let i = 0; i < 32; i++) {
          hash[i] = i
        }
        return hash.buffer
      },
    } as any,
  }

  // Set consistent test time
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-21T10:00:00Z'))

  // Disable rate limiting for tests
  process.env.DISABLE_RATE_LIMIT = 'true'
})

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})
