// PROTOTYPE — throwaway. Practice run summary fixtures for #44 Phase 3.
// Four contract-shaped run states (completed-5 with mixed grades + one
// ungradable attempt + a retried problem, completed-12 for density, thin-2,
// abandoned-4 with in-flight and never-answered problems). Content mirrors the
// live Assessment / Question / LocalAttemptRow shapes from apps/app/src
// (assessments/types.ts + attemptFlow.ts). No hidden answers, rubrics,
// reference solutions, or hidden tests appear anywhere in these mocks (AC4).

import type {
  Assessment,
  Question,
  QuestionGradedResult,
} from '../../assessments/types'
import type { LocalAttemptRow } from '../../assessments/attemptFlow'
import type { PracticeRunFinishedPayload, PracticeRunStartedPayload } from '../../sync/types'
import { buildPracticeRunModel, type PracticeRunModel } from '../../pages/practice/practiceRunModel'

export const MATERIAL_ACCA = 'mat-acca'
export const MATERIAL_DDI = 'mat-ddi'

export const MATERIAL_TITLES: Record<string, string> = {
  [MATERIAL_ACCA]: 'ACCA Financial Management',
  [MATERIAL_DDI]: 'DDI Trade-offs',
}

export interface PrototypeRunState {
  key: string
  title: string
  blurb: string
  started: PracticeRunStartedPayload
  finished: PracticeRunFinishedPayload | null
  assessments: Assessment[]
  rowsByAssessment: Record<string, LocalAttemptRow[]>
}

function question(
  id: string,
  assessmentId: string,
  materialId: string,
  prompt: string,
): Question {
  return {
    id,
    assessmentId,
    materialId,
    format: 'written',
    subtype: 'short_answer',
    prompt,
    options: [],
    skillTags: ['core'],
    authoredDifficulty: 3,
    citations: [
      {
        chunkId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        materialId,
        quote: 'The planning gap is the shortfall between forecast and required performance.',
      },
    ],
  }
}

function assessment(id: string, materialId: string, q: Question): Assessment {
  return {
    id,
    ownerId: 'prototype-user',
    materialIds: [materialId],
    status: 'ready',
    questions: [q],
    warnings: [],
    groundingStale: false,
    createdAt: '2026-09-15T10:00:00Z',
  }
}

function grade(
  questionId: string,
  attemptId: string,
  materialId: string,
  score: number,
  feedback: string,
  rubricBreakdown?: QuestionGradedResult['rubricBreakdown'],
): QuestionGradedResult {
  const correct = score >= 0.6
  return {
    attemptId,
    questionId,
    materialId,
    score,
    correct,
    perSkill: [{ skillTag: 'core', score, correct, confidence: 0.8 }],
    grader: 'llm_rubric',
    gradedAt: '2026-09-15T10:05:00Z',
    publicFeedback: feedback,
    rubricBreakdown,
  }
}

function row(
  clientAttemptId: string,
  questionId: string,
  assessmentId: string,
  status: LocalAttemptRow['status'],
  answerText: string,
  gradeValue?: QuestionGradedResult,
): LocalAttemptRow {
  return {
    clientAttemptId,
    attemptId: gradeValue ? gradeValue.attemptId : null,
    questionId,
    assessmentId,
    answer: { text: answerText },
    status,
    submittedAt: '2026-09-15T10:02:00Z',
    grade: gradeValue ?? null,
  }
}

const RUBRIC_STRATEGY: QuestionGradedResult['rubricBreakdown'] = [
  { criterion: 'Names both running estimates', weight: 0.4, score: 1, met: true, feedback: 'Both named.' },
  { criterion: 'Explains why early steps are affected most', weight: 0.6, score: 0.9, met: true, feedback: 'Mechanism explained.' },
]

const RUBRIC_PARTIAL: QuestionGradedResult['rubricBreakdown'] = [
  { criterion: 'Names the mechanism', weight: 1, score: 0.6, met: true, feedback: 'Named but shallow.' },
]

