import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AssessmentConfig } from './AssessmentConfig'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { FakeAssessmentClient, queuedJob } from '../../assessments/testing/fakeAssessmentClient'
import { AssessmentServiceError } from '../../assessments/types'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
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

function material(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
  return {
    id: 'mat-1',
    ownerId: 'user-a',
    title: 'Strategic Management',
    kind: 'url',
    source: 'https://example.com',
    ingestionState: 'ready',
    ingestionProgress: 1,
    ingestionError: null,
    archived: false,
    contentVersion: 'v1',
    replacedAt: null,
    estimatedMinutes: 120,
    uploadCompleteAt: null,
    chunkCount: 754,
    groundingVersion: 'v1',
    extractedTextPath: null,
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

function renderConfig(materials: FakeMaterialClient, assessments: FakeAssessmentClient) {
  return render(
    <MemoryRouter initialEntries={['/materials/mat-1/assessments/new']}>
      <MaterialsProvider client={materials}>
        <AssessmentProvider client={assessments}>
          <Routes>
            <Route path="/materials/:materialId/assessments/new" element={<AssessmentConfig />} />
          </Routes>
        </AssessmentProvider>
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

describe('AssessmentConfig', () => {
  afterEach(() => {
    mockAppend.mockClear()
    mockNavigate.mockClear()
  })

  it('shows the not-ready banner for a processing material', async () => {
    const materials = new FakeMaterialClient([
      material({ ingestionState: 'embedding', ingestionProgress: 0.6 }),
    ])
    renderConfig(materials, new FakeAssessmentClient())

    expect(await screen.findByText('Material is not ready yet')).toBeInTheDocument()
    expect(screen.queryByText('Difficulty band')).not.toBeInTheDocument()
  })

  it('defaults difficulty to band 3 and submits the contract payload', async () => {
    const materials = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGenerate(queuedJob({ resultId: 'assessment-1' }))
    renderConfig(materials, assessments)

    expect(await screen.findByText('Difficulty band')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' }).className).toContain('selected')

    fireEvent.click(screen.getByRole('button', { name: 'Generate question' }))

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(1)
    })
    const input = assessments.generateAssessment.mock.calls[0][0]
    expect(input.materialIds).toEqual(['mat-1'])
    expect(input.recipe).toMatchObject({
      formats: ['objective'],
      questionCount: 1,
      difficulty: 3,
    })
    // No skillTags placeholder and no scope: the whole material is used.
    expect(input.recipe.scope).toBeUndefined()
    expect(input.recipe.skillTags).toBeUndefined()
    expect(input.clientId).toBeTruthy()
    expect(input.correlationId).toBeTruthy()
    expect(mockAppend).toHaveBeenCalledWith('AssessmentCreated', {
      assessmentId: 'assessment-1',
      materialIds: ['mat-1'],
    })
    expect(mockNavigate).toHaveBeenCalledWith('/assessments/assessment-1')
  })

  it('sends the chapter range and its label when a chapter is picked', async () => {
    const materials = new FakeMaterialClient([
      material({
        pageCount: 572,
        pageOffset: -33,
        outline: {
          entries: [
            { title: 'Chapter 1 Introduction to performance management', page: 34 },
            { title: 'Chapter 5 Budgeting and control', page: 156 },
            { title: 'Chapter 6 Business structure', page: 214 },
          ],
        },
      }),
    ])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGenerate(queuedJob({ resultId: 'assessment-1' }))
    renderConfig(materials, assessments)

    fireEvent.click(await screen.findByRole('button', { name: 'Chapter 5 Budgeting and control' }))
    expect((screen.getByLabelText('From page') as HTMLInputElement).value).toBe('156')
    expect((screen.getByLabelText('To page') as HTMLInputElement).value).toBe('213')

    fireEvent.click(screen.getByRole('button', { name: 'Generate question' }))

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(1)
    })
    expect(assessments.generateAssessment.mock.calls[0][0].recipe.scope).toEqual({
      pageStart: 156,
      pageEnd: 213,
      sectionLabel: 'Chapter 5 Budgeting and control',
    })
  })

  it('sends a typed range without a label and clears it back to the whole material', async () => {
    const materials = new FakeMaterialClient([
      material({
        pageCount: 572,
        outline: {
          entries: [{ title: 'Chapter 5 Budgeting and control', page: 156 }],
        },
      }),
    ])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGenerate(queuedJob({ resultId: 'assessment-1' }))
    renderConfig(materials, assessments)

    fireEvent.change(await screen.findByLabelText('From page'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('To page'), { target: { value: '210' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate question' }))

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(1)
    })
    expect(assessments.generateAssessment.mock.calls[0][0].recipe.scope).toEqual({
      pageStart: 200,
      pageEnd: 210,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Whole material' }))
    expect((screen.getByLabelText('From page') as HTMLInputElement).value).toBe('')
  })

  it('refuses an inverted or out-of-range page range', async () => {
    const materials = new FakeMaterialClient([material({ pageCount: 572 })])
    const assessments = new FakeAssessmentClient()
    renderConfig(materials, assessments)

    fireEvent.change(await screen.findByLabelText('From page'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('To page'), { target: { value: '200' } })
    expect(screen.getByText('The first page must not be after the last page.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate question' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('To page'), { target: { value: '900' } })
    expect(screen.getByText('This material has 572 pages.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Generate question' }))
    expect(assessments.generateAssessment).not.toHaveBeenCalled()
  })

  it('uses the whole material when it has no page numbering', async () => {
    const materials = new FakeMaterialClient([material({ pageCount: null, outline: null })])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGenerate(queuedJob({ resultId: 'assessment-1' }))
    renderConfig(materials, assessments)

    expect(await screen.findByText(/no page numbering/)).toBeInTheDocument()
    expect(screen.queryByLabelText('From page')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Generate question' }))

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(1)
    })
    expect(assessments.generateAssessment.mock.calls[0][0].recipe.scope).toBeUndefined()
  })

  it('defaults to the objective family and sends the written family when picked', async () => {
    const materials = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGenerate(queuedJob({ resultId: 'assessment-1' }))
    renderConfig(materials, assessments)

    await screen.findByText('Difficulty band')
    expect(screen.getByRole('button', { name: 'Objective' }).className).toContain('selected')
    expect(screen.getByRole('button', { name: 'Written' }).className).not.toContain('selected')

    fireEvent.click(screen.getByRole('button', { name: 'Written' }))
    expect(screen.getByRole('button', { name: 'Written' }).className).toContain('selected')
    fireEvent.click(screen.getByRole('button', { name: 'Generate question' }))

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(1)
    })
    const recipe = assessments.generateAssessment.mock.calls[0][0].recipe
    expect(recipe.formats).toEqual(['written'])
    expect(recipe.questionCount).toBe(1)
  })

  it('shows a quota banner with retryAfterSeconds', async () => {
    const materials = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGenerate(
      new AssessmentServiceError('quota_exhausted', 'quota', false, 60),
    )
    renderConfig(materials, assessments)

    fireEvent.click(await screen.findByRole('button', { name: 'Generate question' }))

    expect(await screen.findByText('Generation quota exhausted')).toBeInTheDocument()
    expect(screen.getByText(/about 60 seconds/)).toBeInTheDocument()
  })

  it('shows a retry banner for retryable network errors', async () => {
    const materials = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGenerate(new AssessmentServiceError('network', 'request failed', true))
    renderConfig(materials, assessments)

    fireEvent.click(await screen.findByRole('button', { name: 'Generate question' }))

    expect(await screen.findByText('Could not start generation')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retry)
    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(2)
    })
  })

  it('disables double submission while pending', async () => {
    const materials = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    let resolveGenerate: (job: unknown) => void = () => undefined
    assessments.generateAssessment.mockImplementation(
      () => new Promise((resolve) => (resolveGenerate = resolve as (job: unknown) => void)),
    )
    renderConfig(materials, assessments)

    fireEvent.click(await screen.findByRole('button', { name: 'Generate question' }))
    expect(screen.getByRole('button', { name: 'Requesting generation…' })).toBeDisabled()

    resolveGenerate(queuedJob())
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
  })
})