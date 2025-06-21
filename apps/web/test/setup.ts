import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock IntersectionObserver
beforeEach(() => {
  const observerMap = new Map()
  const instanceMap = new Map()

  global.IntersectionObserver = vi.fn((callback, options) => {
    const instance = {
      observe: vi.fn((target: Element) => {
        instanceMap.set(target, instance)
        observerMap.set(target, { callback, options })
      }),
      unobserve: vi.fn((target: Element) => {
        instanceMap.delete(target)
        observerMap.delete(target)
      }),
      disconnect: vi.fn(() => {
        instanceMap.clear()
        observerMap.clear()
      }),
      takeRecords: vi.fn(() => []),
      root: null,
      rootMargin: '',
      thresholds: Array.isArray(options?.threshold) ? options.threshold : [options?.threshold ?? 0],
    }
    return instance
  }) as any

  // Helper to trigger intersection for testing
  ;(global as any).triggerIntersection = (target: Element, isIntersecting: boolean) => {
    const observerEntry = observerMap.get(target)
    if (observerEntry) {
      const entry = {
        target,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: {} as DOMRectReadOnly,
        time: Date.now(),
      }
      observerEntry.callback([entry], instanceMap.get(target))
    }
  }
})

afterEach(() => {
  ;(global.IntersectionObserver as any) = undefined
  ;(global as any).triggerIntersection = undefined
})

// Mock View Transitions API
beforeEach(() => {
  if (!document.startViewTransition) {
    document.startViewTransition = vi.fn((callback) => {
      const transition = {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: vi.fn(),
        types: new Set<string>(),
      }

      if (callback) {
        callback()
      }

      return transition
    }) as any
  }
})

afterEach(() => {
  if (document.startViewTransition) {
    vi.mocked(document.startViewTransition).mockRestore()
  }
})
