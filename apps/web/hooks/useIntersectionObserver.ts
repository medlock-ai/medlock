import { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverOptions {
  threshold?: number | number[]
  root?: Element | null
  rootMargin?: string
  freezeOnceVisible?: boolean
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLElement>, boolean] {
  const ref = useRef<HTMLElement>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isCurrentlyIntersecting = entry.isIntersecting

        if (options.freezeOnceVisible) {
          if (isCurrentlyIntersecting && !hasIntersected) {
            setHasIntersected(true)
            setIsIntersecting(true)
          }
        } else {
          setIsIntersecting(isCurrentlyIntersecting)
        }
      },
      {
        threshold: options.threshold ?? 0,
        root: options.root ?? null,
        rootMargin: options.rootMargin ?? '0px',
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [
    options.threshold,
    options.root,
    options.rootMargin,
    options.freezeOnceVisible,
    hasIntersected,
  ])

  return [
    ref as React.RefObject<HTMLElement>,
    options.freezeOnceVisible && hasIntersected ? true : isIntersecting,
  ]
}
