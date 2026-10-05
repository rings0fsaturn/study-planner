import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Dexie from 'dexie'
import { MaterialDetail } from './MaterialDetail'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { EventStoreProvider, createEventStore } from '../../events/EventStoreProvider'
import { ASSESSMENT_CREATED, PRACTICE_RUN_STARTED } from '../../events/EventStore'
import { useMaterialUsage } from '../../materials/useMaterialUsage'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import {
  FakeAssessmentClient,
  attemptRecord,
  readyAssessment,
} from '../../assessments/testing/fakeAssessmentClient'
import type { MaterialRecord } from '../../materials/types'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

vi.mock('../../materials/useMaterialUsage', () => ({
  useMaterialUsage: vi.fn(() => []),
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

const BACKLINK_USER = 'material-detail-backlink-user'
const BACKLINK_DB = `StudyTracker_${BACKLINK_USER}`

async function seedBacklink(events: Array<{ kind: string; payload: Record<string, unknown> }>) {
  const store = createEventStore(BACKLINK_USER)
  for (const { kind, payload } of events) {
    await store.append(kind, payload)
  }
  store.close()
}

function renderDetail(
  client: FakeMaterialClient,
  materialId = 'mat-1',
  assessments: FakeAssessmentClient = new FakeAssessmentClient(),
) {
  return render(
    <MemoryRouter initialEntries={[`/materials/${materialId}`]}>
      <EventStoreProvider userId={BACKLINK_USER}>
        <MaterialsProvider client={client}>
          <AssessmentProvider client={assessments}>
            <Routes>
              <Route path="/materials/:materialId" element={<MaterialDetail />} />
              <Route path="/materials" element={<div data-testid="library-page" />} />
              <Route path="/materials/:materialId/practice" element={<div data-testid="practice-page" />} />
              <Route
                path="/materials/:materialId/assessments/new"
                element={<div data-testid="assessment-config-page" />}
              />
              <Route path="/assessments/:assessmentId" element={<div data-testid="assessment-detail" />} />
              <Route
                path="/materials/:materialId/practice/:runId"
                element={<div data-testid="run-detail" />}
              />
            </Routes>
          </AssessmentProvider>
        </MaterialsProvider>
      </EventStoreProvider>
    </MemoryRouter>,
  )
}

describe('MaterialDetail', () => {
  beforeEach(async () => {
    await Dexie.delete(BACKLINK_DB)
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.mocked(useMaterialUsage).mockReturnValue([])
    const store = createEventStore(BACKLINK_USER)
    store.close()
    await Dexie.delete(BACKLINK_DB)
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

  it('names the roadmaps the material feeds in the usage section and delete warning', async () => {
    vi.mocked(useMaterialUsage).mockReturnValue(['Networks · Jul 1, 2026'])
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    expect(await screen.findByText('Networks · Jul 1, 2026')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete material' })
    expect(within(dialog).getByText('Networks · Jul 1, 2026')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete anyway' })).toBeInTheDocument()
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
        <EventStoreProvider userId={BACKLINK_USER}>
          <MaterialsProvider client={client}>
            <AssessmentProvider client={new FakeAssessmentClient()}>
              <Routes>
                <Route path="/materials/:materialId" element={<MaterialDetail />} />
                <Route path="/materials" element={<div data-testid="library-page" />} />
              </Routes>
            </AssessmentProvider>
          </MaterialsProvider>
        </EventStoreProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('dialog', { name: 'Delete material' })).toBeInTheDocument()
  })

  it('renders no extracted content and asks the service for none', async () => {
    const client = new FakeMaterialClient([
      material({
        ingestionState: 'chunking',
        ingestionProgress: 0.5,
        extractedTextPath: 'user-a/mat-1/fulltext.txt',
      }),
    ])

    renderDetail(client)

    expect(await screen.findByText('Operating Systems — Three Easy Pieces')).toBeInTheDocument()
    expect(screen.queryByText(/Extracted content/)).not.toBeInTheDocument()
    expect(document.querySelector('.material-preview-text')).toBeNull()
  })

  it('lists this material assessments with family, status, and links', async () => {
    await seedBacklink([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([
      attemptRecord({
        assessmentId: 'a-1',
        questionId: 'q1',
        status: 'graded',
        grade: {
          attemptId: 'att-1',
          questionId: 'q1',
          materialId: 'mat-1',
          score: 0.8,
          correct: true,
          grader: 'objective',
          gradedAt: '2026-09-20T11:00:00Z',
        },
      }),
    ])
    const client = new FakeMaterialClient([material({})])

    renderDetail(client, 'mat-1', assessments)

    expect(await screen.findByText('0.80')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: /Assessments and practice/i })
    expect(within(section).getByRole('link', { name: /Objective/i }).getAttribute('href')).toBe(
      '/assessments/a-1',
    )
  })

  it('lists this material practice runs with mode, progress, and links', async () => {
    await seedBacklink([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: {
          runId: 'run-1',
          materialIds: ['mat-1'],
          mode: 'written',
          assessmentIds: ['a-1'],
          count: 1,
          families: ['written'],
        },
      },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) =>
      readyAssessment({ id, materialIds: ['mat-1'] }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const client = new FakeMaterialClient([material({})])

    renderDetail(client, 'mat-1', assessments)

    expect(await screen.findByText(/0 of 1 graded/i)).toBeInTheDocument()
    const section = screen.getByRole('region', { name: /Assessments and practice/i })
    const runLink = within(section).getByRole('link', { name: /Written/i })
    expect(runLink.getAttribute('href')).toBe('/materials/mat-1/practice/run-1')
  })

  it('hides rows created by other materials', async () => {
    await seedBacklink([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-2', materialIds: ['mat-2'] } },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: {
          runId: 'run-1',
          materialIds: ['mat-1'],
          mode: 'written',
          assessmentIds: ['a-1'],
          count: 1,
          families: ['written'],
        },
      },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: {
          runId: 'run-2',
          materialIds: ['mat-2'],
          mode: 'written',
          assessmentIds: ['a-2'],
          count: 1,
          families: ['written'],
        },
      },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) =>
      readyAssessment({ id, materialIds: id === 'a-1' ? ['mat-1'] : ['mat-2'] }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const client = new FakeMaterialClient([material({}), material({ id: 'mat-2' })])

    renderDetail(client, 'mat-1', assessments)

    await waitFor(() => {
      const section = screen.getByRole('region', { name: /Assessments and practice/i })
      expect(section.innerHTML).toContain('/assessments/a-1')
    })
    const section = screen.getByRole('region', { name: /Assessments and practice/i })
    const hrefs = within(section)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/assessments/a-1')
    expect(hrefs).not.toContain('/assessments/a-2')
    expect(hrefs).toContain('/materials/mat-1/practice/run-1')
    expect(hrefs).not.toContain('/materials/mat-2/practice/run-2')
  })

  it('shows honest empty copy and retires the placeholder sentence', async () => {
    await seedBacklink([])
    const client = new FakeMaterialClient([material({})])

    renderDetail(client)

    expect(await screen.findByText(/Not attached to any roadmap yet/)).toBeInTheDocument()
    expect(screen.queryByText(/Assessments will appear here once created/)).not.toBeInTheDocument()
    expect(await screen.findByText(/No assessments or practice runs for this material yet/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Used by/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Assessments and practice/i })).toBeInTheDocument()
  })

  it('shows a failed assessment reason verbatim with no retry affordance', async () => {
    await seedBacklink([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-f', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(
      readyAssessment({
        id: 'a-f',
        materialIds: ['mat-1'],
        status: 'failed',
        questions: [],
        recipe: { formats: ['written'], questionCount: 1 },
        warnings: [{ code: 'code_not_derivable', message: 'notes ship the solution' }],
      }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const client = new FakeMaterialClient([material({})])

    renderDetail(client, 'mat-1', assessments)

    expect(
      await screen.findByText('code_not_derivable: notes ship the solution'),
    ).toBeInTheDocument()
    const section = screen.getByRole('region', { name: /Assessments and practice/i })
    expect(within(section).queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('shows a generating assessment with N of M ready and no invented grade', async () => {
    await seedBacklink([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-g', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(
      readyAssessment({
        id: 'a-g',
        materialIds: ['mat-1'],
        status: 'generating',
        questions: [],
        recipe: { formats: ['objective'], questionCount: 3 },
        warnings: [],
      }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const client = new FakeMaterialClient([material({})])

    renderDetail(client, 'mat-1', assessments)

    expect(await screen.findByText('0 of 3 ready')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: /Assessments and practice/i })
    expect(within(section).queryByText(/graded/)).not.toBeInTheDocument()
  })

  it('marks unreadable uncached rows unavailable offline without inventing counts', async () => {
    await seedBacklink([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-off', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockRejectedValue(new Error('offline'))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const client = new FakeMaterialClient([material({})])

    renderDetail(client, 'mat-1', assessments)

    expect(await screen.findByText('Unavailable offline')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: /Assessments and practice/i })
    expect(within(section).queryByText(/graded/)).not.toBeInTheDocument()
  })

  it('names the missing count on partial runs', async () => {
    await seedBacklink([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: {
          runId: 'run-partial',
          materialIds: ['mat-1'],
          mode: 'written',
          assessmentIds: ['a-1'],
          count: 3,
          families: ['written'],
        },
      },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) =>
      readyAssessment({ id, materialIds: ['mat-1'] }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const client = new FakeMaterialClient([material({})])

    renderDetail(client, 'mat-1', assessments)

    expect(await screen.findByText(/2 of 3 never generated/i)).toBeInTheDocument()
  })
})
