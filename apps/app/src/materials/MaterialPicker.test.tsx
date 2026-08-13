import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MaterialPicker, type MaterialPickerProps } from './MaterialPicker'
import { MaterialsProvider } from './MaterialsProvider'
import { FakeMaterialClient } from './testing/fakeMaterialClient'
import type { MaterialRecord } from './types'

vi.mock('../lib/supabase', () => ({
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

function renderPicker(
  client: FakeMaterialClient,
  props: Partial<MaterialPickerProps> = {},
) {
  const onClose = vi.fn()
  const onContinue = vi.fn()
  render(
    <MemoryRouter>
      <MaterialsProvider client={client}>
        <Routes>
          <Route
            path="/"
            element={
              <MaterialPicker
                open
                purpose="generation"
                onClose={onClose}
                onContinue={onContinue}
                {...props}
              />
            }
          />
          <Route path="/materials/:materialId" element={<div data-testid="detail-page" />} />
        </Routes>
      </MaterialsProvider>
    </MemoryRouter>,
  )
  return { onClose, onContinue }
}

describe('MaterialPicker', () => {
  beforeEach(() => {})

  it('only allows ready materials in generation mode', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP' }),
      material({
        id: 'mat-2',
        title: 'Database Internals',
        ingestionState: 'extracting',
        ingestionProgress: 0.25,
      }),
    ])

    renderPicker(client)

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    const readyCheckbox = within(dialog).getByRole('checkbox', { name: /OSTEP/ })
    const disabledCheckbox = within(dialog).getByRole('checkbox', { name: /Database Internals/ })

    expect(readyCheckbox).toBeEnabled()
    expect(disabledCheckbox).toBeDisabled()
    expect(within(dialog).getByText(/Generation disabled/i)).toBeInTheDocument()
  })

  it('allows every material in planning mode', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP' }),
      material({
        id: 'mat-2',
        title: 'Database Internals',
        ingestionState: 'extracting',
        ingestionProgress: 0.25,
      }),
    ])

    renderPicker(client, { purpose: 'planning' })

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for planning/i })
    const extractingCheckbox = within(dialog).getByRole('checkbox', { name: /Database Internals/ })
    expect(extractingCheckbox).toBeEnabled()
  })

  it('shows a View link instead of selection for disabled rows', async () => {
    const client = new FakeMaterialClient([
      material({
        id: 'mat-2',
        title: 'Database Internals',
        ingestionState: 'extracting',
        ingestionProgress: 0.25,
      }),
    ])

    renderPicker(client)

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    expect(within(dialog).getByRole('link', { name: 'View' }).getAttribute('href')).toBe(
      '/materials/mat-2',
    )
  })

  it('excludes archived materials from the picker', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP' }),
      material({ id: 'mat-3', title: 'Old notes', archived: true }),
    ])

    renderPicker(client)

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    expect(within(dialog).getByText('OSTEP')).toBeInTheDocument()
    expect(within(dialog).queryByText('Old notes')).not.toBeInTheDocument()
  })

  it('continues with the selected material ids', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP' }),
      material({ id: 'mat-2', title: 'Raft paper' }),
    ])
    const { onContinue } = renderPicker(client)

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Raft paper/ }))
    expect(within(dialog).getByText('1 selected · 2 ready')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(onContinue).toHaveBeenCalledWith(['mat-2'])
  })

  it('disables Continue until a material is selected', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1', title: 'OSTEP' })])
    const { onContinue } = renderPicker(client)

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /OSTEP/ }))
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeEnabled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalled()
  })

  it('shows an empty state with an add link when no materials exist', async () => {
    const client = new FakeMaterialClient([])

    renderPicker(client)

    expect(await screen.findByText('No materials to choose from yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a material' })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1', title: 'OSTEP' })])
    const { onClose } = renderPicker(client)

    await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })
})
