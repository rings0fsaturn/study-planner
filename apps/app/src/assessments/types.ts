/**
 * Assessment contract types (openapi.yaml, Phase 2 pack).
 *
 * The server never returns hidden grading content: `answerBlock` /
 * `correctIndex` are absent from these shapes by contract.
 */

export type AssessmentFormat = 'objective' | 'written' | 'coding'
export type AssessmentStatus = 'generating' | 'ready' | 'partial' | 'failed'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled'
export type JobKind = 'ingestion' | 'generation' | 'grading' | 'roadmap_feedback'

export interface AssessmentRecipe {
  formats: AssessmentFormat[]
  questionCount: number
  difficulty?: number
  skillTags?: string[]
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

/** Body of POST /v1/assessments/{assessmentId}/questions/{questionId}/attempts. */
export interface AttemptSubmitInput {
  clientAttemptId: string
  questionId: string
  answer: ObjectiveAnswer
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
  grade: QuestionGradedResult | null
}