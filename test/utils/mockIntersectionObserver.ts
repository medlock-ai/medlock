export function mockIntersectionObserver() {
  const callbacks: IntersectionObserverCallback[] = []

  class MockIntersectionObserver {
    callback: IntersectionObserverCallback

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
      callbacks.push(callback)
    }

    observe() {
      // Mock implementation
    }

    unobserve() {
      // Mock implementation
    }

    disconnect() {
      // Mock implementation
    }
  }

  // Add a way to get the most recent callback for testing
  ;(
    MockIntersectionObserver as unknown as {
      getMostRecentCallback: () => IntersectionObserverCallback
    }
  ).getMostRecentCallback = () => callbacks[callbacks.length - 1]

  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

  return MockIntersectionObserver
}
