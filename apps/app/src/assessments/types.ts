/**
 * Assessment contract types (openapi.yaml, Phase 2 pack).
 *
 * The server never returns hidden grading content: `answerBlock` /
 * `correctIndex` are absent from these shapes by contract. The learner's own
 * `answer` IS echoed on the owner-scoped attempts read route (#40 D-01).
 */

export type AssessmentFormat = 'objective' | 'written' | 'coding'
/** Authored written subtype (`Question.subtype`); absent for objective/coding. */
export type WrittenSubtype = 'short_answer' | 'long_form'
/** Contract budget for `WrittenAnswer.text` (mirrors the server gate). */
export const WRITTEN_ANSWER_MAX_LENGTH = 20000
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

export interface Question {
  id: string
  assessmentId: string
  materialId: string
  format: AssessmentFormat
  /** Written questions only: the authored subtype. Absent for objective/coding. */
  subtype?: WrittenSubtype
  prompt: string
  options: string[]
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

/** The learner's own answer: objective shapes (#39) or written free text (#41). */
export type LearnerAnswer = ObjectiveAnswer | WrittenAnswer

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