const COMPLETED_5: PrototypeRunState = {
  key: 'completed5',
  title: 'Completed · 5 problems · 2 materials',
  blurb: 'Mixed grades (correct / partial / incorrect), one ungradable attempt, one retried problem with preserved history.',
  started: {
    runId: 'run-completed5',
    materialIds: [MATERIAL_ACCA, MATERIAL_DDI],
    mode: 'written',
    assessmentIds: ['a-w1', 'a-w2', 'a-w3', 'a-w4', 'a-w5'],
    count: 5,
  },
  finished: { runId: 'run-completed5', outcome: 'completed' },
  assessments: [
    assessment('a-w1', MATERIAL_ACCA, question('q-w1', 'a-w1', MATERIAL_ACCA, 'Distinguish the planning gap from the efficiency gap, and say which one a stretch forecast closes.')),
    assessment('a-w2', MATERIAL_DDI, question('q-w2', 'a-w2', MATERIAL_DDI, 'Explain why a later-phase defect costs more to fix than one found in the same phase it was introduced.')),
    assessment('a-w3', MATERIAL_ACCA, question('q-w3', 'a-w3', MATERIAL_ACCA, 'Outline how a financial model treats inflation when it projects a multi-year cash flow.')),
    assessment('a-w4', MATERIAL_DDI, question('q-w4', 'a-w4', MATERIAL_DDI, 'Describe the trade-off a team faces when it chooses a lower-coupling architecture for a small product.')),
    assessment('a-w5', MATERIAL_ACCA, question('q-w5', 'a-w5', MATERIAL_ACCA, 'State the purpose of a risk-adjusted discount rate in project appraisal.')),
  ],
  rowsByAssessment: {
    'a-w1': [
      row('ca-w1', 'q-w1', 'a-w1', 'graded', 'The planning gap is what the forecast misses; the efficiency gap is what the plan overruns. A stretch forecast closes the planning gap.',
        grade('q-w1', 'att-w1', MATERIAL_ACCA, 1, 'Clear and grounded — both measures named, and the link to the stretch forecast is explicit.', RUBRIC_STRATEGY)),
    ],
    'a-w2': [
      row('ca-w2a', 'q-w2', 'a-w2', 'graded', 'Later defects cost more because rework touches more code.',
        grade('q-w2', 'att-w2a', MATERIAL_DDI, 0.2, 'Not quite — the mechanism is asserted but not explained.')),
      row('ca-w2b', 'q-w2', 'a-w2', 'graded', 'A defect found late has already propagated into the phases that consumed the faulty output, so the fix must rework every downstream artefact that absorbed the error.',
        grade('q-w2', 'att-w2b', MATERIAL_DDI, 1, 'Good — the propagation mechanism is the point, and it is stated directly.')),
    ],
    'a-w3': [
      row('ca-w3', 'q-w3', 'a-w3', 'graded', 'It applies a constant real-terms assumption unless a specific inflation line is built in.',
        grade('q-w3', 'att-w3', MATERIAL_ACCA, 0.6, 'The direction is right; the answer would be stronger with the nominal-vs-real distinction.', RUBRIC_PARTIAL)),
    ],
    'a-w4': [
      row('ca-w4', 'q-w4', 'a-w4', 'graded', 'Lower coupling costs more up front and buys optionality that a small product may never spend.',
        grade('q-w4', 'att-w4', MATERIAL_DDI, 0.2, 'Not quite — the trade-off is about when the optionality is actually exercised, not only its up-front cost.')),
    ],
    'a-w5': [
      row('ca-w5', 'q-w5', 'a-w5', 'failed', 'It adjusts the discount rate for the project’s risk profile.',
        undefined),
    ],
  },
}

function cycleScores(cycle: number[]): PrototypeRunState {
  const ids = cycle.map((_, index) => index + 1)
  const started: PracticeRunStartedPayload = {
    runId: 'run-completed12',
    materialIds: [MATERIAL_ACCA],
    mode: 'written',
    assessmentIds: ids.map((index) => `a-l${index}`),
    count: cycle.length,
  }
  return {
    key: 'completed12',
    title: 'Completed · 12 problems · 1 material',
    blurb: 'Density check: does the rail / stack / scoreboard stay legible with a long run?',
    started,
    finished: { runId: 'run-completed12', outcome: 'completed' },
    assessments: ids.map((index) =>
      assessment(`a-l${index}`, MATERIAL_ACCA, question(`q-l${index}`, `a-l${index}`, MATERIAL_ACCA, `Written problem ${index} — explain the mechanism behind the twelfth-hour variance.`)),
    ),
    rowsByAssessment: Object.fromEntries(
      ids.map((index) => {
        const score = cycle[index - 1]
        const correct = score >= 0.6
        return [
          `a-l${index}`,
          [
            row(`ca-l${index}`, `q-l${index}`, `a-l${index}`, 'graded', `An answer for problem ${index}.`,
              grade(`q-l${index}`, `att-l${index}`, MATERIAL_ACCA, score, correct ? 'Good answer.' : 'Not quite.')),
          ],
        ]
      }),
    ),
  }
}

