import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import {
  AssessmentServiceError,
  type Assessment,
  type GenerationRequest,
  type Question,
} from '../../assessments/types'
import { createAttemptFlow, type AttemptFlow, type LocalAttemptRow } from '../../assessments/attemptFlow'
import { useEventStoreContext } from '../../events/EventStoreProvider'
import { AttemptTaker } from './AttemptTaker'
import { ReviewSurface } from './review/ReviewSurface'
import { buildReviewModel, deriveTimelineSeed, type ReviewTimelineEntry } from './review/reviewModel'
import '../../materials/materials.css'

const POLL_INTERVAL_MS = 3000
const ATTEMPT_REFRESH_MS = 3000

/**
 * One whole-assessment round on the review timeline (P4 D-06). Mirrors the
 * deriveTimelineSeed aggregation but scoped to `rows` of a single round (all
 * rows submitted at/after its startedAt), so appended rounds stay honest as
 * their grades land and earlier rounds freeze once a newer round begins.
 */
function roundEntry(
  attemptNumber: number,
  totalQuestions: number,
  rows: LocalAttemptRow[],
  startedAt: string,
): ReviewTimelineEntry {
  if (rows.length === 0) return { attemptNumber, startedAt, status: 'processing' }
  const latestByQuestion = new Map<string, LocalAttemptRow>()
  for (const row of rows) {
    const previous = latestByQuestion.get(row.questionId)
    if (!previous || row.submittedAt >= previous.submittedAt) latestByQuestion.set(row.questionId, row)
  }
  const latestRows = [...latestByQuestion.values()]
  const grades = rows.flatMap((row) => (row.grade ? [row.grade] : []))
  const gradedLatest = latestRows.filter((row) => row.grade != null).length
  const score =
    grades.length > 0 ? grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length : undefined
  const completedAt =
    grades.length > 0
      ? grades
          .map((grade) => grade.gradedAt)
          .sort((a, b) => a.localeCompare(b))
          .slice(-1)[0]
      : undefined
  const status =
    gradedLatest === totalQuestions ? 'graded' : gradedLatest > 0 ? 'partial' : 'processing'
  return {
    attemptNumber,
    startedAt,
    ...(completedAt != null ? { completedAt } : {}),
    ...(score != null ? { score } : {}),
    correctCount: latestRows.filter((row) => row.grade?.correct).length,
    totalCount: latestRows.length,
    status,
  }
}

/**
 * Taking UI hosted inside the active review panel (D-04): the question still
 * needs an answer, or a retry was requested. AttemptTaker owns answer
 * controls + submit + honest in-flight phases; the citations block keeps the
 * pre-answer grounded-evidence view from the original ready card.
 */
