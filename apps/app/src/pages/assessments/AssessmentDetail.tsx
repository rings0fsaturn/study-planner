import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import { AssessmentServiceError, type Assessment, type GenerationRequest } from '../../assessments/types'
import '../../materials/materials.css'

const POLL_INTERVAL_MS = 3000

/**
 * Polls `getAssessment` every 3 s while the assessment is generating and
 * stops on a terminal status. The route param alone restores the view, so
 * refresh-safe resume never needs the job id.
 */
function useAssessmentPolling(assessmentId: string): {
  assessment: Assessment | null
  error: AssessmentServiceError | null
  refresh: () => void
} {
  const client = useAssessmentClient()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [error, setError] = useState<AssessmentServiceError | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!assessmentId) return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function load() {
      try {
        const record = await client.getAssessment(assessmentId)
        if (cancelled) return
        setAssessment(record)
        setError(null)
        if (record.status === 'generating') {
          timer = setInterval(() => {
            void load()
          }, POLL_INTERVAL_MS)
        } else if (timer) {
          clearInterval(timer)
          timer = null
        }
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof AssessmentServiceError
            ? err
            : new AssessmentServiceError('unknown', 'assessment request failed', false),
        )
      }
    }

    void load()
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [assessmentId, client, tick])

  return {
    assessment,
    error,
    refresh: () => setTick((value) => value + 1),
  }
}

export function AssessmentDetail() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const navigate = useNavigate()
  const assessments = useAssessmentClient()
  const { assessment, error, refresh } = useAssessmentPolling(assessmentId ?? '')
  const [retrying, setRetrying] = useState(false)

  if (!assessmentId) return null

  if (!assessment && !error) {
    return (
      <div className="materials-page">
        <p className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
          Loading assessment…
        </p>
      </div>
    )
  }

  if (error && !assessment) {
    return (
      <div className="materials-page">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/materials')}>
          ← Back to library
        </button>
        <div className="banner attention" style={{ marginTop: '1rem' }}>
          <div className="banner-body">
            <div className="banner-title">Could not load assessment</div>
            <div className="banner-desc">{error.message}</div>
          </div>
        </div>
      </div>
    )
  }

  if (!assessment) return null

  const materialIds = assessment.materialIds

  async function retry() {
    setRetrying(true)
    const request: GenerationRequest = {
      clientId: crypto.randomUUID(),
      materialIds,
      recipe: { formats: ['objective'], questionCount: 1, difficulty: 3, skillTags: ['core'] },
      correlationId: crypto.randomUUID(),
    }
    try {
      const job = await assessments.generateAssessment(request)
      navigate(`/assessments/${job.resultId ?? request.correlationId}`)
    } catch {
      setRetrying(false)
      refresh()
    }
  }

  return (
    <div className="materials-page">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/materials')}>
        ← Back to library
      </button>
      <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
        Objective assessment
      </h1>

      {assessment.status === 'generating' && (
        <div className="card card-large" style={{ maxWidth: '640px', marginTop: '1rem' }}>
          <div className="card-title">Generating your question</div>
          <p className="t-body-sm" style={{ color: 'var(--text-secondary)' }}>
            The service is retrieving the source context and authoring a grounded question. This
            usually takes a few seconds. Refresh the page any time to resume here.
          </p>
        </div>
      )}

      {assessment.status === 'failed' && (
        <div className="card card-large" style={{ maxWidth: '640px', marginTop: '1rem' }}>
          <div className="card-title">Generation did not complete</div>
          {assessment.warnings.length > 0 && (
            <ul className="material-ref-list">
              {assessment.warnings.map((warning, index) => (
                <li key={`${warning.code}-${index}`}>
                  <strong>{warning.code}</strong>: {warning.message}
                </li>
              ))}
            </ul>
          )}
          <div className="material-practice-actions">
            <button type="button" className="btn btn-accent" onClick={() => void retry()} disabled={retrying}>
              {retrying ? 'Requesting…' : 'Retry generation'}
            </button>
          </div>
        </div>
      )}

      {assessment.status === 'ready' && assessment.questions.length > 0 && (
        <>
          {assessment.warnings.length > 0 && (
            <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '640px' }}>
              <div className="banner-body">
                <div className="banner-title">Attention</div>
                <div className="banner-desc">
                  {assessment.warnings.map((warning) => warning.message).join(' ')}
                </div>
              </div>
            </div>
          )}
          <div className="card card-large" style={{ maxWidth: '640px', marginTop: '1rem' }}>
            {assessment.questions.map((question) => (
              <div key={question.id}>
                <div className="card-title" style={{ fontWeight: 500 }}>
                  {question.prompt}
                </div>
                <div className="card-meta">
                  Difficulty band {question.authoredDifficulty}
                  {question.skillTags.length > 0 && ` · ${question.skillTags.join(', ')}`}
                </div>
                <ol className="assessment-options" style={{ margin: '0.75rem 0 0 1.25rem', display: 'grid', gap: '0.5rem' }}>
                  {question.options.map((option, index) => (
                    <li key={`${question.id}-${index}`} style={{ color: 'var(--text-secondary)' }}>
                      {option}
                    </li>
                  ))}
                </ol>
                <div className="material-detail-block" style={{ marginTop: '1rem' }}>
                  <h3 className="t-display-3" style={{ fontSize: '15px', marginBottom: '0.5rem' }}>
                    Citations
                  </h3>
                  {question.citations.length === 0 ? (
                    <p className="t-body-sm">No citations recorded for this question.</p>
                  ) : (
                    <ul className="material-ref-list">
                      {question.citations.map((citation, index) => (
                        <li key={`${question.id}-cite-${index}`}>
                          <span className="t-body-sm" style={{ color: 'var(--text-secondary)' }}>
                            chunk {citation.chunkId.slice(0, 8)}: “{citation.quote}”
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {assessment.status === 'ready' && assessment.questions.length === 0 && (
        <div className="card card-large" style={{ maxWidth: '640px', marginTop: '1rem' }}>
          <div className="card-title">No questions</div>
          <p className="t-body-sm" style={{ color: 'var(--text-secondary)' }}>
            This assessment completed without an accepted question. Retry generation for a fresh
            attempt.
          </p>
        </div>
      )}
    </div>
  )
}