import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Roadmap } from './Roadmap'

vi.mock('../roadmap/RoadmapCalendar', () => ({
  RoadmapCalendar: ({
    roadmapCreatedAt,
    readOnly,
  }: {
    roadmapCreatedAt?: string | null
    readOnly?: boolean
  }) => (
    <div data-testid="roadmap-calendar" data-readonly={readOnly ? 'true' : 'false'}>
      {roadmapCreatedAt ?? 'active'}
    </div>
  ),
}))

function renderRoadmap(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Roadmap />
    </MemoryRouter>,
  )
}

describe('Roadmap page', () => {
  it('renders the active roadmap when no roadmap query param is present', () => {
    renderRoadmap('/roadmap')

    expect(screen.getByTestId('roadmap-calendar')).toHaveAttribute('data-readonly', 'false')
    expect(screen.getByTestId('roadmap-calendar')).toHaveTextContent('active')
  })

  it('renders a read-only historical roadmap when the roadmap query param is present', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'

    renderRoadmap(`/roadmap?roadmap=${encodeURIComponent(createdAt)}`)

    expect(screen.getByTestId('roadmap-calendar')).toHaveAttribute('data-readonly', 'true')
    expect(screen.getByTestId('roadmap-calendar')).toHaveTextContent(createdAt)
  })
})
