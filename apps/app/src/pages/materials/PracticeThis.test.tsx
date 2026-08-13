import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PracticeThis } from './PracticeThis'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import type { MaterialRecord } from '../../materials/types'
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))


function material(overrides: Partial<MaterialRecord>): MaterialRecord {
  return {
    id: 'mat-1',
    ownerId: 'user-a',
    title: 'Operating Systems — Three Easy Pieces',
    kind: 'file',
    source: 'ostep.pdf',
    ingestionState: 'ready',
    ingestionProgress: 1,
    ingestionError: null,
    archived: false,
    contentVersion: 'v1',
    replacedAt: null,
    estimatedMinutes: 420,
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

function renderPractice(client: FakeMaterialClient) {
  return render(
    <MemoryRouter initialEntries={['/materials/mat-1/practice']}>
      <MaterialsProvider client={client}>
        <Routes>
          <Route path="/materials/:materialId/practice" element={<PracticeThis />} />
          <Route path="/materials/:materialId" element={<div data-testid="detail-page" />} />
        </Routes>
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

describe('PracticeThis', () => {
  beforeEach(() => {})

  it('renders the configuration page for a ready material', async () => {
    const client = new FakeMaterialClient([material({})])

    renderPractice(client)

    expect((await screen.findAllByText('Operating Systems — Three Easy Pieces')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Number of questions')).toHaveValue(5)
    expect(screen.getByRole('button', { name: 'Start practice run' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add another material' })).toBeInTheDocument()
  })

  it('shows a readiness notice when the run is started', async () => {
    const client = new FakeMaterialClient([material({})])

    renderPractice(client)

    await screen.findAllByText('Operating Systems — Three Easy Pieces');
    expect(screen.getAllByText('Operating Systems — Three Easy Pieces').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Number of questions'), { target: { value: 3 } })
    fireEvent.click(screen.getByRole('button', { name: 'Coding' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start practice run' }))

    expect(await screen.findByText('Practice run ready')).toBeInTheDocument()
    expect(screen.getByText(/3 questions, coding focus, 2 difficulty/i)).toBeInTheDocument()
  })

  it('adds another material from the picker', async () => {
    const client = new FakeMaterialClient([
      material({}),
      material({
        id: 'mat-2',
        title: 'Database Internals',
        kind: 'file',
        source: 'db.pdf',
      }),
    ])

    renderPractice(client)

    await screen.findAllByText('Operating Systems — Three Easy Pieces');
    expect(screen.getAllByText('Operating Systems — Three Easy Pieces').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Add another material' }))

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Database Internals/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText(/\+\d more material/i)).toBeInTheDocument()
    })
  })
})
