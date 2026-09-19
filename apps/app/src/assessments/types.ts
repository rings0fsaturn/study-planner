/**
 * Assessment contract types (openapi.yaml, Phase 2 pack).
 *
 * The server never returns hidden grading content: `answerBlock` /
 * `correctIndex` are absent from these shapes by contract. The learner's own
 * `answer` IS echoed on the owner-scoped attempts read route (#40 D-01).
 */

export type AssessmentFormat = 'objective' | 'written' | 'coding'
/** Authored written subtype (`Question.subtype`). */
export type WrittenSubtype = 'short_answer' | 'long_form'
/** Authored coding subtype (`Question.subtype`, #42 D-09). */
export type CodingSubtype = 'implement_fn' | 'debug' | 'output_prediction' | 'complete_code'
/** Every authored subtype a `Question` may carry; absent for objective. */
export type QuestionSubtype = WrittenSubtype | CodingSubtype
/** Contract budget for `WrittenAnswer.text` (mirrors the server gate). */
export const WRITTEN_ANSWER_MAX_LENGTH = 20000

/** Day 1 sandbox language (openapi CodingAnswer.language). */
export type CodingLanguage = 'python'
/** Subtype graded by value match, not by the sandbox (#42 D-01). */
export const OUTPUT_PREDICTION_SUBTYPE: CodingSubtype = 'output_prediction'
/** Contract budgets for `CodingAnswer`, mirroring the server gates. */
export const CODING_SOURCE_MAX_LENGTH = 100000
export const CODING_STDIN_MAX_LENGTH = 20000
export const CODING_TIME_LIMIT_MIN_MS = 100
export const CODING_TIME_LIMIT_MAX_MS = 30000
export const CODING_MEMORY_MIN_MB = 16
export const CODING_MEMORY_MAX_MB = 1024
/**
 * Defaults a coding submission opens with. The sandbox clamps to its own
 * ceilings (15 s CPU / 256 MB), so offering more than these would promise a
 * budget the server cannot honour.
 */
export const CODING_TIME_LIMIT_DEFAULT_MS = 15000
export const CODING_MEMORY_DEFAULT_MB = 256
export type AssessmentStatus = 'generating' | 'ready' | 'partial' | 'failed'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled'
export type JobKind = 'ingestion' | 'generation' | 'grading' | 'roadmap_feedback'

/** The learner's page scope for one generation request (openapi AssessmentScope). */
export interface AssessmentScope {
  /** First PDF page of the range, in the numbering the viewer shows. */
  pageStart: number
  /** Last PDF page of the range; the server bounds it by the material's page count. */
  pageEnd: number
  /** The outline row's title when a chapter was picked; it steers retrieval. */
  sectionLabel?: string
}

export interface AssessmentRecipe {
  formats: AssessmentFormat[]
  questionCount: number
  difficulty?: number
  skillTags?: string[]
  /** Chosen pages (P4/D-05). Absent means the whole material. */
  scope?: AssessmentScope
}

export interface GenerationRequest {
  clientId: string
  materialIds: string[]
  recipe: AssessmentRecipe
  correlationId: string
}

export interface Citation {
  chunkId: string
  materialId: string
  quote: string
  startSeconds?: number
}

export interface Warning {
  code: string
  message: string
  questionId?: string
}

/** One learner-visible test case of a coding question (openapi VisibleTestCase). */
export interface VisibleTestCase {
  name: string
  stdin: string
  expectedOutput: string
}

export interface Question {
  id: string
  assessmentId: string
  materialId: string
  format: AssessmentFormat
  /**
   * The authored subtype. Written questions carry `short_answer`/`long_form`;
   * coding questions carry the P3-authored subtype (#42 D-09); absent for
   * objective.
   */
  subtype?: QuestionSubtype
  prompt: string
  options: string[]
  /** Coding questions only (`subtype` for `output_prediction` holds the snippet). */
  starterCode?: string
  /** Coding questions only: tests the advisory runner may execute in browser. */
  visibleTests?: VisibleTestCase[]
  skillTags: string[]
  authoredDifficulty: number
  citations: Citation[]
}

export interface Assessment {
  id: string
  ownerId: string
  materialIds: string[]
  status: AssessmentStatus
  questions: Question[]
  /** Echoed by the read route; absent on rows stored before the retry fix (#41). */
  recipe?: AssessmentRecipe
  warnings: Warning[]
  groundingStale: boolean
  createdAt: string
}

