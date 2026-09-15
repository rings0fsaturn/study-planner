// #44 Phase 3: the run summary over the shared review primitives.
// Pure component: no Dexie, no providers, no events (rule 32 stays out).

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { LocalAttemptRow } from '../../assessments/attemptFlow'
import type { Assessment, Question, QuestionGradedResult } from '../../assessments/types'
import type { PracticeRunStartedPayload } from '../../sync/types'
import { buildPracticeRunModel, isSummaryEligible } from './practiceRunModel'
import { PracticeSummary } from './PracticeSummary'

function question(id: string, materialId = 'mat-1'): Question {
  return {
    id,
    assessmentId: `a-${id}`,
    materialId,
    format: 'written',
    subtype: 'short_answer',
    prompt: `Prompt for ${id}`,
    options: [],
    skillTags: ['core'],
    authoredDifficulty: 3,
    citations: [],
  }
}

function assessmentRecord(id: string, questions: Question[], materialId = 'mat-1'): Assessment {
  return {
    id,
    ownerId: 'user-a',
    materialIds: [materialId],
    status: 'ready',
    questions,
    warnings: [],
    groundingStale: false,
    createdAt: '2026-09-15T10:00:00Z',
  }
}

function grade(questionId: string, score: number, feedback?: string): QuestionGradedResult {
  return {
    attemptId: `att-${questionId}`,
    questionId,
    materialId: 'mat-1',
    score,
    correct: score >= 0.6,
    perSkill: [],
    grader: 'llm_rubric',
    gradedAt: '2026-09-15T10:05:00Z',
    publicFeedback: feedback ?? (score >= 0.6 ? 'Good answer.' : 'Not quite.'),
  }
}

function row(
  clientAttemptId: string,
  questionId: string,
  assessmentId: string,
  status: LocalAttemptRow['status'],
  gradeValue?: QuestionGradedResult,
): LocalAttemptRow {
  return {
    clientAttemptId,
    attemptId: gradeValue ? gradeValue.attemptId : null,
    questionId,
    assessmentId,
    answer: { text: `Answer for ${questionId}` },
    status,
    submittedAt: '2026-09-15T10:02:00Z',
    grade: gradeValue ?? null,
  }
}

function summaryFor(input: {
  assessmentIds: string[]
  assessments: Array<Assessment | null>
  attemptsByAssessment?: Record<string, LocalAttemptRow[]>
  materialIds?: string[]
}) {
  const started: PracticeRunStartedPayload = {
    runId: 'run-1',
    materialIds: input.materialIds ?? ['mat-1'],
    mode: 'written',
    assessmentIds: input.assessmentIds,
    count: input.assessmentIds.length,
  }
  const model = buildPracticeRunModel({
    started,
    finished: { runId: 'run-1', outcome: 'completed' },
    assessments: input.assessments,
    attemptsByAssessment: input.attemptsByAssessment ?? {},
  })
  return { model, problems: model.problems.filter(isSummaryEligible) }
}

function renderSummary(
  input: Parameters<typeof summaryFor>[0],
  overrides: Partial<Parameters<typeof PracticeSummary>[0]> = {},
) {
  const { model, problems } = summaryFor(input)
  return render(
    <PracticeSummary
      model={model}
      problems={problems}
      activeIndex={0}
      onSelect={() => {}}
      materialTitles={{ 'mat-1': 'Operating Systems', 'mat-2': 'Database Internals' }}
      onRetryQuestion={() => {}}
      onBackToProblems={() => {}}
      {...overrides}
    />,
  )
}

