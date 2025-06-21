import { useEffect, useState } from 'react'

interface UseTypewriterOptions {
  words?: string[]
  typeSpeed?: number
  deleteSpeed?: number
  delaySpeed?: number
}

export function useTypewriter(text: string, typeSpeed?: number): string
export function useTypewriter(options: UseTypewriterOptions): string
export function useTypewriter(
  textOrOptions: string | UseTypewriterOptions,
  typeSpeed?: number
): string {
  let options: UseTypewriterOptions

  if (typeof textOrOptions === 'string') {
    options = {
      words: [textOrOptions],
      typeSpeed: typeSpeed ?? 130,
      deleteSpeed: 0,
      delaySpeed: 0,
    }
  } else {
    options = textOrOptions
  }

  const { words = [], typeSpeed: speed = 130, deleteSpeed = 100, delaySpeed = 2000 } = options
  const [text, setText] = useState('')
  const [wordIndex, setWordIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!words.length) return

    // For single word mode (string input), just type it out once
    if (words.length === 1 && deleteSpeed === 0) {
      const currentWord = words[0]
      if (text.length < currentWord.length) {
        const timer = setTimeout(() => {
          setText(currentWord.substring(0, text.length + 1))
        }, speed)
        return () => clearTimeout(timer)
      }
      return
    }

    const currentWord = words[wordIndex]
    const timer = setTimeout(
      () => {
        if (!isDeleting) {
          setText(currentWord.substring(0, text.length + 1))

          if (text === currentWord) {
            setTimeout(() => setIsDeleting(true), delaySpeed)
            return
          }
        } else {
          setText(currentWord.substring(0, text.length - 1))

          if (text === '') {
            setIsDeleting(false)
            setWordIndex((prev) => (prev + 1) % words.length)
          }
        }
      },
      isDeleting ? deleteSpeed : speed
    )

    return () => clearTimeout(timer)
  }, [text, wordIndex, isDeleting, words, speed, deleteSpeed, delaySpeed])

  return text
}
