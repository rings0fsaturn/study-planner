import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PracticeThis } from './PracticeThis'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import { FakeAssessmentClient, queuedJob } from '../../assessments/testing/fakeAssessmentClient'
import { AssessmentServiceError } from '../../assessments/types'
import type { MaterialRecord } from '../../materials/types'

const mockAppend = vi.fn().mockResolvedValue(1)
const mockNavigate = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

vi.mock('../../events/useEventStore', () => ({
  useEventStore: () => ({ append: mockAppend }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

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

function renderPractice(client: FakeMaterialClient, assessments = new FakeAssessmentClient()) {
  return render(
    <MemoryRouter initialEntries={['/materials/mat-1/practice']}>
      <MaterialsProvider client={client}>
        <AssessmentProvider client={assessments}>
          <Routes>
            <Route path="/materials/:materialId/practice" element={<PracticeThis />} />
            <Route path="/materials/:materialId" element={<div data-testid="detail-page" />} />
          </Routes>
        </AssessmentProvider>
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

/** Script one generation per problem, each answering with its own assessment id. */
function scriptGenerations(
  assessments: FakeAssessmentClient,
  ids: string[],
  failAt: Record<number, Error> = {},
) {
  let call = 0
  assessments.generateAssessment.mockImplementation(async () => {
    const index = call++
    if (failAt[index]) throw failAt[index]
    return queuedJob({ resultId: ids[index] })
  })
}

async function startRun(count: number) {
  fireEvent.change(await screen.findByLabelText('Number of questions'), {
    target: { value: String(count) },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Start practice run' }))
}

describe('PracticeThis', () => {
  afterEach(() => {
    mockAppend.mockClear()
    mockNavigate.mockClear()
  })

  it('renders the configuration page for a ready material', async () => {
    const client = new FakeMaterialClient([material({})])

    renderPractice(client)

    expect((await screen.findAllByText('Operating Systems — Three Easy Pieces')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Number of questions')).toHaveValue(5)
    expect(screen.getByRole('button', { name: 'Start practice run' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add another material' })).toBeInTheDocument()
  })

  it('offers only the written family and bands 1-5, with the rest disabled', async () => {
    const client = new FakeMaterialClient([material({})])

    renderPractice(client)

    await screen.findByText('Focus')
    expect(screen.getByRole('button', { name: 'Written' })).toHaveClass('selected')
    expect(screen.getByRole('button', { name: 'Written' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Coding' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mixed' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adaptive' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3' })).toHaveClass('selected')
    expect(screen.getByRole('button', { name: '5' })).toBeEnabled()
  })

  it('disables the material picker with honest copy', async () => {
    const client = new FakeMaterialClient([material({})])

    renderPractice(client)

    await screen.findByText('Focus')
    expect(screen.getByRole('button', { name: 'Add another material' })).toBeDisabled()
    expect(screen.getByText(/multi-material runs arrive later/i)).toBeInTheDocument()
  })

  it('generates one single-material written question per problem', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2', 'a-3'])

    renderPractice(client, assessments)
    await startRun(3)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(3)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    for (const request of requests) {
      expect(request.materialIds).toEqual(['mat-1'])
      expect(request.recipe).toMatchObject({
        formats: ['written'],
        questionCount: 1,
        difficulty: 3,
      })
      expect(request.recipe.scope).toBeUndefined()
    }
    // Every problem is its own idempotent request.
    expect(new Set(requests.map((request) => request.clientId)).size).toBe(3)
    expect(new Set(requests.map((request) => request.correlationId)).size).toBe(3)
  })

  it('appends one run pointer and no assessment pointer, then opens the run', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2', 'a-3'])

    renderPractice(client, assessments)
    await startRun(3)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
    // Exact shape: the run pointer carries no questionIds (D-02).
    expect(mockAppend).toHaveBeenCalledWith('PracticeRunStarted', {
      runId: expect.any(String),
      materialIds: ['mat-1'],
      mode: 'written',
      assessmentIds: ['a-1', 'a-2', 'a-3'],
      count: 3,
    })
    expect(mockAppend).not.toHaveBeenCalledWith('AssessmentCreated', expect.anything())

    const [{ runId }] = mockAppend.mock.calls[0].slice(1)
    expect(mockNavigate).toHaveBeenCalledWith(`/materials/mat-1/practice/${runId}`)
  })

  it('keeps the problems that generated when some generations fail', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2', 'a-3'], {
      2: new AssessmentServiceError('network', 'request failed', true),
    })

    renderPractice(client, assessments)
    await startRun(3)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
    expect(mockAppend).toHaveBeenCalledWith(
      'PracticeRunStarted',
      expect.objectContaining({ assessmentIds: ['a-1', 'a-2'], count: 3 }),
    )
  })

  it('shows a quota banner with retryAfterSeconds and starts nothing', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1'], {
      0: new AssessmentServiceError('quota_exhausted', 'quota', false, 60),
      1: new AssessmentServiceError('quota_exhausted', 'quota', false, 60),
    })

    renderPractice(client, assessments)
    await startRun(2)

    expect(await screen.findByText('Generation quota exhausted')).toBeInTheDocument()
    expect(screen.getByText(/about 60 seconds/)).toBeInTheDocument()
    expect(mockAppend).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    // Recoverable: the learner can try again by hand.
    expect(screen.getByRole('button', { name: 'Start practice run' })).toBeEnabled()
  })

  it('reports progress and blocks a second start while generating', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockImplementation(() => new Promise(() => undefined))

    renderPractice(client, assessments)
    await startRun(3)

    const card = (await screen.findByText('Generating 3 questions…')).closest('.card')
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled()
    expect(assessments.generateAssessment).toHaveBeenCalledTimes(2)
  })

  it.each(['pending', 'extracting', 'chunking', 'embedding'] as const)(
    'blocks a direct practice route while the material is %s',
    async (state) => {
      const client = new FakeMaterialClient([material({ ingestionState: state })])

      renderPractice(client)

      expect(await screen.findByText('Material is not ready yet')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Start practice run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add another material' })).not.toBeInTheDocument()
    },
  )

  it('blocks a direct practice route for a failed material', async () => {
    const client = new FakeMaterialClient([
      material({ ingestionState: 'failed', ingestionError: 'provider_timeout' }),
    ])

    renderPractice(client)

    expect(await screen.findByText('Material is not ready yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start practice run' })).not.toBeInTheDocument()
  })
})
