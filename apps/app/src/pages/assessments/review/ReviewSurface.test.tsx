// #40 Phase 3: review surface component matrix — five states, history,
// placeholders, redaction DOM gate. Ports the prototype AC4 comparison.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { LocalAttemptRow } from '../../../assessments/attemptFlow'
import type { Assessment, Question } from '../../../assessments/types'
import {
  ReviewSurface,
  QuestionReviewCard,
  AttemptHistoryBlock,
} from './ReviewSurface'
import { buildReviewModel, deriveTimelineSeed } from './reviewModel'

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    assessmentId: 'ass-1',
    materialId: 'mat-1',
    format: 'objective',
    prompt: 'Which term names the shortfall?',
    options: ['Planning gap', 'Efficiency gap', 'Expansion gap'],
    skillTags: ['Strategic Planning'],
    authoredDifficulty: 3,
    citations: [{ chunkId: 'chunk-1', materialId: 'mat-1', quote: 'the planning gap is the shortfall' }],
    ...overrides,
  }
}

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 'ass-1',
    ownerId: 'user-1',
    materialIds: ['mat-1'],
    status: 'ready',
    questions: [question()],
    warnings: [],
    groundingStale: false,
    createdAt: '2026-09-03T09:00:00Z',
    ...overrides,
  }
}

function gradedRow(overrides: Partial<LocalAttemptRow> = {}): LocalAttemptRow {
  return {
    clientAttemptId: 'ca-1',
    attemptId: 'att-1',
    questionId: 'q1',
    assessmentId: 'ass-1',
    answer: { index: 0 },
    status: 'graded',
    submittedAt: '2026-09-03T10:00:00Z',
    grade: {
      attemptId: 'att-1',
      questionId: 'q1',
      materialId: 'mat-1',
      score: 1,
      correct: true,
      perSkill: [{ skillTag: 'Strategic Planning', score: 1, correct: true }],
      grader: 'objective',
      gradedAt: '2026-09-03T10:05:00Z',
      publicFeedback: 'Correct.',
    },
    ...overrides,
  }
}

function renderSurface(ass: Assessment, rows: LocalAttemptRow[]) {
  const model = buildReviewModel(ass, rows)
  const timeline = deriveTimelineSeed(model.groups)
  return render(
    <ReviewSurface
      assessment={ass}
      model={model}
      timeline={timeline}
      activeIndex={0}
      onSelect={() => {}}
      onRetryQuestion={() => {}}
      onRetryAssessment={() => {}}
    />,
  )
}

describe('ReviewSurface ready', () => {
  it('renders verdict, family chips, navigator and your-pick marking', () => {
    const ass = assessment()
    const view = renderSurface(ass, [gradedRow()])

    expect(screen.getByText('1 of 1 questions correct · score 1.00')).toBeInTheDocument()
    expect(screen.getByText('Objective 1/1')).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Question navigator' })).toBeInTheDocument()
    const tab = screen.getByRole('tab', { name: 'Question 1, correct' })
    expect(tab.getAttribute('aria-current')).toBe('true')
    // Objective your-pick marker from the echoed answer (D-01).
    expect(screen.getByText('your answer')).toBeInTheDocument()
    expect(screen.getByText('Planning gap')).toBeInTheDocument()
    // Per-skill + citations + feedback line.
    expect(screen.getByText('Skills observed')).toBeInTheDocument()
    expect(screen.getByText('Correct.')).toBeInTheDocument()

    const html = view.container.innerHTML
    expect(html).not.toMatch(/answerBlock|answer_block|correctIndex|correct_index|referenceSolution|hiddenTest/i)
  })

  it('keeps warnings as role=status with jump-to-question', () => {
    const ass = assessment({
      warnings: [{ code: 'citation_unverified', message: 'quote drifted', questionId: 'q1' }],
    })
    renderSurface(ass, [gradedRow()])
    expect(screen.getByRole('status', { name: 'Assessment warnings' })).toBeInTheDocument()
    expect(screen.getByText('quote drifted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to question' })).toBeInTheDocument()
  })
})

