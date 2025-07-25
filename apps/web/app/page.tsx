'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { useParallax } from '@/hooks/useParallax'
import { useTypewriter } from '@/hooks/useTypewriter'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitCount, setSubmitCount] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Animation refs
  const [howItWorksRef, howItWorksVisible] = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  })
  const parallaxRef = useParallax(0.5)

  // Testimonial text
  const testimonialText =
    'I let ChatGPT compare my marathon training logs and sleep data, then got tweaks that shaved 4 minutes off my 10 K—yet everything stayed in my pod.'
  const displayedTestimonial = useTypewriter(testimonialText, 30)

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setSubmitStatus('error')
      setErrorMessage('Please enter a valid email')
      return
    }

    // Rate limiting check
    if (submitCount >= 5) {
      setSubmitStatus('error')
      setErrorMessage('Please wait before trying again')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setErrorMessage('You&apos;re already on the waitlist!')
        } else if (response.status === 429) {
          setErrorMessage('Please wait before trying again')
        } else {
          setErrorMessage(
            (data as { error?: string }).error || 'Something went wrong. Please try again.'
          )
        }
        setSubmitStatus('error')
      } else {
        setSubmitStatus('success')
        setEmail('')
        setSubmitCount((prev) => prev + 1)
      }
    } catch {
      setSubmitStatus('error')
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={`min-h-screen bg-[#090b0e] text-[#e9fcff] ${prefersReducedMotion ? '' : 'scroll-smooth'}`}
    >
      <style jsx global>{`
        :root {
          --c-bg: #090b0e;
          --c-accent: #35f6e2;
          --c-accent2: #65c4ff;
        }

        html {
          ${!prefersReducedMotion ? 'scroll-behavior: smooth;' : ''}
        }

        body {
          background: var(--c-bg);
          color: #e9fcff;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            sans-serif;
        }

        @keyframes gradient-flow {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes radialBurst {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(53, 246, 226, 0.7);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(53, 246, 226, 0);
          }
        }

        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes draw-path {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        .animate-gradient-flow {
          background-size: 200% 200%;
          animation: ${prefersReducedMotion ? 'none' : 'gradient-flow 8s ease infinite'};
        }

        .hero-burst-animation {
          animation: ${prefersReducedMotion ? 'none' : 'radialBurst 2s ease-out'};
        }

        .animate-pulse-glow {
          border-radius: 9999px;
          animation: ${prefersReducedMotion ? 'none' : 'pulse-glow 3s infinite'};
        }

        .animate-fade-in-up {
          animation: ${prefersReducedMotion ? 'none' : 'fade-in-up 0.6s ease-out forwards'};
        }

        .animate-draw-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: ${prefersReducedMotion ? 'none' : 'draw-path 1s ease-out forwards'};
        }

        .hover\\:scale-105:hover {
          transform: ${prefersReducedMotion ? 'none' : 'scale(1.05)'};
        }

        [data-animated='true'] {
          will-change: transform;
        }
      `}</style>

      <main aria-label="Medlock homepage">
        {/* Hero Section */}
        <header
          data-testid="hero-section"
          className="relative isolate overflow-hidden pt-14 pb-24 hero-burst-animation"
          style={{
            background: `
              radial-gradient(circle at center, transparent 0 35%, rgba(53, 246, 226, 0.03) 55%),
              repeating-conic-gradient(from 0deg, transparent 0deg 17deg, rgba(53, 246, 226, 0.07) 17deg 18deg)
            `,
          }}
        >
          {/* GitHub Link - Subtle button in top right */}
          <a
            href="https://github.com/medlock-ai/medlock"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-6 right-6 p-2 rounded-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 hover:border-slate-600/50 transition-all duration-200"
            aria-label="View Medlock on GitHub"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.419 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.455-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.071 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.349-1.086.635-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.165 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                clipRule="evenodd"
              />
            </svg>
          </a>

          <div
            ref={parallaxRef}
            data-parallax="hero"
            data-parallax-speed="0.5"
            className="relative z-10 max-w-5xl mx-auto px-6 text-center"
          >
            <h1
              className="font-['Space_Grotesk'] text-4xl sm:text-6xl leading-tight bg-gradient-to-r from-cyan-200 via-emerald-300 to-teal-400 bg-clip-text text-transparent animate-gradient-flow"
              style={{ backgroundImage: 'linear-gradient(90deg, #67e8f9, #34d399, #2dd4bf)' }}
            >
              Unlock AI insights
              <br />
              <span className="font-semibold">without unlocking</span>
              <br />
              your private health data
            </h1>

            <p className="mt-6 text-lg text-slate-300 max-w-2xl mx-auto">
              Medlock lets you team up your favorite model—ChatGPT, Claude, or tomorrow&apos;s
              wonder‑AI—with your health records <em>on your terms</em>. Because there&apos;s simply{' '}
              <strong>no good reason</strong> to hand any company permanent, all‑access rights to
              your most personal story.
            </p>

            <Link
              href="#join"
              className="inline-block mt-10 px-10 py-3 rounded-full font-semibold tracking-wide bg-[var(--c-accent)] text-slate-900 hover:bg-[var(--c-accent2)] transition focus:outline-none focus:ring-4 focus:ring-teal-400 animate-pulse-glow"
            >
              Reserve My Pod
            </Link>
          </div>
        </header>

        {/* How It Works Section */}
        <section
          ref={howItWorksRef}
          data-testid="how-it-works"
          className={`py-24 transition-all duration-1000 ${
            howItWorksVisible ? 'opacity-100 animate-in' : 'opacity-0'
          }`}
        >
          <div
            data-testid="how-it-works-grid"
            className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 px-6 text-center"
          >
            {[
              {
                step: 1,
                title: 'Keep It Yours',
                description:
                  'Drop every metric—steps, meds, labs—into a Solid Pod encrypted with your keys. We never store a copy, and nothing moves unless you say so.',
              },
              {
                step: 2,
                title: 'Share Precisely',
                description:
                  'One chat request = one short‑lived, signed link. You can approve automatically, ask each time, or revoke in one tap.',
              },
              {
                step: 3,
                title: 'Enjoy the Edge',
                description:
                  "Your model gets the context it needs to coach, predict, and inspire—with zero long‑term custody of your life's data.",
              },
            ].map((item, index) => (
              <article
                key={item.step}
                aria-label={`Step ${item.step}`}
                className="group relative p-6 rounded-lg transition-all duration-300 hover:scale-105 animate-fade-in-up"
                style={{
                  animationDelay: `${index * 200}ms`,
                  transform: 'perspective(1000px)',
                }}
                onMouseEnter={(e) => {
                  if (!prefersReducedMotion) {
                    e.currentTarget.style.transform = 'perspective(1000px) rotateY(5deg)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!prefersReducedMotion) {
                    e.currentTarget.style.transform = 'perspective(1000px) rotateY(0deg)'
                  }
                }}
                data-animated="true"
              >
                <h2 className="font-['Space_Grotesk'] text-xl mb-3 text-[var(--c-accent)]">
                  {item.step} · {item.title}
                </h2>
                <p className="text-slate-300">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="py-20 bg-[#0f1116]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <svg
              data-testid="checkmark-svg"
              viewBox="0 0 36 36"
              className="mx-auto w-10 h-10 mb-4 animate-draw-path"
              aria-hidden="true"
            >
              <path
                d="M13.09 25.768l-7.021-7.02 2.216-2.217 4.805 4.804L27.715 6.71l2.217 2.217z"
                fill="none"
                stroke="var(--c-accent)"
                strokeWidth="2"
                strokeDasharray="100"
                strokeDashoffset="100"
              />
            </svg>
            <p
              data-testid="testimonial-text"
              data-full-text={testimonialText}
              className="italic text-slate-300 text-lg"
            >
              &quot;{displayedTestimonial}&quot;
            </p>
            <p className="mt-4 text-slate-500">— Early‑access runner #12</p>
          </div>
        </section>

        {/* CTA Section */}
        <section id="join" className="py-28">
          <div className="max-w-md mx-auto text-center px-6">
            <h3 className="font-['Space_Grotesk'] text-2xl mb-6 text-[var(--c-accent)]">
              Beta opens soon. Bring your data, keep your privacy.
            </h3>
            <form onSubmit={handleSubmit} aria-label="Join waitlist" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  type="text"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  className="appearance-none flex-1 bg-[#13171c] border border-slate-700 rounded-full px-5 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-[var(--c-accent)] hover:bg-[var(--c-accent2)] text-slate-900 font-semibold px-7 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding...' : 'Request Invite →'}
                </button>
              </div>

              {/* Status messages */}
              <div role="status" aria-live="polite" className="h-5">
                {submitStatus === 'success' && (
                  <p className="text-green-400 text-sm">
                    You&apos;re on the list! We&apos;ll email you when beta opens.
                  </p>
                )}

                {submitStatus === 'error' && <p className="text-red-400 text-sm">{errorMessage}</p>}
              </div>
            </form>
            <p className="mt-3 text-xs text-slate-500">
              No spam, no hidden trackers, no fine print. Ever.
            </p>
          </div>
        </section>

        <footer className="py-10 text-center text-xs text-slate-500">
          © 2025 Medlock • Your data, your decisions.
        </footer>
      </main>

      {/* Lazy loaded content markers */}
      <img data-lazy="true" loading="lazy" src="data:," alt="" className="hidden" />
      <iframe data-lazy="true" loading="lazy" src="about:blank" className="hidden" />
    </div>
  )
}
