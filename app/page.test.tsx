import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

describe('Home Page', () => {
  it('renders the Next.js logo', () => {
    render(<Home />)
    const logo = screen.getByAltText('Next.js logo')
    expect(logo).toBeInTheDocument()
  })

  it('renders the deploy button with correct link', () => {
    render(<Home />)
    const deployButton = screen.getByRole('link', { name: /deploy now/i })
    expect(deployButton).toBeInTheDocument()
    expect(deployButton).toHaveAttribute(
      'href',
      'https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
    )
    expect(deployButton).toHaveAttribute('target', '_blank')
  })

  it('renders the documentation link', () => {
    render(<Home />)
    const docsLink = screen.getByRole('link', { name: /read our docs/i })
    expect(docsLink).toBeInTheDocument()
    expect(docsLink).toHaveAttribute(
      'href',
      'https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
    )
  })

  it('renders footer links', () => {
    render(<Home />)

    const learnLink = screen.getByRole('link', { name: /learn/i })
    expect(learnLink).toBeInTheDocument()
    expect(learnLink).toHaveAttribute(
      'href',
      'https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
    )

    const examplesLink = screen.getByRole('link', { name: /examples/i })
    expect(examplesLink).toBeInTheDocument()
    expect(examplesLink).toHaveAttribute(
      'href',
      'https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
    )

    const nextjsLink = screen.getByRole('link', { name: /go to nextjs.org/i })
    expect(nextjsLink).toBeInTheDocument()
    expect(nextjsLink).toHaveAttribute(
      'href',
      'https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
    )
  })

  it('renders instructions list', () => {
    render(<Home />)

    const editInstruction = screen.getByText(/get started by editing/i)
    expect(editInstruction).toBeInTheDocument()

    const codeElement = screen.getByText('app/page.tsx')
    expect(codeElement).toBeInTheDocument()
    expect(codeElement.tagName).toBe('CODE')
  })
})