describe('PracticeSummary', () => {
  it('lists only problems with a terminal outcome and counts them', () => {
    const { model, problems } = summaryFor({
      assessmentIds: ['a-1', 'a-2', 'a-3'],
      assessments: [
        assessmentRecord('a-1', [question('q1')]),
        assessmentRecord('a-2', [question('q2')]),
        assessmentRecord('a-3', [question('q3')]),
      ],
      attemptsByAssessment: {
        'a-1': [row('ca-1', 'q1', 'a-1', 'graded', grade('q1', 1))],
        'a-2': [row('ca-2', 'q2', 'a-2', 'failed')],
      },
    })

    expect(model.problems).toHaveLength(3)
    expect(problems.map((problem) => problem.number)).toEqual([1, 2])

    render(
      <PracticeSummary
        model={model}
        problems={problems}
        activeIndex={0}
        onSelect={() => {}}
        materialTitles={{ 'mat-1': 'Operating Systems' }}
        onRetryQuestion={() => {}}
        onBackToProblems={() => {}}
      />,
    )

    expect(screen.getByText('1 of 3 problems graded · 1 correct · 1 could not be graded · mean score 1.00')).toBeInTheDocument()
    // The never-answered problem is not a navigator tab.
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('renders a graded problem’s feedback, material label and per-problem retry', () => {
    const onRetryQuestion = vi.fn()
    renderSummary(
      {
        assessmentIds: ['a-1'],
        assessments: [assessmentRecord('a-1', [question('q1')])],
        attemptsByAssessment: { 'a-1': [row('ca-1', 'q1', 'a-1', 'graded', grade('q1', 1, 'Clear and grounded.'))] },
      },
      { onRetryQuestion },
    )

    expect(screen.getByText('Run summary')).toBeInTheDocument()
    expect(screen.getByText('Problem 1')).toBeInTheDocument()
    expect(screen.getByText('from Operating Systems')).toBeInTheDocument()
    expect(screen.getByText('Clear and grounded.')).toBeInTheDocument()
    expect(screen.getByText('Answer for q1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry question' }))
    expect(onRetryQuestion).toHaveBeenCalledWith('q1')
  })

  it('shows an ungradable attempt honestly instead of the review model’s processing state', () => {
    const onRetryQuestion = vi.fn()
    renderSummary(
      {
        assessmentIds: ['a-1'],
        assessments: [assessmentRecord('a-1', [question('q1')])],
        attemptsByAssessment: { 'a-1': [row('ca-1', 'q1', 'a-1', 'failed')] },
      },
      { onRetryQuestion },
    )

    expect(screen.getByText('This attempt could not be graded.')).toBeInTheDocument()
    // The review model would call this 'processing'; the summary must not.
    expect(screen.queryByLabelText('Grading question')).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Rubric breakdown' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry question' }))
    expect(onRetryQuestion).toHaveBeenCalledWith('q1')
  })

  it('preserves attempt history when a problem was retried', () => {
    renderSummary({
      assessmentIds: ['a-1'],
      assessments: [assessmentRecord('a-1', [question('q1')])],
      attemptsByAssessment: {
        'a-1': [
          { ...row('ca-1', 'q1', 'a-1', 'graded', grade('q1', 0.2, 'Not quite.')), submittedAt: '2026-09-15T10:00:00Z' },
          { ...row('ca-2', 'q1', 'a-1', 'graded', grade('q1', 1, 'Good retry.')), submittedAt: '2026-09-15T10:10:00Z' },
        ],
      },
    })

    expect(screen.getByText('Attempt #1')).toBeInTheDocument()
    expect(screen.getByText('Attempt #2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry question' })).toBeInTheDocument()
  })

  it('renders the taking slot instead of the review card while a retry is in flight', () => {
    renderSummary(
      {
        assessmentIds: ['a-1'],
        assessments: [assessmentRecord('a-1', [question('q1')])],
        attemptsByAssessment: { 'a-1': [row('ca-1', 'q1', 'a-1', 'graded', grade('q1', 1, 'Clear and grounded.'))] },
      },
      { panelSlot: <div data-testid="taking-slot" /> },
    )

    expect(screen.getByTestId('taking-slot')).toBeInTheDocument()
    expect(screen.queryByText('Clear and grounded.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry question' })).not.toBeInTheDocument()
  })

  it('offers the way back to the run screen', () => {
    const onBackToProblems = vi.fn()
    renderSummary(
      {
        assessmentIds: ['a-1'],
        assessments: [assessmentRecord('a-1', [question('q1')])],
        attemptsByAssessment: { 'a-1': [row('ca-1', 'q1', 'a-1', 'graded', grade('q1', 1))] },
      },
      { onBackToProblems },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back to problems' }))
    expect(onBackToProblems).toHaveBeenCalled()
  })

  it('never renders hidden key vocabulary', () => {
    const view = renderSummary({
      assessmentIds: ['a-1'],
      assessments: [assessmentRecord('a-1', [question('q1')])],
      attemptsByAssessment: { 'a-1': [row('ca-1', 'q1', 'a-1', 'graded', grade('q1', 1))] },
    })

    expect(view.container.innerHTML).not.toMatch(
      /answerBlock|answer_block|correctIndex|correct_index|referenceSolution|hiddenTest|referenceAnswer|rubricVersion|maxPoints/i,
    )
  })
})