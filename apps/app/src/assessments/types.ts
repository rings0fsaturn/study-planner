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