import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MaterialLibrary } from './MaterialLibrary'
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

function renderLibrary(client: FakeMaterialClient) {
  return render(
    <MemoryRouter>
      <MaterialsProvider client={client}>
        <MaterialLibrary />
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

describe('MaterialLibrary', () => {
  beforeEach(() => {})

  it('renders the library grid with ready and processing cards', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP' }),
      material({
        id: 'mat-2',
        title: 'Database Internals',
        ingestionState: 'extracting',
        ingestionProgress: 0.25,
      }),
    ])

    renderLibrary(client)

    expect(await screen.findByText('OSTEP')).toBeInTheDocument()
    expect(screen.getByText('Database Internals')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practice this' })).toBeInTheDocument()
    expect(screen.getByText('Extracting')).toBeInTheDocument()
    expect(screen.getByText(/Generation disabled until ready/i)).toBeInTheDocument()
  })

  it('shows the empty-library state when no materials exist', async () => {
    renderLibrary(new FakeMaterialClient([]))

    expect(await screen.findByText('Your library is empty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add your first material' })).toBeInTheDocument()
  })

  it('hides archived materials by default and reveals them with the toggle', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'Active' }),
      material({ id: 'mat-2', title: 'Old notes', archived: true }),
    ])

    renderLibrary(client)

    await screen.findByText('Active')
    expect(screen.queryByText('Old notes')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Show archived'))

    expect(await screen.findByText('Old notes')).toBeInTheDocument()
  })

  it('archives a material from the overflow menu', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1', title: 'Active' })])

    renderLibrary(client)

    await screen.findByText('Active')
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Active' }))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Archive' }))

    await waitFor(() => {
      expect(client.materials[0].archived).toBe(true)
    })
  })

  it('filters the grid by search text', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'Raft consensus' }),
      material({ id: 'mat-2', title: 'Database Internals' }),
    ])

    renderLibrary(client)

    await screen.findByText('Raft consensus')
    fireEvent.change(screen.getByLabelText('Search materials'), {
      target: { value: 'raft' },
    })

    expect(screen.getByText('Raft consensus')).toBeInTheDocument()
    expect(screen.queryByText('Database Internals')).not.toBeInTheDocument()
  })

  it('shows the filtered-out empty state when search matches nothing', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1', title: 'Raft consensus' })])

    renderLibrary(client)

    await screen.findByText('Raft consensus')
    fireEvent.change(screen.getByLabelText('Search materials'), {
      target: { value: 'zzz-no-match' },
    })

    expect(await screen.findByText('No materials in view')).toBeInTheDocument()
  })

  it('shows an error banner with retry when loading fails', async () => {
    const client = new FakeMaterialClient([])
    client.listMaterials = async () => {
      throw new Error('boom')
    }

    renderLibrary(client)

    expect(await screen.findByText('Could not load materials')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('opens the picker and shows a selection notice on continue', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP' }),
      material({
        id: 'mat-2',
        title: 'Database Internals',
        ingestionState: 'extracting',
        ingestionProgress: 0.25,
      }),
    ])

    renderLibrary(client)

    await screen.findByText('OSTEP')
    fireEvent.click(screen.getByRole('button', { name: 'Select for assessment' }))

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /OSTEP/ }))
    expect(within(dialog).getByRole('checkbox', { name: /Database Internals/ })).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText(/1 material selected/i)).toBeInTheDocument()
  })
})