export interface ServiceErrorShape {
  code: string
  message: string
  requestId: string
  retryable: boolean
  retryAfterSeconds?: number
}

export interface AsyncJob {
  jobId: string
  kind: JobKind
  status: JobStatus
  ownerId: string
  correlationId: string
  attempt?: number
  resultId?: string
  result?: unknown
  error?: ServiceErrorShape
  createdAt: string
  completedAt?: string
}

export type AssessmentServiceErrorCode =
  | 'unauthorized'
  | 'conflict'
  | 'quota_exhausted'
  | 'timeout'
  | 'network'
  | 'service'
  | 'not_found'
  | 'validation'
  | 'unknown'

export class AssessmentServiceError extends Error {
  constructor(
    readonly code: AssessmentServiceErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
    /** Echo of the X-Request-ID sent with the call, for log joins. */
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'AssessmentServiceError'
  }
}

/** Learner's objective answer — one shape per objective subtype (#39). */
export interface ObjectiveAnswer {
  /** mcq: the chosen option index. */
  index?: number
  /** multi_select: chosen indices (set equality, order-insensitive). */
  indices?: number[]
  /** true_false. */
  flag?: boolean
  /** cloze / numeric: free text or numeric-as-string. */
  value?: string
}

/** Learner's free-text answer for a written question (#41 D-02). */
export interface WrittenAnswer {
  text: string
}

/** Learner's source submission for a coding question (openapi CodingAnswer). */
export interface CodingAnswer {
  language: CodingLanguage
  source: string
  config: {
    stdin: string
    timeLimitMs: number
    memoryLimitMb: number
  }
}

/**
 * The learner's own answer: objective shapes (#39), written free text (#41),
 * or a coding submission (#42). The server echoes the learner's own answer on
 * the owner-scoped read route (#40 D-01).
 */
export type LearnerAnswer = ObjectiveAnswer | WrittenAnswer | CodingAnswer

/** Body of POST /v1/assessments/{assessmentId}/questions/{questionId}/attempts. */
export interface AttemptSubmitInput {
  clientAttemptId: string
  questionId: string
  answer: LearnerAnswer
  submittedAt: string
  elapsedSeconds?: number
  correlationId: string
}

/** 201/200 response of the attempt submit route. */
export interface AttemptCreated {
  attemptId: string
  questionId: string
  status: 'queued' | 'graded' | 'failed'
  jobId: string
}

/** One learner-facing rubric criterion outcome (`RubricCriterionResult`). */
export interface RubricCriterionResult {
  criterion: string
  /** The criterion's share of the rubric total (contract-valid, sums to 1). */
  weight: number
  score: number
  met: boolean
  feedback?: string
}

/** Public grade block (openapi QuestionGraded) — no key material. */
export interface QuestionGradedResult {
  attemptId: string
  questionId: string
  materialId: string
  score: number
  correct: boolean
  perSkill?: Array<{
    skillTag: string
    score: number
    correct: boolean
    confidence?: number
  }>
  explanation?: string
  grader: 'objective' | 'llm_rubric' | 'judge0'
  modelVersion?: string
  gradedAt: string
  publicFeedback?: string
  /** Written grading only (`grader: llm_rubric`); the rubric itself stays server-side. */
  rubricBreakdown?: RubricCriterionResult[]
  /**
   * Coding grading only (`grader: judge0`): the public per-test verdicts.
   * Hidden tests are named `Hidden test N` and carry no content.
   */
  testCases?: TestCaseResult[]
}

/** One public per-test verdict of a coding grade (openapi TestCaseResult). */
export interface TestCaseResult {
  name: string
  passed: boolean
  visible: boolean
}

/** One attempt in GET /v1/assessments/{assessmentId}/attempts (public record). */
export interface AttemptRecord {
  attemptId: string
  clientAttemptId: string
  questionId: string
  assessmentId: string
  submittedAt: string
  status: 'queued' | 'graded' | 'failed'
  elapsedSeconds?: number
  /** Learner's own answer, echoed on the owner-scoped read route (#40 D-01). */
  answer?: LearnerAnswer
  grade: QuestionGradedResult | null
}