import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import {
  AssessmentServiceError,
  type AssessmentFormat,
  type AssessmentScope,
  type GenerationRequest,
} from '../../assessments/types'
import { ASSESSMENT_CREATED } from '../../events/EventStore'
import { useEventStore } from '../../events/useEventStore'
import { useMaterialsClient } from '../../materials/MaterialsProvider'
import { isReady, type MaterialRecord } from '../../materials/types'
import '../../materials/materials.css'

const DIFFICULTY_OPTIONS = ['1', '2', '3', '4', '5'] as const

/** Families the generation slice supports (one family per assessment). */
const FAMILY_OPTIONS: Array<{ format: AssessmentFormat; label: string }> = [
  { format: 'objective', label: 'Objective' },
  { format: 'written', label: 'Written' },
]

const FAMILY_COPY: Record<string, string> = {
  objective: 'One objective question grounded in',
  written: 'One written question grounded in',
}

/** The pages a chapter chip covers: its own page to the next chapter's minus one. */
function chapterRange(
  material: MaterialRecord,
  index: number,
): { pageStart: number; pageEnd: number } {
  const entries = material.outline?.entries ?? []
  const start = entries[index].page
  const next = entries[index + 1]
  if (next) return { pageStart: start, pageEnd: Math.max(start, next.page - 1) }
  return { pageStart: start, pageEnd: material.pageCount ?? start }
}

export function AssessmentConfig() {
  const { materialId } = useParams<{ materialId: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const materials = useMaterialsClient()
  const assessments = useAssessmentClient()
  const eventStore = useEventStore()

  const [material, setMaterial] = useState<MaterialRecord | null>(null)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [difficulty, setDifficulty] = useState<number>(3)
  const [family, setFamily] = useState<AssessmentFormat>('objective')
  // The scope (D-05): a chapter chip fills the range and carries its label;
  // editing either page by hand drops the label, because it no longer
  // describes the range the learner asked for. A viewer handoff (`?from=&to=`)
  // arrives the same way a typed range does: numbers, no label.
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [pageStart, setPageStart] = useState(() => params.get('from') ?? '')
  const [pageEnd, setPageEnd] = useState(() => params.get('to') ?? '')
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
          // A viewer handoff can only carry a usable range for a material that
          // has page numbering; otherwise the inputs never render and the
          // scope would ship unvalidated.
          if (record.pageCount == null) {
            setPageStart('')
            setPageEnd('')
          }
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

  const outlineEntries = material.outline?.entries ?? []
  const pageCount = material.pageCount ?? null
  const materialIdForRequest = material.id

  function pickChapter(index: number) {
    if (!material) return
    const range = chapterRange(material, index)
    setSelectedChapter(index)
    setPageStart(String(range.pageStart))
    setPageEnd(String(range.pageEnd))
  }

  function clearScope() {
    setSelectedChapter(null)
    setPageStart('')
    setPageEnd('')
  }

  const trimmedStart = pageStart.trim()
  const trimmedEnd = pageEnd.trim()
  const numericStart = Number(trimmedStart)
  const numericEnd = Number(trimmedEnd)
  const hasRange = trimmedStart !== '' || trimmedEnd !== ''
  let rangeError = ''
  if (hasRange) {
    if (!Number.isInteger(numericStart) || !Number.isInteger(numericEnd)) {
      rangeError = 'Enter whole page numbers for both pages.'
    } else if (numericStart < 1 || numericEnd < 1) {
      rangeError = 'Pages start at 1.'
    } else if (numericStart > numericEnd) {
      rangeError = 'The first page must not be after the last page.'
    } else if (pageCount !== null && numericEnd > pageCount) {
      rangeError = `This material has ${pageCount} pages.`
    }
  }
  const scope: AssessmentScope | undefined =
    hasRange && rangeError === ''
      ? {
          pageStart: numericStart,
          pageEnd: numericEnd,
          ...(selectedChapter !== null && outlineEntries[selectedChapter]
            ? { sectionLabel: outlineEntries[selectedChapter].title }
            : {}),
        }
      : undefined

  async function submit() {
    if (submitting || rangeError !== '') return
    setSubmitting(true)
    setError(null)
    const request: GenerationRequest = {
      clientId: crypto.randomUUID(),
      materialIds: [materialIdForRequest],
      recipe: {
        formats: [family],
        questionCount: 1,
        difficulty,
        ...(scope ? { scope } : {}),
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
        {FAMILY_COPY[family] ?? FAMILY_COPY.objective} <strong>{material.title}</strong>.
      </p>

      <div className="card card-large" style={{ maxWidth: '640px' }}>
        <div className="card-title">{material.title}</div>
        <div className="material-practice-options">
          <div className="field-group" style={{ maxWidth: '100%' }}>
            <label className="field-label">Question family</label>
            <div className="chip-row" role="group" aria-label="Question family">
              {FAMILY_OPTIONS.map((option) => (
                <button
                  key={option.format}
                  type="button"
                  className={`chip${family === option.format ? ' selected' : ''}`}
                  aria-pressed={family === option.format}
                  onClick={() => setFamily(option.format)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="field-hint">
              Objective questions grade deterministically; written answers grade against a rubric
              with per-criterion feedback.
            </p>
          </div>
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
            <label className="field-label">Scope (optional)</label>
            {outlineEntries.length > 0 && (
              <div className="chip-row" role="group" aria-label="Chapter scope">
                <button
                  type="button"
                  className={`chip${selectedChapter === null ? ' selected' : ''}`}
                  aria-pressed={selectedChapter === null}
                  onClick={clearScope}
                >
                  Whole material
                </button>
                {outlineEntries.map((entry, index) => (
                  <button
                    key={`${entry.page}-${entry.title}`}
                    type="button"
                    className={`chip${selectedChapter === index ? ' selected' : ''}`}
                    aria-pressed={selectedChapter === index}
                    onClick={() => pickChapter(index)}
                  >
                    {entry.title}
                  </button>
                ))}
              </div>
            )}
            {pageCount !== null ? (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginTop: '0.5rem' }}>
                <div>
                  <label className="field-label" htmlFor="assessment-page-start">
                    From page
                  </label>
                  <input
                    id="assessment-page-start"
                    className="field"
                    type="number"
                    min={1}
                    max={pageCount}
                    value={pageStart}
                    onChange={(event) => {
                      setSelectedChapter(null)
                      setPageStart(event.target.value)
                    }}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="assessment-page-end">
                    To page
                  </label>
                  <input
                    id="assessment-page-end"
                    className="field"
                    type="number"
                    min={1}
                    max={pageCount}
                    value={pageEnd}
                    onChange={(event) => {
                      setSelectedChapter(null)
                      setPageEnd(event.target.value)
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="field-hint">
                This material has no page numbering, so the whole material is used.
              </p>
            )}
            <p className="field-hint" style={rangeError ? { color: 'var(--danger)' } : undefined}>
              {rangeError ||
                (outlineEntries.length > 0
                  ? 'Pick a chapter or a page range to ground the question; leave both blank for the whole material.'
                  : 'The question is grounded in the material’s own pages.')}
            </p>
            {material.kind === 'file' && pageCount !== null && (
              <p className="field-hint">
                <Link to={`/materials/${material.id}/view`}>Open the viewer</Link> to read the page
                numbers you are choosing.
              </p>
            )}
          </div>
        </div>
        <div className="material-practice-actions">
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => void submit()}
            disabled={submitting || rangeError !== ''}
          >
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
