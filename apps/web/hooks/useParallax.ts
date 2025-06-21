import { useEffect, useRef, useState } from 'react'

interface UseParallaxOptions {
  speed?: number
  offset?: number
}

export function useParallax(speedOrOptions?: number | UseParallaxOptions) {
  const options: UseParallaxOptions =
    typeof speedOrOptions === 'number' ? { speed: speedOrOptions } : speedOrOptions || {}
  const ref = useRef<HTMLElement>(null)
  const [offset, setOffset] = useState(0)
  const speed = options.speed ?? 0.5
  const offsetValue = options.offset ?? 0

  useEffect(() => {
    const handleScroll = () => {
      const element = ref.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const scrollY = window.scrollY
      const elementTop = rect.top + scrollY
      const scrollOffset = scrollY - elementTop + window.innerHeight

      setOffset(scrollOffset * speed + offsetValue)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [speed, offsetValue])

  return ref as React.RefObject<HTMLDivElement>
}
