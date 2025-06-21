import { useEffect, useRef, useState } from 'react'

export function useParallax(speed: number = 0.5) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      if (!elementRef.current) return

      const scrolled = window.scrollY
      const parallaxOffset = scrolled * speed
      setOffset(parallaxOffset)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed])

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.style.transform = `translateY(${offset}px)`
    }
  }, [offset])

  return elementRef
}