function AnswerSlot({
  assessment,
  question,
  onAttemptRecorded,
}: {
  assessment: Assessment
  question: Question
  onAttemptRecorded: () => void
}) {
  return (
    <>
      <AttemptTaker assessment={assessment} question={question} onAttemptRecorded={onAttemptRecorded} />
      <div className="material-detail-block" style={{ marginTop: '1rem' }}>
        <h3 className="t-display-3" style={{ fontSize: '15px', marginBottom: '0.5rem' }}>
          Citations
        </h3>
        {question.citations.length === 0 ? (
          <p className="t-body-sm">No citations recorded for this question.</p>
        ) : (
          <ul className="material-ref-list">
            {question.citations.map((citation) => (
              <li key={`${question.id}-cite-${citation.chunkId}`}>
                <span className="t-body-sm" style={{ color: 'var(--text-secondary)' }}>
                  chunk {citation.chunkId.slice(0, 8)}: “{citation.quote}”
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

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
          if (timer) clearInterval(timer)
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
  const { eventStore } = useEventStoreContext()
  const { assessment, error, refresh } = useAssessmentPolling(assessmentId ?? '')
  const [retrying, setRetrying] = useState(false)

  // ---- Review data layer (#40 P4, D-02/D-04/D-06) -------------------------
  // The review surface reads the same Dexie rows + attempts read route as
  // AttemptTaker; submit stays inside the taker (fresh clientAttemptId rows).
  const [flow, setFlow] = useState<AttemptFlow | null>(null)
  const [rows, setRows] = useState<LocalAttemptRow[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  /** Questions whose panel is showing the taking UI because of an explicit retry. */
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(new Set())
  const [timeline, setTimeline] = useState<ReviewTimelineEntry[]>([])
  const [hydratedAssessmentId, setHydratedAssessmentId] = useState<string | null>(null)

  const ready = assessment != null && assessment.status === 'ready'

  // Flow bound to this render's event store (per-user Dexie); mirrors the
  // AttemptTaker bootstrap so the transport stays dependency-injected.
  useEffect(() => {
    if (!eventStore) {
      setFlow(null)
      return
    }
    const db = (eventStore as unknown as { db: import('dexie').Dexie }).db
    setFlow(
      createAttemptFlow({
        db,
        eventStore,
        transport: assessments.transport,
      }),
    )
  }, [eventStore, assessments])

  // A new flow means a (possibly different) user database — rehydrate.
  useEffect(() => {
    setHydratedAssessmentId(null)
  }, [flow])

  // Hydrate attempt rows once per ready assessment: refreshAttempts merges
  // the server history (fresh-device restore carries the echoed answer, D-01),
  // then the local table is the review model's row source.
  useEffect(() => {
    if (!ready || !flow || !assessment) return
    if (hydratedAssessmentId === assessment.id) return
    let cancelled = false
    async function hydrate() {
      // Re-guard: TS does not carry the outer narrowing into this closure.
      if (!flow || !assessment) return
      await flow.refreshAttempts(assessment)
      const local = await flow.listLocalAttempts(assessment.id)
      if (cancelled) return
      setRows(local)
      setTimeline([])
      setRetryingIds(new Set())
      setActiveIndex(0)
      setHydratedAssessmentId(assessment.id)
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [ready, flow, assessment, hydratedAssessmentId])

  // While any attempt is in flight (queued/submitted, no grade yet), refresh
  // the server history so late and cross-device grades advance the partial
  // state; a grade landing on a retried question returns it to review mode.
  const inFlight = rows.some(
    (row) => !row.grade && (row.status === 'queued' || row.status === 'submitted'),
  )
  useEffect(() => {
    if (!ready || !flow || !assessment || !inFlight) return
    const timer = setInterval(() => {
      void (async () => {
        // Re-guard: TS does not carry the outer narrowing into this closure.
        if (!flow || !assessment) return
        await flow.refreshAttempts(assessment)
        const local = await flow.listLocalAttempts(assessment.id)
        setRows(local)
        if (retryingIds.size > 0) {
          setRetryingIds((previous) => {
            const next = new Set(previous)
            for (const questionId of previous) {
              const questionRows = local
                .filter((row) => row.questionId === questionId)
                .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
              if (questionRows[questionRows.length - 1]?.grade) next.delete(questionId)
            }
            return next.size === previous.size ? previous : next
          })
        }
      })()
    }, ATTEMPT_REFRESH_MS)
    return () => clearInterval(timer)
  }, [ready, flow, assessment, inFlight])

  // Seed the attempt timeline from the first rows, then keep the open (last)
  // round entry honest as grades land. Earlier rounds freeze once appended.
  useEffect(() => {
    if (!ready || !assessment || rows.length === 0) return
    setTimeline((previous) => {
      if (previous.length === 0) {
        const seed = deriveTimelineSeed(buildReviewModel(assessment, rows).groups)
        return seed.length > 0 ? seed : previous
      }
      const last = previous[previous.length - 1]
      const roundRows = rows.filter((row) => row.submittedAt >= last.startedAt)
      const next = roundEntry(last.attemptNumber, assessment.questions.length, roundRows, last.startedAt)
      if (JSON.stringify(next) === JSON.stringify(last)) return previous
      return [...previous.slice(0, -1), next]
    })
  }, [ready, assessment, rows])

  // ---- Review interactions --------------------------------------------------
  async function handleAttemptRecorded(questionId: string) {
    if (!flow || !assessment) return
    const local = await flow.listLocalAttempts(assessment.id)
    setRows(local)
    setRetryingIds((previous) => {
      if (!previous.has(questionId)) return previous
      const next = new Set(previous)
      next.delete(questionId)
      return next
    })
  }

  /** Per-question retry: the panel returns to the taking UI; submit mints a fresh attempt (D-06). */
  function handleRetryQuestion(questionId: string) {
    setRetryingIds((previous) => {
      const next = new Set(previous)
      next.add(questionId)
      return next
    })
  }

  /**
   * Whole-assessment retry (D-06): every question returns to taking mode and
   * each submit is a fresh observation. The summary appends a new timeline
   * round and the prior round collapses into the <details> record. With no
   * questions to re-answer this is a generation retry (failed/empty shells).
   */
  function handleRetryAssessment() {
    if (!assessment) return
    if (assessment.questions.length === 0) {
      void retry()
      return
    }
    setTimeline((previous) => {
      let next = previous
      if (next.length === 0) {
        const seed = deriveTimelineSeed(buildReviewModel(assessment, rows).groups)
        if (seed.length === 0) return previous // nothing attempted yet — answering is already pristine
        next = seed
      }
      const startedAt = new Date().toISOString()
      const last = next[next.length - 1]
      const roundRows = rows.filter((row) => row.submittedAt >= last.startedAt)
      next = [...next.slice(0, -1), roundEntry(last.attemptNumber, assessment.questions.length, roundRows, last.startedAt)]
      return [...next, { attemptNumber: next.length + 1, startedAt, status: 'processing' }]
    })
    setRetryingIds(new Set(assessment.questions.map((question) => question.id)))
    setActiveIndex(0)
  }

  const model = ready && assessment ? buildReviewModel(assessment, rows) : null
  const activeGroup =
    model && model.groups.length > 0
      ? model.groups[Math.min(activeIndex, model.groups.length - 1)]
      : undefined
  // Never-attempted questions answer through the slot by default; retried
  // questions re-enter it until their fresh attempt resolves.
  const showSlot =
    model != null &&
    activeGroup != null &&
    (activeGroup.attempts.length === 0 || retryingIds.has(activeGroup.question.id))
  const panelSlot =
    showSlot && assessment && activeGroup ? (
      <AnswerSlot
        assessment={assessment}
        question={activeGroup.question}
        onAttemptRecorded={() => void handleAttemptRecorded(activeGroup.question.id)}
      />
    ) : undefined

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
  // One family per assessment (P2 recipe gate); the heading and a generation
  // retry keep that family instead of silently re-requesting objective (#41).
  // While generating there is no question to read the family from yet, so the
  // heading stays neutral rather than guessing "objective".
  const formats: GenerationRequest['recipe']['formats'] =
    assessment.questions[0]?.format === 'written' ? ['written'] : ['objective']
  const familyHeading =
    assessment.questions.length === 0
      ? 'Generating assessment'
      : formats[0] === 'written'
        ? 'Written assessment'
        : 'Objective assessment'

  async function retry() {
    setRetrying(true)
    const request: GenerationRequest = {
      clientId: crypto.randomUUID(),
      materialIds,
      recipe: { formats, questionCount: 1, difficulty: 3, skillTags: ['core'] },
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
        {familyHeading}
      </h1>

      {assessment.status === 'generating' && (
        <div className="card card-large" style={{ maxWidth: '640px', marginTop: '1rem' }}>
          <div className="card-title">Generating your question</div>
          <p className="t-body-sm" style={{ color: 'var(--text-secondary)' }}>
            The service is retrieving the source context and authoring a grounded question. This
            usually takes a few seconds. Refresh the page any time to resume here.
          </p>
          {assessment.warnings.length > 0 && (
            <div className="banner attention" style={{ marginTop: '1rem' }}>
              <div className="banner-body">
                <div className="banner-title">Generation was interrupted</div>
                <div className="banner-desc">
                  {assessment.warnings.map((warning) => warning.message).join(' ')} Start a fresh
                  attempt to continue.
                </div>
              </div>
              <button type="button" className="banner-action-btn" onClick={() => void retry()} disabled={retrying}>
                {retrying ? 'Requesting…' : 'Retry generation'}
              </button>
            </div>
          )}
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

      {ready && assessment && model && (
        <div style={{ marginTop: '1rem' }}>
          <ReviewSurface
            assessment={assessment}
            model={model}
            timeline={timeline}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onRetryQuestion={handleRetryQuestion}
            onRetryAssessment={() => void handleRetryAssessment()}
            panelSlot={panelSlot}
          />
        </div>
      )}
    </div>
  )
}
