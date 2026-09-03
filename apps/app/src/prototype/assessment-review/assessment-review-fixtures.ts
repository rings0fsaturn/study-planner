// PROTOTYPE — throwaway. Assessment Review + Feedback UX for wayfinder #34.
// Answers: "how should graded results, rubric breakdowns, per-test-case tables,
// and per-question explanations render in the /assessments/:id review view?"
// Nothing persists.
//
// Five contract-shaped mock assessments, one per review state. Content is lifted
// from services/intelligence/contracts/phase2/fixtures/ (generation-success,
// generation-partial, written-grading, execution-pass, execution-compile-failure)
// reshaped into the live Assessment / Question shapes mirrored in
// apps/app/src/assessments/types.ts. No hidden answers, rubrics, reference
// solutions, or hidden tests appear anywhere in these mocks (AC4).

import type { Assessment, Question, Warning } from '../../assessments/types';

export type MockAttemptGrader = 'objective' | 'llm_rubric' | 'judge0';

export interface MockTestResult {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
}

export interface MockExecution {
  compile: {
    status: 'not_run' | 'passed' | 'failed';
    exitCode: number | null;
    stdout?: string;
    stderr?: string;
    durationMs?: number;
  };
  runtime: {
    status: 'not_run' | 'succeeded' | 'failed';
    exitCode: number | null;
    stdout?: string;
    stderr?: string;
    durationMs?: number;
  };
  testCases: MockTestResult[];
}

export interface MockRubricCriterion {
  label: string;
  outcome: 'met' | 'partial' | 'not_met';
  score: number;
}

export interface MockAttempt {
  attemptId: string;
  questionId: string;
  attemptedAt: string;
  score: number;
  correct: boolean;
  grader: MockAttemptGrader;
  publicFeedback: string;
  explanation?: string;
  modelVersion?: string;
  /** Written family only: per-criterion PUBLIC feedback view-model — never a rubric key. */
  rubricCriteria?: MockRubricCriterion[];
  /** Learner's chosen option index (objective family only) — never the correct index. */
  selectedOptionIndex?: number;
  /** Execution envelope (coding family only). */
  execution?: MockExecution;
  perSkill: { skillTag: string; score: number; correct: boolean; confidence?: number }[];
  /** In-component queued state for prototype retry UX — never persisted. */
  isQueued?: boolean;
}

export type MockQuestionStatus = 'graded' | 'processing' | 'pending';

export interface MockQuestion extends Question {
  status: MockQuestionStatus;
  attempts: MockAttempt[];
}

export interface MockAssessmentAttempt {
  attemptId: string;
  startedAt: string;
  completedAt?: string;
  score?: number;
  correctCount?: number;
  totalCount?: number;
  status: 'processing' | 'partial' | 'graded' | 'failed';
}

export interface MockAssessment extends Assessment {
  attempts: MockAssessmentAttempt[];
  questions: MockQuestion[];
}

function warning(code: string, message: string, questionId?: string): Warning {
  return questionId ? { code, message, questionId } : { code, message };
}

const STRATEGIC_GAP_CHUNK = 'e54cb3cac7bc4d6ca7c5dba213563b75';
const NORMALIZATION_CHUNK = 'f91a2b6c9d0e4f5a8b7c6d5e4f3a2b1c';
const MEDIAN_CHUNK = '0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d';

