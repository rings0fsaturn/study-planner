import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] render boundary caught an error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem 1rem',
          background: 'var(--paper)',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <div className="mono-caps" style={{ marginBottom: 8, color: 'var(--text-tertiary)' }}>
            Recovery
          </div>
          <h1 className="t-display-2" style={{ marginBottom: '0.75rem' }}>
            Something needs attention.
          </h1>
          <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
            Refresh the page. Your study log is stored locally and will be available when the app reloads.
          </p>
        </div>
      </div>
    )
  }
}
