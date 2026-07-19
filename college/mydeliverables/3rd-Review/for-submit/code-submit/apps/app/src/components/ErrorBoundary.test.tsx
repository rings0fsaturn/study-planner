import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function BrokenChild(): never {
  throw new Error('render failed')
}

describe('ErrorBoundary', () => {
  it('renders a fallback when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something needs attention.')).toBeInTheDocument()
    expect(screen.getByText(/Refresh the page/)).toBeInTheDocument()
  })
})
