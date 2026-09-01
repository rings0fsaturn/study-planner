import { describe, expect, it, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MaterialDetail } from './MaterialDetail'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import type { MaterialRecord } from '../../materials/types'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

vi.mock('../../materials/previewClient', () => ({
  fetchMaterialContentPreview: vi.fn(),
}))

import { fetchMaterialContentPreview } from '../../materials/previewClient'

const mockedPreview = fetchMaterialContentPreview as ReturnType<typeof vi.fn>

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

function renderDetail(client: FakeMaterialClient, materialId = 'mat-1') {
  return render(
    <MemoryRouter initialEntries={[`/materials/${materialId}`]}>
      <MaterialsProvider client={client}>
        <Routes>
          <Route path="/materials/:materialId" element={<MaterialDetail />} />
          <Route path="/materials" element={<div data-testid="library-page" />} />
          <Route path="/materials/:materialId/practice" element={<div data-testid="practice-page" />} />
          <Route path="/materials/:materialId/assessments/new" element={<div data-testid="assessment-config-page" />} />
        </Routes>
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

describe('MaterialDetail', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  beforeEach(() => {
    mockedPreview.mockReset()
  })

  it('renders a ready material with Practice this and attach actions', async () => {
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    expect(await screen.findByText('Operating Systems — Three Easy Pieces')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Practice this' }).getAttribute('href')).toBe(
      '/materials/mat-1/practice',
    )
    expect(screen.getByRole('link', { name: 'Generate assessment' }).getAttribute('href')).toBe(
      '/materials/mat-1/assessments/new',
    )
    expect(screen.getByRole('button', { name: 'Attach to assessment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace keep-ID' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows ingestion progress and blocks actions while processing', async () => {
    const client = new FakeMaterialClient([
      material({ ingestionState: 'extracting', ingestionProgress: 0.25 }),
    ])

    renderDetail(client)

    expect(await screen.findByText(/Grounded generation is disabled/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Practice this' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Generate assessment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Attach to assessment' })).not.toBeInTheDocument()
  })

  it('shows the failed state with a retry that resets ingestion to pending', async () => {
    const client = new FakeMaterialClient([
      material({
        ingestionState: 'failed',
        ingestionProgress: 0,
        ingestionError: 'Fetch timeout after 30 s',
      }),
    ])

    renderDetail(client)

    expect(await screen.findByText('Ingestion failed')).toBeInTheDocument()
    expect(screen.getAllByText('Fetch timeout after 30 s').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(client.materials[0].ingestionState).toBe('pending')
    })
    expect(await screen.findByText(/Grounded generation is disabled/i)).toBeInTheDocument()
  })

  it('shows the stale banner when the material was replaced', async () => {
    const client = new FakeMaterialClient([
      material({ replacedAt: '2026-08-01T10:00:00.000Z', contentVersion: 'v2' }),
    ])

    renderDetail(client)

    expect(await screen.findByText('Grounding may be stale')).toBeInTheDocument()
  })

  it('shows the usage section explaining attachments arrive with the assessment slice', async () => {
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    expect(await screen.findByText(/Not attached to any roadmap yet/)).toBeInTheDocument()
  })

  it('archives and restores from the detail page', async () => {
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    await screen.findByText('Operating Systems — Three Easy Pieces')
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(client.materials[0].archived).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(client.materials[0].archived).toBe(false))
  })

  it('replaces keep-ID inline and resets ingestion to pending', async () => {
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    await screen.findByText('Operating Systems — Three Easy Pieces')
    fireEvent.click(screen.getByRole('button', { name: 'Replace keep-ID' }))
    fireEvent.click(screen.getByRole('button', { name: 'Web article' }))
    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'https://example.com/ostep' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Replace and re-process' }))

    await waitFor(() => {
      expect(client.materials[0]).toMatchObject({
        kind: 'url',
        source: 'https://example.com/ostep',
        ingestionState: 'pending',
      })
      expect(client.materials[0].replacedAt).toBeTruthy()
    })
  })

  it('replaces keep-ID with a manual (plain text) source using the valid kind', async () => {
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    await screen.findByText('Operating Systems — Three Easy Pieces')
    fireEvent.click(screen.getByRole('button', { name: 'Replace keep-ID' }))
    fireEvent.click(screen.getByRole('button', { name: 'Plain text' }))
    fireEvent.change(screen.getByPlaceholderText('Paste text here…'), {
      target: { value: 'Full replacement text' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Replace and re-process' }))

    await waitFor(() => {
      expect(client.materials[0]).toMatchObject({
        kind: 'manual',
        source: 'Full replacement text',
        ingestionState: 'pending',
      })
    })
  })

  it('does not offer file replacement (no upload path exists yet)', async () => {
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    await screen.findByText('Operating Systems — Three Easy Pieces')
    fireEvent.click(screen.getByRole('button', { name: 'Replace keep-ID' }))

    expect(screen.getByRole('button', { name: 'Web article' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plain text' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'PDF document' })).not.toBeInTheDocument()
  })

  it('polls the row while processing and stops once ready', async () => {
    vi.useFakeTimers()
    const client = new FakeMaterialClient([
      material({ ingestionState: 'extracting', ingestionProgress: 0.25 }),
    ])
    const getSpy = vi.spyOn(client, 'getMaterial')
    renderDetail(client)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText('Operating Systems — Three Easy Pieces')).toBeInTheDocument()
    const callsAfterMount = getSpy.mock.calls.length

    client.materials[0] = {
      ...client.materials[0],
      ingestionState: 'chunking',
      ingestionProgress: 0.5,
      updatedAt: '2026-07-15T10:00:06.000Z',
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(getSpy.mock.calls.length).toBeGreaterThan(callsAfterMount)
    expect(screen.getAllByText(/chunking/i).length).toBeGreaterThan(0)

    client.materials[0] = {
      ...client.materials[0],
      ingestionState: 'ready',
      ingestionProgress: 1,
      updatedAt: '2026-07-15T10:00:12.000Z',
    }
    const callsBeforeReady = getSpy.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(screen.getByRole('link', { name: 'Practice this' })).toBeInTheDocument()
    // Exactly one in-flight poll may observe the ready row before the
    // interval stops itself; nothing after that.
    expect(getSpy.mock.calls.length).toBe(callsBeforeReady + 1)
  })

  it('deletes the material from the confirm dialog and returns to the library', async () => {
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    await screen.findByText('Operating Systems — Three Easy Pieces')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog', { name: 'Delete material' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete material' }))

    expect(await screen.findByTestId('library-page')).toBeInTheDocument()
    expect(client.materials).toHaveLength(0)
  })

  it('opens delete confirmation directly from ?confirm=delete', async () => {
    const client = new FakeMaterialClient([material({})])

    render(
      <MemoryRouter initialEntries={['/materials/mat-1?confirm=delete']}>
        <MaterialsProvider client={client}>
          <Routes>
            <Route path="/materials/:materialId" element={<MaterialDetail />} />
            <Route path="/materials" element={<div data-testid="library-page" />} />
          </Routes>
        </MaterialsProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('dialog', { name: 'Delete material' })).toBeInTheDocument()
  })

  it('shows partial extracted content while processing', async () => {
    const client = new FakeMaterialClient([
      material({
        ingestionState: 'chunking',
        ingestionProgress: 0.5,
        extractedTextPath: 'user-a/mat-1/fulltext.txt',
      }),
    ])
    mockedPreview.mockResolvedValue({
      materialId: 'mat-1',
      state: 'chunking',
      previewText: 'Chapter one of the book…',
      chunkCount: 3,
      ready: false,
      updatedAt: '2026-07-15T10:00:00.000Z',
    })

    renderDetail(client)

    expect(await screen.findByText('Extracted content (partial — still processing)')).toBeInTheDocument()
    expect(screen.getByText('Chapter one of the book…')).toBeInTheDocument()
    expect(mockedPreview).toHaveBeenCalledWith('mat-1')
  })

  it('tolerates a preview failure without hiding the material', async () => {
    const client = new FakeMaterialClient([
      material({
        ingestionState: 'embedding',
        ingestionProgress: 0.7,
        extractedTextPath: 'user-a/mat-1/fulltext.txt',
      }),
    ])
    mockedPreview.mockRejectedValue(new Error('service offline'))

    renderDetail(client)

    expect(await screen.findByText('Content preview unavailable')).toBeInTheDocument()
    expect(screen.getByText('Operating Systems — Three Easy Pieces')).toBeInTheDocument()
  })

  it('does not fetch a preview before extraction begins', async () => {
    const client = new FakeMaterialClient([material({ ingestionState: 'pending' })])

    renderDetail(client)

    await screen.findByText('Operating Systems — Three Easy Pieces')
    expect(mockedPreview).not.toHaveBeenCalled()
  })
})
