import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavBar } from './NavBar'

vi.mock('./SyncIndicator', () => ({
  SyncIndicator: () => <div data-testid="sync-indicator" />,
}))

function renderNavBar(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavBar />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
})

describe('NavBar materials prefix', () => {
  it.each(['/materials', '/assessments', '/assessments/a-1', '/practice'])(
    'keeps the Materials tab active at %s',
    (entry) => {
      renderNavBar(entry)
      const links = screen.getAllByRole('link', { name: 'Materials' })
      expect(links.length).toBeGreaterThan(0)
      for (const link of links) {
        expect(link.getAttribute('aria-current')).toBe('page')
      }
    },
  )

  it('does not mark Materials active at /home', () => {
    renderNavBar('/home')
    const links = screen.getAllByRole('link', { name: 'Materials' })
    for (const link of links) {
      expect(link.getAttribute('aria-current')).toBeNull()
    }
  })
})
