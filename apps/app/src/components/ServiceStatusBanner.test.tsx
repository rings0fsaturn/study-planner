import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ServiceStatusBanner } from './ServiceStatusBanner'

describe('ServiceStatusBanner', () => {
  it('renders stale, service error, and auth error affordances', () => {
    const { rerender } = render(<ServiceStatusBanner status="stale" />)

    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText(/Showing last known pace/)).toBeInTheDocument()

    rerender(<ServiceStatusBanner status="error" />)

    expect(screen.getByText('Service')).toBeInTheDocument()
    expect(screen.getByText(/Couldn't reach/)).toBeInTheDocument()

    rerender(<ServiceStatusBanner status="auth-error" />)

    expect(screen.getByText('Auth')).toBeInTheDocument()
    expect(screen.getByText(/SUPABASE_JWT_SECRET/)).toBeInTheDocument()
  })

  it('does not render for loading or ready states', () => {
    const { rerender } = render(<ServiceStatusBanner status="loading" />)

    expect(screen.queryByTestId('service-status-banner')).not.toBeInTheDocument()

    rerender(<ServiceStatusBanner status="ready" />)

    expect(screen.queryByTestId('service-status-banner')).not.toBeInTheDocument()
  })
})
