import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import { AssessmentServiceError, type GenerationRequest } from '../../assessments/types'
import { ASSESSMENT_CREATED } from '../../events/EventStore'
import { useEventStore } from '../../events/useEventStore'
import { useMaterialsClient } from '../../materials/MaterialsProvider'
import { isReady, type MaterialRecord } from '../../materials/types'
import '../../materials/materials.css'

const DIFFICULTY_OPTIONS = ['1', '2', '3', '4', '5'] as const

export function AssessmentConfig() {
  const { materialId } = useParams<{ materialId: string }>()
  const navigate = useNavigate()
  const materials = useMaterialsClient()
  const assessments = useAssessmentClient()
  const eventStore = useEventStore()

  const [material, setMaterial] = useState<MaterialRecord | null>(null)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [difficulty, setDifficulty] = useState<number>(3)
  const [skillTagsInput, setSkillTagsInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<AssessmentServiceError | null>(null)

  useEffect(() => {
    if (!materialId) return
    let cancelled = false
    setLoadStatus('loading')
    void materials
      .getMaterial(materialId)
      .then((record) => {
        if (!cancelled) {
          setMaterial(record)
          setLoadStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [materials, materialId])

  if (!materialId) return null

  if (loadStatus === 'loading') {
    return (
      <div className="materials-page">
        <p className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
          Loading material…
        </p>
      </div>
    )
  }

  if (loadStatus === 'error' || !material) {
    return (
      <div className="materials-page">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/materials')}>
          ← Back to library
        </button>
        <div className="banner attention" style={{ marginTop: '1rem' }}>
          <div className="banner-body">
            <div className="banner-title">Could not load material</div>
            <div className="banner-desc">The material may have been deleted.</div>
          </div>
        </div>
      </div>
    )
  }

  if (!isReady(material)) {
    return (
      <div className="materials-page">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(`/materials/${material.id}`)}
        >
          ← Back to material
        </button>
        <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
          Generate assessment
        </h1>
        <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '640px' }}>
          <div className="banner-body">
            <div className="banner-title">Material is not ready yet</div>
            <div className="banner-desc">
              Questions are grounded in the extracted content. Wait for ingestion to finish or retry
              the material first.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const skillTags = skillTagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)

  const materialIdForRequest = material.id

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const request: GenerationRequest = {
      clientId: crypto.randomUUID(),
      materialIds: [materialIdForRequest],
      recipe: {
        formats: ['objective'],
        questionCount: 1,
        difficulty,
        skillTags: skillTags.length > 0 ? skillTags : ['core'],
      },
      correlationId: crypto.randomUUID(),
    }
    try {
      const job = await assessments.generateAssessment(request)
      const assessmentId = job.resultId ?? request.correlationId
      try {
        await eventStore.append(ASSESSMENT_CREATED, {
          assessmentId,
          materialIds: [materialIdForRequest],
        })
      } catch (appendError) {
        // The event is a local pointer, not the source of truth: the
        // generation already stands server-side, so log and continue.
        console.warn('[assessments] AssessmentCreated append failed', appendError)
      }
      navigate(`/assessments/${assessmentId}`)
    } catch (err) {
      setError(err instanceof AssessmentServiceError ? err : new AssessmentServiceError('unknown', 'assessment request failed', false))
      setSubmitting(false)
    }
  }

  return (
    <div className="materials-page">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/materials/${material.id}`)}>
        ← Back to material
      </button>
      <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
        Generate assessment
      </h1>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        One objective question grounded in <strong>{material.title}</strong>.
      </p>

      <div className="card card-large" style={{ maxWidth: '640px' }}>
        <div className="card-title">{material.title}</div>
        <div className="material-practice-options">
          <div className="field-group" style={{ maxWidth: '100%' }}>
            <label className="field-label">Difficulty band</label>
            <div className="chip-row">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip${difficulty === Number(option) ? ' selected' : ''}`}
                  onClick={() => setDifficulty(Number(option))}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="field-group" style={{ maxWidth: '100%' }}>
            <label className="field-label" htmlFor="assessment-skill-tags">
              Skill tags (optional, comma-separated)
            </label>
            <input
              id="assessment-skill-tags"
              className="field"
              type="text"
              value={skillTagsInput}
              onChange={(event) => setSkillTagsInput(event.target.value)}
              placeholder="e.g. Strategic Planning, Gap Analysis"
            />
            {skillTagsInput.trim() !== '' && skillTags.length === 0 && (
              <p className="field-hint" style={{ color: 'var(--danger)' }}>
                Enter at least one non-empty tag, or leave blank to use the default.
              </p>
            )}
          </div>
        </div>
        <div className="material-practice-actions">
          <button type="button" className="btn btn-accent" onClick={() => void submit()} disabled={submitting}>
            {submitting ? 'Requesting generation…' : 'Generate question'}
          </button>
        </div>
      </div>

      {error?.code === 'quota_exhausted' && (
        <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '640px' }}>
          <div className="banner-body">
            <div className="banner-title">Generation quota exhausted</div>
            <div className="banner-desc">
              {error.retryAfterSeconds
                ? `Try again in about ${error.retryAfterSeconds} seconds.`
                : 'Try again later.'}
            </div>
          </div>
        </div>
      )}
      {error && error.code !== 'quota_exhausted' && (
        <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '640px' }}>
          <div className="banner-body">
            <div className="banner-title">Could not start generation</div>
            <div className="banner-desc">
              {error.code === 'conflict'
                ? 'This request was already submitted. Open the existing assessment and refresh it.'
                : error.message}
            </div>
          </div>
          {error.retryable && (
            <button type="button" className="banner-action-btn" onClick={() => void submit()}>
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}