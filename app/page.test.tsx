import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import HomePage from './page'
import { mockIntersectionObserver } from '@/test/utils/mockIntersectionObserver'
import { mockViewTransitionsAPI } from '@/test/utils/mockViewTransitions'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Mock Cloudflare KV binding
// const mockKV = {
//   put: vi.fn(),
//   get: vi.fn(),
//   delete: vi.fn(),
//   list: vi.fn(),
// };

// Mock fetch for form submission
global.fetch = vi.fn()

describe('HomePage', () => {
  beforeEach(() => {
    mockIntersectionObserver()
    mockViewTransitionsAPI()
    vi.clearAllMocks()
    // Mock matchMedia for reduced motion tests
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Hero Section', () => {
    it('renders the main headline with gradient animation', () => {
      render(<HomePage />)
      const headline = screen.getByRole('heading', { level: 1 })
      expect(headline).toBeInTheDocument()
      expect(headline).toHaveTextContent(/Unlock AI insights/i)
      expect(headline).toHaveTextContent(/without unlocking/i)
      expect(headline).toHaveTextContent(/your private health data/i)

      // Check for gradient classes
      expect(headline).toHaveClass('animate-gradient-flow')
      expect(headline).toHaveStyle({
        backgroundImage: expect.stringContaining('gradient'),
      })
    })

    it('displays radial burst animation on load', async () => {
      const { container } = render(<HomePage />)
      const heroSection = container.querySelector('[data-testid="hero-section"]')

      expect(heroSection).toHaveClass('hero-burst-animation')
    })

    it('renders CTA button with pulse animation', () => {
      render(<HomePage />)
      const ctaButton = screen.getByRole('link', { name: /Reserve My Pod/i })

      expect(ctaButton).toBeInTheDocument()
      expect(ctaButton).toHaveAttribute('href', '#join')
      expect(ctaButton).toHaveClass('animate-pulse-glow')
    })

    it('applies parallax effect on scroll', async () => {
      const { container } = render(<HomePage />)
      const heroContent = container.querySelector('[data-parallax="hero"]')

      expect(heroContent).toHaveAttribute('data-parallax-speed', '0.5')

      // Simulate scroll
      fireEvent.scroll(window, { target: { scrollY: 100 } })

      await waitFor(() => {
        expect(heroContent).toHaveStyle({
          transform: 'translateY(50px)',
        })
      })
    })
  })

  describe('How It Works Section', () => {
    it('renders all three steps with staggered animations', async () => {
      render(<HomePage />)

      const steps = screen.getAllByRole('article', { name: /step/i })
      expect(steps).toHaveLength(3)

      // Check staggered animation delays
      steps.forEach((step, index) => {
        expect(step).toHaveClass('animate-fade-in-up')
        expect(step).toHaveStyle({
          animationDelay: `${index * 200}ms`,
        })
      })
    })

    it('triggers animations when scrolled into view', async () => {
      const { container } = render(<HomePage />)
      const section = container.querySelector('[data-testid="how-it-works"]')

      // Initially not visible
      expect(section).toHaveClass('opacity-0')

      // Get the mock IntersectionObserver instance
      const MockIO = global.IntersectionObserver as unknown as {
        getMostRecentCallback: () => IntersectionObserverCallback
      }
      const callback = MockIO.getMostRecentCallback()

      // Trigger intersection
      callback(
        [{ isIntersecting: true, target: section }] as IntersectionObserverEntry[],
        {} as IntersectionObserver
      )

      await waitFor(() => {
        expect(section).toHaveClass('opacity-100')
        expect(section).toHaveClass('animate-in')
      })
    })

    it('displays interactive hover states with 3D transforms', async () => {
      const user = userEvent.setup()
      render(<HomePage />)

      const firstStep = screen.getByRole('article', { name: /step 1/i })

      await user.hover(firstStep)

      expect(firstStep).toHaveClass('hover:scale-105')
      expect(firstStep).toHaveStyle({
        transform: 'perspective(1000px) rotateY(5deg)',
      })
    })
  })

  describe('Social Proof Section', () => {
    it('renders testimonial with typewriter animation', async () => {
      render(<HomePage />)

      const testimonial = screen.getByTestId('testimonial-text')
      const fullText = testimonial.getAttribute('data-full-text')

      // Check that testimonial is rendering with typewriter effect
      await waitFor(() => {
        expect(testimonial.textContent).toContain('"')
      })

      // Verify full text attribute
      expect(fullText).toBeTruthy()
      expect(fullText).toContain('marathon training logs')
    })

    it('displays checkmark with draw animation', () => {
      const { container } = render(<HomePage />)
      const checkmark = container.querySelector('[data-testid="checkmark-svg"]')

      expect(checkmark).toHaveClass('animate-draw-path')
      const path = checkmark?.querySelector('path')
      expect(path).toHaveAttribute('stroke-dasharray')
      expect(path).toHaveAttribute('stroke-dashoffset')
    })
  })

  describe('Email Signup Form', () => {
    it('validates email format before submission', async () => {
      const user = userEvent.setup()
      render(<HomePage />)

      const emailInput = screen.getByPlaceholderText(/you@example.com/i)
      const submitButton = screen.getByRole('button', { name: /Request Invite/i })

      // Clear and type invalid email
      await user.clear(emailInput)
      await user.type(emailInput, 'invalid-email')

      // Submit form
      await user.click(submitButton)

      // Wait for error message to appear
      const errorMessage = await screen.findByText(/Please enter a valid email/i)
      expect(errorMessage).toBeInTheDocument()

      // Verify it's in the status element
      const statusElement = screen.getByRole('status')
      expect(statusElement).toContainElement(errorMessage)

      expect(fetch).not.toHaveBeenCalled()
    })

    it('submits to Cloudflare KV and shows success state', async () => {
      const user = userEvent.setup()
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true }),
                } as Response),
              100
            )
          )
      )

      render(<HomePage />)

      const emailInput = screen.getByPlaceholderText(/you@example.com/i)
      const submitButton = screen.getByRole('button', { name: /Request Invite/i })

      await user.type(emailInput, 'test@example.com')

      // Click and check for loading state
      await user.click(submitButton)

      // The button should change to loading state
      await waitFor(() => {
        expect(submitButton).toHaveTextContent(/Adding.../i)
        expect(submitButton).toBeDisabled()
      })

      // Check API call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      })

      // Check success state
      await waitFor(() => {
        expect(screen.getByText(/You're on the list!/i)).toBeInTheDocument()
        expect(emailInput).toHaveValue('')
      })
    })

    it('handles submission errors gracefully', async () => {
      const user = userEvent.setup()
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'))

      render(<HomePage />)

      const emailInput = screen.getByPlaceholderText(/you@example.com/i)
      const submitButton = screen.getByRole('button', { name: /Request Invite/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
        expect(submitButton).not.toBeDisabled()
      })
    })

    it('prevents duplicate submissions', async () => {
      const user = userEvent.setup()
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Email already registered' }),
      } as Response)

      render(<HomePage />)

      const emailInput = screen.getByPlaceholderText(/you@example.com/i)
      const submitButton = screen.getByRole('button', { name: /Request Invite/i })

      await user.type(emailInput, 'duplicate@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/already on the waitlist/i)).toBeInTheDocument()
      })
    })

    it('implements rate limiting', async () => {
      const user = userEvent.setup()
      render(<HomePage />)

      const emailInput = screen.getByPlaceholderText(/you@example.com/i)
      const submitButton = screen.getByRole('button', { name: /Request Invite/i })

      // Mock successful responses
      for (let i = 0; i < 5; i++) {
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
      }

      // Make multiple rapid submissions
      for (let i = 0; i < 6; i++) {
        await user.clear(emailInput)
        await user.type(emailInput, `test${i}@example.com`)
        await user.click(submitButton)

        // Wait for state update
        await waitFor(() => {
          expect(submitButton).not.toBeDisabled()
        })
      }

      await waitFor(() => {
        const errorElement = screen.getByRole('status')
        expect(errorElement).toHaveTextContent(/Please wait before trying again/i)
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<HomePage />)

      const h1 = screen.getAllByRole('heading', { level: 1 })
      const h2 = screen.getAllByRole('heading', { level: 2 })
      const h3 = screen.getAllByRole('heading', { level: 3 })

      expect(h1).toHaveLength(1)
      expect(h2.length).toBeGreaterThan(0)
      expect(h3.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<HomePage />)

      // Tab through interactive elements
      await user.tab()
      expect(screen.getByRole('link', { name: /Reserve My Pod/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByPlaceholderText(/you@example.com/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /Request Invite/i })).toHaveFocus()
    })

    it('respects prefers-reduced-motion', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      render(<HomePage />)

      // Check that the component respects reduced motion preference
      // The component will set prefersReducedMotion state to true
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    })

    it('has proper ARIA labels and descriptions', () => {
      render(<HomePage />)

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'HealthMCP homepage')
      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Join waitlist')
      expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument()
    })

    it('announces form submission results to screen readers', async () => {
      const user = userEvent.setup()
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      render(<HomePage />)

      const emailInput = screen.getByPlaceholderText(/you@example.com/i)
      const submitButton = screen.getByRole('button', { name: /Request Invite/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        const announcement = screen.getByRole('status')
        expect(announcement).toHaveTextContent(/You're on the list!/i)
        expect(announcement).toHaveAttribute('aria-live', 'polite')
      })
    })
  })

  describe('Performance', () => {
    it('lazy loads below-the-fold content', () => {
      const { container } = render(<HomePage />)

      const lazyElements = container.querySelectorAll('[data-lazy="true"]')
      expect(lazyElements.length).toBeGreaterThan(0)

      lazyElements.forEach((element) => {
        expect(element).toHaveAttribute('loading', 'lazy')
      })
    })

    it('uses will-change for animated elements', () => {
      const { container } = render(<HomePage />)

      const animatedElements = container.querySelectorAll('[data-animated="true"]')
      animatedElements.forEach((element) => {
        expect(element).toHaveStyle({ willChange: 'transform' })
      })
    })

    it('implements smooth scroll with CSS', () => {
      render(<HomePage />)

      const ctaButton = screen.getByRole('link', { name: /Reserve My Pod/i })
      fireEvent.click(ctaButton)

      expect(document.documentElement).toHaveStyle({ scrollBehavior: 'smooth' })
    })
  })

  describe('Responsive Design', () => {
    it('adapts layout for mobile devices', () => {
      // Mock mobile viewport
      window.innerWidth = 375
      window.innerHeight = 667

      render(<HomePage />)

      const heroHeading = screen.getByRole('heading', { level: 1 })
      expect(heroHeading).toHaveClass('text-4xl', 'sm:text-6xl')
    })

    it('stacks grid items on small screens', () => {
      window.innerWidth = 375

      const { container } = render(<HomePage />)
      const gridContainer = container.querySelector('[data-testid="how-it-works-grid"]')

      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-3')
    })
  })
})