describe('ReviewSurface states', () => {
  it('partial shows graded panel plus in-flight skeleton copy', () => {
    const ass = assessment({
      status: 'partial',
      questions: [question({ id: 'q1' }), question({ id: 'q2', prompt: 'Second?' })],
    })
    renderSurface(ass, [
      gradedRow(),
      gradedRow({ clientAttemptId: 'ca-2', attemptId: null, questionId: 'q2', status: 'queued', grade: null, answer: undefined }),
    ])
    expect(screen.getByText('1 of 2 graded · score so far 1.00')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Question 1, correct' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Question 2, processing' })).toBeInTheDocument()
  })

  it('processing with no attempts shows the pending copy', () => {
    const ass = assessment()
    renderSurface(ass, [])
    expect(screen.getByText('This question is waiting to be graded.')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 graded · scores pending')).toBeInTheDocument()
  })

  it('failed with no questions renders the empty card with retry', () => {
    const ass = assessment({
      status: 'failed',
      questions: [],
      warnings: [{ code: 'safety_block', message: 'blocked' }],
    })
    renderSurface(ass, [])
    expect(screen.getByRole('status', { name: 'No questions to review' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry assessment' })).toBeInTheDocument()
    expect(screen.getByText('Grading blocked · no questions scored')).toBeInTheDocument()
  })
})

describe('ReviewSurface retried', () => {
  it('renders history oldest to latest with latest expanded', () => {
    const ass = assessment()
    const rows = [
      gradedRow({
        clientAttemptId: 'ca-1',
        attemptId: 'att-1',
        submittedAt: '2026-09-03T10:00:00Z',
        answer: { index: 1 },
        grade: { ...gradedRow().grade!, attemptId: 'att-1', score: 0, correct: false, publicFeedback: 'Not correct.' },
      }),
      gradedRow({
        clientAttemptId: 'ca-2',
        attemptId: 'att-2',
        submittedAt: '2026-09-03T10:05:00Z',
        answer: { index: 0 },
      }),
    ]
    renderSurface(ass, rows)
    const history = screen.getByLabelText('Attempt history')
    expect(history).toBeInTheDocument()
    const labels = Array.from(history.querySelectorAll('.ar-attempt-label')).map((el) => el.textContent)
    expect(labels).toEqual(['Attempt #1', 'Attempt #2'])
    // Latest expanded shows its feedback; prior stays collapsed until toggled.
    expect(screen.getByText('Correct.')).toBeInTheDocument()
    expect(screen.queryByText('Not correct.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Attempt #1/ }))
    expect(screen.getByText('Not correct.')).toBeInTheDocument()
  })

  it('shows the queued note when a retry is in flight and hides its retry control', () => {
    const ass = assessment()
    const rows = [
      gradedRow({ clientAttemptId: 'ca-1' }),
      gradedRow({ clientAttemptId: 'ca-2', attemptId: null, status: 'queued', grade: null, answer: { index: 2 } }),
    ]
    renderSurface(ass, rows)
    expect(screen.getByText(/New attempt queued — previous attempt kept/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry question' })).not.toBeInTheDocument()
  })
})

describe('family extension points', () => {
  it('written renders the learner answer, the rubric breakdown and the explanation', () => {
    const q = question({ format: 'written', subtype: 'long_form', options: [], prompt: 'Explain in your own words.' })
    const attempt = gradedRow({
      questionId: q.id,
      answer: { text: 'Bias correction rescales the moments so early steps are not pulled toward zero.' },
      grade: {
        ...gradedRow().grade!,
        grader: 'llm_rubric',
        score: 0.75,
        explanation: 'Clear trade-off.',
        rubricBreakdown: [
          {
            criterion: 'Names both running estimates',
            weight: 0.4,
            score: 1,
            met: true,
            feedback: 'Both averages are identified.',
          },
          {
            criterion: 'Explains why early steps are affected most',
            weight: 0.6,
            score: 0.5833,
            met: false,
            feedback: 'The mechanism is asserted but not explained.',
          },
        ],
      },
    })
    const view = render(<QuestionReviewCard question={q} attempt={attempt} />)

    // The learner's own text stays reviewable, but no key material rides with it.
    expect(
      screen.getByText('Bias correction rescales the moments so early steps are not pulled toward zero.'),
    ).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Rubric breakdown' })
    expect(within(table).getByText('Names both running estimates')).toBeInTheDocument()
    expect(within(table).getByText('Explains why early steps are affected most')).toBeInTheDocument()
    expect(within(table).getByText('40%')).toBeInTheDocument()
    expect(within(table).getByText('60%')).toBeInTheDocument()
    expect(within(table).getByText('0.58')).toBeInTheDocument()
    expect(within(table).getByText('met')).toBeInTheDocument()
    expect(within(table).getByText('not met')).toBeInTheDocument()
    expect(within(table).getByText('Both averages are identified.')).toBeInTheDocument()
    expect(within(table).getByText('The mechanism is asserted but not explained.')).toBeInTheDocument()

    expect(screen.getByText('Clear trade-off.')).toBeInTheDocument()
    expect(screen.getByText('Skills observed')).toBeInTheDocument()
    expect(screen.queryByText('Detailed rubric breakdown arrives with written grading.')).not.toBeInTheDocument()

    expect(view.container.innerHTML).not.toMatch(
      /answerBlock|answer_block|correctIndex|correct_index|referenceSolution|hiddenTest|referenceAnswer|reference_answer|rubricVersion|rubric_version|maxPoints|max_points/i,
    )
  })

  it('written without a breakdown renders the explanation and no table', () => {
    const q = question({ format: 'written', options: [], prompt: 'Explain in your own words.' })
    const attempt = gradedRow({
      questionId: q.id,
      answer: { text: 'An attempt.' },
      grade: { ...gradedRow().grade!, grader: 'llm_rubric', explanation: 'Grading could not complete.' },
    })
    render(<QuestionReviewCard question={q} attempt={attempt} />)
    expect(screen.getByText('Grading could not complete.')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Rubric breakdown' })).not.toBeInTheDocument()
  })

  it('renders the rubric explanation exactly once when it doubles as the feedback line', () => {
    const q = question({ format: 'written', options: [], prompt: 'Explain in your own words.' })
    const base = gradedRow().grade!
    const attempt = gradedRow({
      questionId: q.id,
      answer: { text: 'An attempt.' },
      grade: {
        ...base,
        grader: 'llm_rubric',
        publicFeedback: undefined,
        explanation: 'You covered the mechanism but not the consequence.',
        rubricBreakdown: [
          { criterion: 'Names the mechanism', weight: 1, score: 1, met: true, feedback: 'Named.' },
        ],
      },
    })
    render(<QuestionReviewCard question={q} attempt={attempt} />)
    // The shell's feedback line already prefers the explanation, so the
    // treatment must not print the same sentence twice.
    expect(screen.getAllByText('You covered the mechanism but not the consequence.')).toHaveLength(1)
  })

  it('coding renders the submitted source plus the public verdict table', () => {
    const q = question({ format: 'coding', options: [], prompt: 'Sum an array.' })
    const attempt = gradedRow({
      questionId: q.id,
      answer: { language: 'python', source: 'def solve(ns):\n    return 6\n', config: { stdin: '', timeLimitMs: 15000, memoryLimitMb: 256 } },
      grade: {
        ...gradedRow().grade!,
        grader: 'judge0',
        explanation: 'Passed 3 of 4 tests. Failed: Hidden test 2.',
        testCases: [
          { name: 'adds small list', passed: true, visible: true },
          { name: 'Hidden test 2', passed: false, visible: false },
        ],
      },
    })
    render(<QuestionReviewCard question={q} attempt={attempt} />)
    expect(screen.getByLabelText('Your submitted code')).toHaveTextContent('def solve')
    expect(screen.getByRole('table', { name: 'Test results' })).toBeInTheDocument()
    expect(screen.getByText('adds small list')).toBeInTheDocument()
    expect(screen.getByText('Hidden test 2')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'failed' })).toBeInTheDocument()
  })

  it('coding veils hidden content: names render, stdin and expected never do', () => {
    const q = question({ format: 'coding', options: [], prompt: 'Sum an array.' })
    const attempt = gradedRow({
      questionId: q.id,
      answer: { language: 'python', source: 'def solve(ns):\n    pass\n', config: { stdin: '', timeLimitMs: 15000, memoryLimitMb: 256 } },
      grade: {
        ...gradedRow().grade!,
        grader: 'judge0',
        testCases: [{ name: 'Hidden test 1', passed: true, visible: false }],
      },
    })
    const view = render(<QuestionReviewCard question={q} attempt={attempt} />)
    expect(view.container.innerHTML).not.toMatch(
      /answerBlock|answer_block|referenceSolution|hiddenTest|expectedOutput|stdin/i,
    )
  })

  it('output_prediction renders the snippet and the learner value, no verdict table', () => {
    const q = question({
      format: 'coding',
      subtype: 'output_prediction',
      options: [],
      prompt: 'What does this snippet print?',
      starterCode: 'total = 0\nfor n in range(4):\n    total += n\nprint(total)\n',
    })
    const attempt = gradedRow({
      questionId: q.id,
      answer: { value: '6' },
      grade: {
        ...gradedRow().grade!,
        grader: 'objective',
        publicFeedback: 'Correct.',
      },
    })
    render(<QuestionReviewCard question={q} attempt={attempt} />)
    expect(screen.getByLabelText('Code snippet')).toHaveTextContent('total += n')
    expect(screen.getByText('Your prediction:')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Test results' })).not.toBeInTheDocument()
  })
})

describe('AttemptHistoryBlock redaction', () => {
  it('never renders hidden key vocabulary', () => {
    const ass = assessment()
    const model = buildReviewModel(ass, [gradedRow()])
    const view = render(<AttemptHistoryBlock group={model.groups[0]} />)
    expect(view.container.innerHTML).not.toMatch(
      /answerBlock|answer_block|correctIndex|correct_index|referenceSolution|hiddenTest/i,
    )
  })

  it('navigator arrow keys move the active question', () => {
    const onSelect = vi.fn()
    const ass = assessment({
      questions: [question({ id: 'q1' }), question({ id: 'q2', prompt: 'Second?' })],
    })
    const model = buildReviewModel(ass, [gradedRow()])
    const timeline = deriveTimelineSeed(model.groups)
    render(
      <ReviewSurface
        assessment={ass}
        model={model}
        timeline={timeline}
        activeIndex={0}
        onSelect={onSelect}
        onRetryQuestion={() => {}}
        onRetryAssessment={() => {}}
      />,
    )
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