export const MOCK_ASSESSMENTS: MockAssessment[] = [
  {
    id: 'ready',
    ownerId: 'mock-user',
    materialIds: ['mat-acc-001'],
    status: 'ready',
    groundingStale: true,
    createdAt: '2026-09-01T09:00:00Z',
    attempts: [
      {
        attemptId: 'att-1',
        startedAt: '2026-09-01T09:05:00Z',
        completedAt: '2026-09-01T09:07:12Z',
        score: 0.67,
        correctCount: 2,
        totalCount: 3,
        status: 'graded',
      },
    ],
    warnings: [
      warning(
        'grounding_stale',
        'Material was replaced — regenerate before trusting new questions.',
      ),
    ],
    questions: [
      {
        id: 'q-ready-1',
        assessmentId: 'ready',
        materialId: 'mat-acc-001',
        format: 'objective',
        prompt:
          'After strategic analysis, what term describes the shortfall between an organisation\u2019s forecast position and its long-term targets?',
        options: ['Planning gap', 'Efficiency gap', 'Expansion gap', 'Diversification gap'],
        skillTags: ['Strategic Planning', 'Gap Analysis'],
        authoredDifficulty: 3,
        citations: [
          {
            chunkId: STRATEGIC_GAP_CHUNK,
            materialId: 'mat-acc-001',
            quote:
              'the planning gap is the shortfall between forecast position and long-term targets',
          },
        ],
        status: 'graded',
        attempts: [
          {
            attemptId: 'att-1-q1',
            questionId: 'q-ready-1',
            attemptedAt: '2026-09-01T09:05:40Z',
            score: 1,
            correct: true,
            grader: 'objective',
            publicFeedback: 'Correct.',
            selectedOptionIndex: 0,
            perSkill: [
              { skillTag: 'Strategic Planning', score: 1, correct: true },
              { skillTag: 'Gap Analysis', score: 1, correct: true },
            ],
          },
        ],
      },
      {
        id: 'q-ready-2',
        assessmentId: 'ready',
        materialId: 'mat-acc-001',
        format: 'written',
        prompt:
          'In your own words, explain why a database normalises repeated column values and how that affects storage layout.',
        options: [],
        skillTags: ['Database Internals', 'normalization'],
        authoredDifficulty: 2,
        citations: [
          {
            chunkId: NORMALIZATION_CHUNK,
            materialId: 'mat-acc-001',
            quote:
              'normalising repeated values trades wider row scans for a smaller stored dictionary',
          },
        ],
        status: 'graded',
        attempts: [
          {
            attemptId: 'att-1-q2',
            questionId: 'q-ready-2',
            attemptedAt: '2026-09-01T09:06:05Z',
            score: 1,
            correct: true,
            grader: 'llm_rubric',
            publicFeedback: 'Correct core explanation; add the edge case.',
            explanation:
              'You explained the storage trade-off clearly. Mention how a full column with nulls would change the decision.',
            rubricCriteria: [
              { label: 'Names the storage trade-off', outcome: 'met', score: 1 },
              { label: 'Explains the effect on storage layout', outcome: 'met', score: 1 },
            ],
            perSkill: [{ skillTag: 'normalization', score: 1, correct: true }],
          },
        ],
      },
      {
        id: 'q-ready-3',
        assessmentId: 'ready',
        materialId: 'mat-acc-001',
        format: 'coding',
        prompt: 'Write a function that returns the sum of an array of integers.',
        options: [],
        skillTags: ['Arrays'],
        authoredDifficulty: 3,
        citations: [
          {
            chunkId: MEDIAN_CHUNK,
            materialId: 'mat-acc-001',
            quote:
              'the canonical solution iterates once and accumulates into a running total',
          },
        ],
        status: 'graded',
        attempts: [
          {
            attemptId: 'att-1-q3',
            questionId: 'q-ready-3',
            attemptedAt: '2026-09-01T09:06:48Z',
            score: 0,
            correct: false,
            grader: 'judge0',
            publicFeedback: 'The submission did not compile.',
            explanation: 'A syntax error stopped the run before any test case executed.',
            execution: {
              compile: { status: 'failed', exitCode: 1, stderr: 'SyntaxError: Unexpected token', durationMs: 12 },
              runtime: { status: 'not_run', exitCode: null },
              testCases: [
                { name: 'empty array', passed: false, expected: '0', actual: '—' },
                { name: 'single element', passed: false, expected: '5', actual: '—' },
                { name: 'mixed negatives', passed: false, expected: '3', actual: '—' },
              ],
            },
            perSkill: [{ skillTag: 'Arrays', score: 0, correct: false }],
          },
        ],
      },
    ],
  },
  {
    id: 'partial',
    ownerId: 'mock-user',
    materialIds: ['mat-acc-001'],
    status: 'partial',
    groundingStale: false,
    createdAt: '2026-09-01T10:00:00Z',
    attempts: [
      {
        attemptId: 'att-1',
        startedAt: '2026-09-01T10:10:00Z',
        completedAt: '2026-09-01T10:11:02Z',
        score: 0.5,
        correctCount: 1,
        totalCount: 2,
        status: 'partial',
      },
    ],
    warnings: [
      warning(
        'citation_missing',
        'Question 3 references a source chunk that is no longer available.',
        'q-part-3',
      ),
    ],
    questions: [
      {
        id: 'q-part-1',
        assessmentId: 'partial',
        materialId: 'mat-acc-001',
        format: 'objective',
        prompt:
          'After strategic analysis, what term describes the shortfall between an organisation\u2019s forecast position and its long-term targets?',
        options: ['Planning gap', 'Efficiency gap', 'Expansion gap', 'Diversification gap'],
        skillTags: ['Strategic Planning', 'Gap Analysis'],
        authoredDifficulty: 3,
        citations: [
          {
            chunkId: STRATEGIC_GAP_CHUNK,
            materialId: 'mat-acc-001',
            quote:
              'the planning gap is the shortfall between forecast position and long-term targets',
          },
        ],
        status: 'graded',
        attempts: [
          {
            attemptId: 'att-1-q1',
            questionId: 'q-part-1',
            attemptedAt: '2026-09-01T10:10:20Z',
            score: 1,
            correct: true,
            grader: 'objective',
            publicFeedback: 'Correct.',
            selectedOptionIndex: 0,
            perSkill: [
              { skillTag: 'Strategic Planning', score: 1, correct: true },
              { skillTag: 'Gap Analysis', score: 1, correct: true },
            ],
          },
        ],
      },
      {
        id: 'q-part-2',
        assessmentId: 'partial',
        materialId: 'mat-acc-001',
        format: 'written',
        prompt:
          'Describe how an LRU cache evicts entries and what makes it a good fit for page caches.',
        options: [],
        skillTags: ['Caching'],
        authoredDifficulty: 3,
        citations: [
          {
            chunkId: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7',
            materialId: 'mat-acc-001',
            quote:
              'the least-recently-used entry is evicted first, keeping hot pages resident',
          },
        ],
        status: 'graded',
        attempts: [
          {
            attemptId: 'att-1-q2',
            questionId: 'q-part-2',
            attemptedAt: '2026-09-01T10:10:45Z',
            score: 0,
            correct: false,
            grader: 'llm_rubric',
            publicFeedback: 'The core idea is missing the eviction ordering rule.',
            explanation:
              'You described caching generally. Name the recency ordering and what changes when the cache is full.',
            rubricCriteria: [
              { label: 'Names the recency ordering rule', outcome: 'not_met', score: 0 },
              { label: 'Explains what changes when the cache is full', outcome: 'not_met', score: 0 },
            ],
            perSkill: [{ skillTag: 'Caching', score: 0, correct: false }],
          },
        ],
      },
      {
        id: 'q-part-3',
        assessmentId: 'partial',
        materialId: 'mat-acc-001',
        format: 'objective',
        prompt: 'Which consistency model gives the strongest ordering guarantees?',
        options: ['Linearizability', 'Eventual consistency', 'Read-your-writes', 'Causal consistency'],
        skillTags: ['Consistency'],
        authoredDifficulty: 3,
        citations: [],
        status: 'processing',
        attempts: [],
      },
    ],
  },
  {
    id: 'processing',
    ownerId: 'mock-user',
    materialIds: ['mat-acc-001'],
    status: 'partial',
    groundingStale: false,
    createdAt: '2026-09-01T11:00:00Z',
    attempts: [
      {
        attemptId: 'att-1',
        startedAt: '2026-09-01T11:05:00Z',
        status: 'processing',
      },
    ],
    warnings: [],
    questions: [
      {
        id: 'q-proc-1',
        assessmentId: 'processing',
        materialId: 'mat-acc-001',
        format: 'objective',
        prompt:
          'After strategic analysis, what term describes the shortfall between an organisation\u2019s forecast position and its long-term targets?',
        options: ['Planning gap', 'Efficiency gap', 'Expansion gap', 'Diversification gap'],
        skillTags: ['Strategic Planning', 'Gap Analysis'],
        authoredDifficulty: 3,
        citations: [
          {
            chunkId: STRATEGIC_GAP_CHUNK,
            materialId: 'mat-acc-001',
            quote:
              'the planning gap is the shortfall between forecast position and long-term targets',
          },
        ],
        status: 'processing',
        attempts: [],
      },
      {
        id: 'q-proc-2',
        assessmentId: 'processing',
        materialId: 'mat-acc-001',
        format: 'written',
        prompt:
          'In your own words, explain why a database normalises repeated column values and how that affects storage layout.',
        options: [],
        skillTags: ['Database Internals', 'normalization'],
        authoredDifficulty: 2,
        citations: [
          {
            chunkId: NORMALIZATION_CHUNK,
            materialId: 'mat-acc-001',
            quote:
              'normalising repeated values trades wider row scans for a smaller stored dictionary',
          },
        ],
        status: 'processing',
        attempts: [],
      },
      {
        id: 'q-proc-3',
        assessmentId: 'processing',
        materialId: 'mat-acc-001',
        format: 'coding',
        prompt: 'Write a function that returns the sum of an array of integers.',
        options: [],
        skillTags: ['Arrays'],
        authoredDifficulty: 3,
        citations: [
          {
            chunkId: MEDIAN_CHUNK,
            materialId: 'mat-acc-001',
            quote:
              'the canonical solution iterates once and accumulates into a running total',
          },
        ],
        status: 'processing',
        attempts: [],
      },
    ],
  },
  {
    id: 'failed',
    ownerId: 'mock-user',
    materialIds: ['mat-acc-001'],
    status: 'failed',
    groundingStale: false,
    createdAt: '2026-09-01T12:00:00Z',
    attempts: [],
    warnings: [
      warning(
        'safety_block',
        'Grading was blocked by the safety policy. No questions were scored.',
      ),
    ],
    questions: [],
  },
  {
    id: 'retried',
    ownerId: 'mock-user',
    materialIds: ['mat-acc-001'],
    status: 'ready',
    groundingStale: false,
    createdAt: '2026-09-01T13:00:00Z',
    attempts: [
      {
        attemptId: 'att-1',
        startedAt: '2026-09-01T13:05:00Z',
        completedAt: '2026-09-01T13:06:30Z',
        score: 0.33,
        correctCount: 1,
        totalCount: 3,
        status: 'graded',
      },
      {
        attemptId: 'att-2',
        startedAt: '2026-09-01T13:30:00Z',
        completedAt: '2026-09-01T13:31:14Z',
        score: 1,
        correctCount: 3,
        totalCount: 3,
        status: 'graded',
      },
    ],
    warnings: [],
    questions: [
      {
        id: 'q-retry-1',
        assessmentId: 'retried',
        materialId: 'mat-acc-001',
        format: 'objective',
        prompt: 'Which HTTP method should replace an existing resource idempotently?',
        options: ['PUT', 'POST', 'PATCH', 'DELETE'],
        skillTags: ['HTTP', 'REST'],
        authoredDifficulty: 2,
        citations: [
          {
            chunkId: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
            materialId: 'mat-acc-001',
            quote: 'PUT replaces the resource at the target URI with the request body',
          },
        ],
        status: 'graded',
        attempts: [
          {
            attemptId: 'att-1-q1',
            questionId: 'q-retry-1',
            attemptedAt: '2026-09-01T13:05:20Z',
            score: 0.33,
            correct: false,
            grader: 'objective',
            publicFeedback: 'Not quite — POST does not promise idempotency.',
            explanation: 'POST is allowed to create a new resource each time it is sent.',
            selectedOptionIndex: 1,
            perSkill: [
              { skillTag: 'HTTP', score: 0.33, correct: false },
              { skillTag: 'REST', score: 0.33, correct: false },
            ],
          },
          {
            attemptId: 'att-2-q1',
            questionId: 'q-retry-1',
            attemptedAt: '2026-09-01T13:30:20Z',
            score: 1,
            correct: true,
            grader: 'objective',
            publicFeedback: 'Correct.',
            selectedOptionIndex: 0,
            perSkill: [
              { skillTag: 'HTTP', score: 1, correct: true },
              { skillTag: 'REST', score: 1, correct: true },
            ],
          },
        ],
      },
      {
        id: 'q-retry-2',
        assessmentId: 'retried',
        materialId: 'mat-acc-001',
        format: 'written',
        prompt:
          'Describe how an LRU cache evicts entries and what makes it a good fit for page caches.',
        options: [],
        skillTags: ['Caching'],
        authoredDifficulty: 3,
        citations: [
          {
            chunkId: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7',
            materialId: 'mat-acc-001',
            quote:
              'the least-recently-used entry is evicted first, keeping hot pages resident',
          },
        ],
        status: 'graded',
        attempts: [
          {
            attemptId: 'att-1-q2',
            questionId: 'q-retry-2',
            attemptedAt: '2026-09-01T13:05:50Z',
            score: 1,
            correct: true,
            grader: 'llm_rubric',
            publicFeedback: 'Correct core explanation; add the edge case.',
            explanation:
              'You named the eviction order and the cache-full behaviour clearly.',
            rubricCriteria: [
              { label: 'Names the eviction order', outcome: 'met', score: 1 },
              { label: 'Explains the cache-full behaviour', outcome: 'met', score: 1 },
            ],
            perSkill: [{ skillTag: 'Caching', score: 1, correct: true }],
          },
          {
            attemptId: 'att-2-q2',
            questionId: 'q-retry-2',
            attemptedAt: '2026-09-01T13:30:40Z',
            score: 1,
            correct: true,
            grader: 'llm_rubric',
            publicFeedback: 'Correct.',
            rubricCriteria: [
              { label: 'Names the eviction order', outcome: 'met', score: 1 },
              { label: 'Explains the cache-full behaviour', outcome: 'met', score: 1 },
            ],
            perSkill: [{ skillTag: 'Caching', score: 1, correct: true }],
          },
        ],
      },
      {
        id: 'q-retry-3',
        assessmentId: 'retried',
        materialId: 'mat-acc-001',
        format: 'coding',
        prompt: 'Write a function that returns the sum of an array of integers.',
        options: [],
        skillTags: ['Arrays'],
        authoredDifficulty: 3,
        citations: [
          {
            chunkId: MEDIAN_CHUNK,
            materialId: 'mat-acc-001',
            quote:
              'the canonical solution iterates once and accumulates into a running total',
          },
        ],
        status: 'graded',
        attempts: [
          {
            attemptId: 'att-1-q3',
            questionId: 'q-retry-3',
            attemptedAt: '2026-09-01T13:06:10Z',
            score: 1,
            correct: true,
            grader: 'judge0',
            publicFeedback: 'All public checks passed.',
            execution: {
              compile: { status: 'not_run', exitCode: null },
              runtime: { status: 'succeeded', exitCode: 0, stdout: '4\n', stderr: '', durationMs: 18 },
              testCases: [
                { name: 'empty array', passed: true, expected: '0', actual: '0' },
                { name: 'single element', passed: true, expected: '5', actual: '5' },
                { name: 'mixed negatives', passed: true, expected: '3', actual: '3' },
              ],
            },
            perSkill: [{ skillTag: 'Arrays', score: 1, correct: true }],
          },
        ],
      },
    ],
  },
];

export const MOCK_STATE_KEYS = ['ready', 'partial', 'processing', 'failed', 'retried'] as const;

export type MockStateKey = (typeof MOCK_STATE_KEYS)[number];

export const MOCK_STATE_TITLES: Record<MockStateKey, string> = {
  ready: 'Ready',
  partial: 'Partial',
  processing: 'Processing',
  failed: 'Failed',
  retried: 'Retried',
};

export function getMockAssessment(state: MockStateKey): MockAssessment {
  return MOCK_ASSESSMENTS.find((assessment) => assessment.id === state) ?? MOCK_ASSESSMENTS[0];
}