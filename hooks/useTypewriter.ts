import { useEffect, useState } from 'react'

export function useTypewriter(text: string, speed: number = 50) {
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    if (!text) return

    let currentIndex = 0
    setDisplayedText('')

    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText((prev) => prev + text[currentIndex])
        currentIndex++
      } else {
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return displayedText
}