const COMPLETED_12 = cycleScores([1, 1, 0.6, 0.2, 1, 1, 0.6, 1, 0.2, 1, 1, 1])

const THIN_2: PrototypeRunState = {
  key: 'thin2',
  title: 'Completed · 2 problems · 2 materials',
  blurb: 'The minimal case — does the surface feel empty or tidy at two problems?',
  started: {
    runId: 'run-thin2',
    materialIds: [MATERIAL_ACCA, MATERIAL_DDI],
    mode: 'written',
    assessmentIds: ['a-t1', 'a-t2'],
    count: 2,
  },
  finished: { runId: 'run-thin2', outcome: 'completed' },
  assessments: [
    assessment('a-t1', MATERIAL_ACCA, question('q-t1', 'a-t1', MATERIAL_ACCA, 'Name the two estimates a financial forecast reconciles.')),
    assessment('a-t2', MATERIAL_DDI, question('q-t2', 'a-t2', MATERIAL_DDI, 'State why a team with a working feature branch still runs a nightly integration build.')),
  ],
  rowsByAssessment: {
    'a-t1': [row('ca-t1', 'q-t1', 'a-t1', 'graded', 'The forecast and the plan.', grade('q-t1', 'att-t1', MATERIAL_ACCA, 1, 'Correct and concise.'))],
    'a-t2': [row('ca-t2', 'q-t2', 'a-t2', 'graded', 'To catch cross-branch drift before it compounds.', grade('q-t2', 'att-t2', MATERIAL_DDI, 1, 'Correct — drift compounding is the reason.'))],
  },
}

const ABANDONED_4: PrototypeRunState = {
  key: 'abandoned',
  title: 'Abandoned · 2 of 4 graded',
  blurb: 'What the summary looks like when the run stopped early: graded problems only, honest counts, no invented observations.',
  started: {
    runId: 'run-abandoned',
    materialIds: [MATERIAL_ACCA],
    mode: 'written',
    assessmentIds: ['a-x1', 'a-x2', 'a-x3', 'a-x4'],
    count: 4,
  },
  finished: { runId: 'run-abandoned', outcome: 'abandoned' },
  assessments: [
    assessment('a-x1', MATERIAL_ACCA, question('q-x1', 'a-x1', MATERIAL_ACCA, 'Explain why the hurdle rate and the cost of capital are not the same number.')),
    assessment('a-x2', MATERIAL_ACCA, question('q-x2', 'a-x2', MATERIAL_ACCA, 'What does sensitivity analysis change about a single-point NPV forecast?')),
    assessment('a-x3', MATERIAL_ACCA, question('q-x3', 'a-x3', MATERIAL_ACCA, 'Define duration as it applies to a bond portfolio.')),
    assessment('a-x4', MATERIAL_ACCA, question('q-x4', 'a-x4', MATERIAL_ACCA, 'When is a deep-discount bond the cheaper funding source?')),
  ],
  rowsByAssessment: {
    'a-x1': [row('ca-x1', 'q-x1', 'a-x1', 'graded', 'The hurdle rate is the return demanded; the cost of capital is what the market prices.',
      grade('q-x1', 'att-x1', MATERIAL_ACCA, 1, 'Good — the demand-vs-price distinction is the core point.'))],
    'a-x2': [row('ca-x2', 'q-x2', 'a-x2', 'graded', 'It swaps the point forecast for a band.', grade('q-x2', 'att-x2', MATERIAL_ACCA, 0.2, 'Not quite — sensitivity analysis ranks which input moves the NPV most, not merely widens it.'))],
    'a-x3': [
      row('ca-x3', 'q-x3', 'a-x3', 'submitted', 'It measures how long it takes to get your money back.',
        undefined),
    ],
    // a-x4: never attempted — no rows at all.
  },
}

export const PROTOTYPE_STATES: Record<string, PrototypeRunState> = {
  completed5: COMPLETED_5,
  completed12: COMPLETED_12,
  thin2: THIN_2,
  abandoned: ABANDONED_4,
}

export function buildPrototypeModel(state: PrototypeRunState): PracticeRunModel {
  return buildPracticeRunModel({
    started: state.started,
    finished: state.finished,
    assessments: state.assessments,
    attemptsByAssessment: state.rowsByAssessment,
  })
}