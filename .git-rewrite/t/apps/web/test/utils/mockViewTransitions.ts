export function mockViewTransitionsAPI() {
  if (!document.startViewTransition) {
    document.startViewTransition = (callback: () => void | Promise<void>) => {
      const transition = {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: () => {},
        types: new Set<string>(),
      }

      // Execute the callback
      Promise.resolve(callback()).then(() => {
        // Transition complete
      })

      return transition as ViewTransition
    }
  }
}
