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
    uploadCompleteAt: null,
    chunkCount: 0,
    groundingVersion: null,
    extractedTextPath: null,
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

  it('continues with the selected material records', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP' }),
      material({ id: 'mat-2', title: 'Raft paper', kind: 'url' }),
    ])
    const { onContinue } = renderPicker(client)

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Raft paper/ }))
    expect(within(dialog).getByText('1 selected · 2 ready')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(onContinue).toHaveBeenCalledWith([
      { materialId: 'mat-2', title: 'Raft paper', kind: 'url' },
    ])
  })

  it('hides excluded materials', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP' }),
      material({ id: 'mat-2', title: 'Raft paper' }),
    ])

    renderPicker(client, { purpose: 'planning', excludeIds: ['mat-1'] })

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for planning/i })
    expect(within(dialog).queryByText('OSTEP')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Raft paper')).toBeInTheDocument()
  })

  it('says so when every library material is already attached', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1', title: 'OSTEP' })])

    renderPicker(client, { purpose: 'planning', excludeIds: ['mat-1'] })

    expect(
      await screen.findByText('Every library material is already on this roadmap.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a material' })).toBeInTheDocument()
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

describe('MaterialPicker plan controls', () => {
  it('shows minutes and role once a row is selected, seeded from the library estimate', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP', estimatedMinutes: 420 }),
    ])
    renderPicker(client, { purpose: 'planning', withPlan: true })

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for planning/i })
    expect(within(dialog).queryByLabelText('Minutes for OSTEP')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /OSTEP/ }))

    expect(within(dialog).getByLabelText('Minutes for OSTEP')).toHaveValue(420)
    expect(within(dialog).getByLabelText('Role for OSTEP')).toHaveValue('foundation')
  })

  it('sends the edited minutes and role with the selection', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP', estimatedMinutes: 420 }),
    ])
    const { onContinue } = renderPicker(client, { purpose: 'planning', withPlan: true })

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for planning/i })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /OSTEP/ }))
    fireEvent.change(within(dialog).getByLabelText('Minutes for OSTEP'), { target: { value: '90' } })
    fireEvent.change(within(dialog).getByLabelText('Role for OSTEP'), { target: { value: 'practice' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(onContinue).toHaveBeenCalledWith(
      [{ materialId: 'mat-1', title: 'OSTEP', kind: 'file' }],
      { 'mat-1': { minutes: 90, role: 'practice' } },
    )
  })

  it('defaults to 60 minutes and omits rows that were deselected again', async () => {
    const client = new FakeMaterialClient([
      material({ id: 'mat-1', title: 'OSTEP', estimatedMinutes: null }),
      material({ id: 'mat-2', title: 'Raft paper' }),
    ])
    const { onContinue } = renderPicker(client, { purpose: 'planning', withPlan: true })

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for planning/i })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /OSTEP/ }))
    expect(within(dialog).getByLabelText('Minutes for OSTEP')).toHaveValue(60)

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Raft paper/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Raft paper/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(onContinue).toHaveBeenCalledWith(
      [{ materialId: 'mat-1', title: 'OSTEP', kind: 'file' }],
      { 'mat-1': { minutes: 60, role: 'foundation' } },
    )
  })

  it('renders no plan controls when withPlan is not set', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1', title: 'OSTEP' })])
    renderPicker(client)

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /OSTEP/ }))

    expect(within(dialog).queryByLabelText(/Minutes for/)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Role for/)).not.toBeInTheDocument()
  })
})
