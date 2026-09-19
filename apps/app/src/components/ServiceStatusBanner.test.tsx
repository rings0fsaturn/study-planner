import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ServiceStatusBanner } from './ServiceStatusBanner'

describe('ServiceStatusBanner', () => {
  it('renders stale, service error, and auth error affordances', () => {
    const { rerender } = render(<ServiceStatusBanner status="stale" />)

    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText(/Showing your last known pace/)).toBeInTheDocument()

    rerender(<ServiceStatusBanner status="error" />)

    expect(screen.getByText('Pace')).toBeInTheDocument()
    expect(screen.getByText(/We can't reach the pace service/)).toBeInTheDocument()
    expect(screen.getByText(/Your sessions are safe on this device/)).toBeInTheDocument()

    rerender(<ServiceStatusBanner status="auth-error" />)

    expect(screen.getByText('Pace')).toBeInTheDocument()
    expect(screen.getByText(/We can't refresh your pace estimate/)).toBeInTheDocument()
  })

  it('does not render for loading or ready states', () => {
    const { rerender } = render(<ServiceStatusBanner status="loading" />)

    expect(screen.queryByTestId('service-status-banner')).not.toBeInTheDocument()

    rerender(<ServiceStatusBanner status="ready" />)

    expect(screen.queryByTestId('service-status-banner')).not.toBeInTheDocument()
  })
})
