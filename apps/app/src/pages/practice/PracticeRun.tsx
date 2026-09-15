import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import {
  createAttemptFlow,
  type AttemptFlow,
  type LocalAttemptRow,
} from '../../assessments/attemptFlow'
import { useMaterialsClient } from '../../materials/MaterialsProvider'
import { PRACTICE_RUN_FINISHED, type Event } from '../../events/EventStore'
import { useEventStoreContext } from '../../events/EventStoreProvider'
import type { Assessment } from '../../assessments/types'
import {
  AttemptHistoryBlock,
  QuestionNavigator,
  QuestionReviewCard,
  RetryQuestionButton,
} from '../assessments/review/ReviewSurface'
import { logger } from '../../lib/logger'
import { buildPracticeRunModel, findPracticeRun, isSummaryEligible } from './practiceRunModel'
import { PracticeSummary } from './PracticeSummary'
import { AnswerSlot } from '../assessments/AssessmentDetail'
import './practice.css'

/**
 * The practice run shell (#44 Phase 2, D-02/D-04/D-11).
 *
 * One problem at a time on the shared `AttemptTaker` (through `AnswerSlot`),
 * a problem navigator, and the review primitives for graded problems — never
 * `ReviewSurface`, which is assessment-shaped (D-04).
 *
 * Pause is leave-and-return: the route param is the whole state (D-11). This
 * shell owns the one reconnect drain across every assessment in the run; the
 * individual takers never drain (D-04).
 */

const POLL_INTERVAL_MS = 3000
const ATTEMPT_REFRESH_MS = 3000

export function PracticeRun() {
  const { materialId, runId } = useParams<{ materialId: string; runId: string }>()
  const navigate = useNavigate()
  // The provider attaches the per-user store in an effect, so the first render
  // legitimately has none — the same seam AssessmentDetail uses.
  const { eventStore } = useEventStoreContext()
  const assessments = useAssessmentClient()
  const materials = useMaterialsClient()

  const [events, setEvents] = useState<Event[] | null>(null)
  const [envelopes, setEnvelopes] = useState<Record<string, Assessment>>({})
  const [rowsByAssessment, setRowsByAssessment] = useState<Record<string, LocalAttemptRow[]>>({})
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  /** Questions whose panel is showing the taking UI because of an explicit retry. */
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(new Set())
  const [flow, setFlow] = useState<AttemptFlow | null>(null)
  const [closing, setClosing] = useState(false)
  const [materialTitles, setMaterialTitles] = useState<Record<string, string>>({})
  /** The run summary replaces the problem view once the run is completed (P3). */
  const [summaryDismissed, setSummaryDismissed] = useState(false)
  const [summaryActive, setSummaryActive] = useState(0)

  // ---- Pointer ------------------------------------------------------------
  useEffect(() => {
    if (!eventStore) return
    let cancelled = false
    void eventStore.getAll().then((all) => {
      if (!cancelled) setEvents(all)
    })
    return () => {
      cancelled = true
    }
  }, [eventStore])

  const pointer = useMemo(
    () => (events && runId ? findPracticeRun(events, runId) : null),
    [events, runId],
  )

  // ---- Attempt flow (per-user Dexie, DI transport) -------------------------
  useEffect(() => {
    if (!eventStore) return
    const db = (eventStore as unknown as { db: import('dexie').Dexie }).db
    setFlow(createAttemptFlow({ db, eventStore, transport: assessments.transport }))
  }, [eventStore, assessments])

  const assessmentIds = useMemo(
    () => pointer?.started.assessmentIds ?? [],
    [pointer],
  )

  // ---- Read each problem's assessment, polling while it generates ----------
  const [reloadTick, setReloadTick] = useState(0)
  const generatingIds = useMemo(
    () => assessmentIds.filter((id) => envelopes[id] == null || envelopes[id].status === 'generating'),
    [assessmentIds, envelopes],
  )

  useEffect(() => {
    if (!flow || assessmentIds.length === 0) return
    let cancelled = false
    async function load() {
      const loaded: Record<string, Assessment> = {}
      for (const id of assessmentIds) {
        try {
          loaded[id] = await assessments.getAssessment(id)
        } catch {
          // Unreadable problem: the model reports it honestly as not loaded.
        }
      }
      if (cancelled) return
      setEnvelopes((previous) => ({ ...previous, ...loaded }))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [assessments, assessmentIds, flow, reloadTick])

  useEffect(() => {
    if (generatingIds.length === 0) return
    const timer = setInterval(() => setReloadTick((value) => value + 1), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [generatingIds.length])

  // ---- Hydrate local attempt rows (server merge carries a fresh device) ----
  const hydrate = useCallback(async () => {
    if (!flow) return
    const next: Record<string, LocalAttemptRow[]> = {}
    for (const id of assessmentIds) {
      const envelope = envelopes[id]
      if (envelope) await flow.refreshAttempts(envelope)
      next[id] = await flow.listLocalAttempts(id)
    }
    setRowsByAssessment(next)
    // A retry's fresh grade has landed: leave retry mode so the review card
    // (or its preserved history) returns, exactly as AssessmentDetail does.
    setRetryingIds((previous) => {
      if (previous.size === 0) return previous
      const nextSet = new Set(previous)
      for (const questionId of previous) {
        const rows = Object.values(next)
          .flat()
          .filter((row) => row.questionId === questionId)
          .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        if (rows[rows.length - 1]?.grade) nextSet.delete(questionId)
      }
      return nextSet.size === previous.size ? previous : nextSet
    })
  }, [flow, assessmentIds, envelopes])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // ---- Model ---------------------------------------------------------------
  const model = useMemo(() => {
    if (!pointer) return null
    return buildPracticeRunModel({
      started: pointer.started,
      finished: pointer.finished,
      assessments: assessmentIds.map((id) => envelopes[id] ?? null),
      attemptsByAssessment: rowsByAssessment,
    })
  }, [pointer, assessmentIds, envelopes, rowsByAssessment])

  const problems = model?.problems ?? []
  const totalProblems = problems.length
  const active =
    totalProblems > 0 ? Math.min(activeIndex ?? model?.resumeIndex ?? 0, totalProblems - 1) : 0

  // Land on the resume point once, then let the learner navigate freely.
  useEffect(() => {
    if (activeIndex == null && model != null && totalProblems > 0) {
      setActiveIndex(model.resumeIndex)
    }
  }, [activeIndex, model, totalProblems])

  const current = problems[active]

  // The shared navigator is driven by review groups, so a problem that has not
  // loaded yet carries a placeholder group: same position, honestly pending.
  const navigatorGroups = useMemo(
    () =>
      problems.map(
        (problem) =>
          problem.group ?? {
            question: {
              id: problem.assessmentId,
              assessmentId: problem.assessmentId,
              materialId: problem.materialId,
              format: 'written' as const,
              prompt: '',
              options: [],
              skillTags: [],
              authoredDifficulty: 0,
              citations: [],
            },
            attempts: [],
            latest: null,
            display: 'pending' as const,
          },
      ),
    [problems],
  )

  // ---- Reconnect drain: one caller across the whole run (D-04) -------------
  useEffect(() => {
    if (!flow) return
    const handleOnline = () => {
      void (async () => {
        for (const id of assessmentIds) {
          const envelope = envelopes[id]
          if (!envelope) continue
          await flow.drainQueuedAttempts(envelope)
        }
        await hydrate()
      })()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [flow, assessmentIds, envelopes, hydrate])

  // Late grades land while an attempt is in flight.
  const inFlight = Object.values(rowsByAssessment).some((rows) =>
    rows.some((row) => !row.grade && (row.status === 'queued' || row.status === 'submitted')),
  )
  useEffect(() => {
    if (!inFlight || model?.isFinished) return
    const timer = setInterval(() => void hydrate(), ATTEMPT_REFRESH_MS)
    return () => clearInterval(timer)
  }, [inFlight, hydrate, model?.isFinished])

  // Advance past a problem as soon as its grade lands (never while retrying).
  const gradedActiveId = current?.group?.question.id
  const gradedActiveDisplay = current?.group?.display
  const advanceRef = useRef<number | null>(null)
  useEffect(() => {
    if (gradedActiveDisplay == null || activeIndex == null) return
    if (gradedActiveDisplay === 'pending' || gradedActiveDisplay === 'processing') return
    if (gradedActiveId != null && retryingIds.has(gradedActiveId)) return
    if (advanceRef.current === activeIndex) return
    if (activeIndex >= totalProblems - 1) return
    advanceRef.current = activeIndex
    setActiveIndex(activeIndex + 1)
  }, [activeIndex, gradedActiveDisplay, gradedActiveId, retryingIds, totalProblems])

  // ---- Source materials (per-problem attribution label) -------------------
  useEffect(() => {
    const ids = [...new Set((model?.materialIds ?? []).filter(Boolean))]
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      const titles: Record<string, string> = {}
      for (const id of ids) {
        try {
          titles[id] = (await materials.getMaterial(id)).title
        } catch {
          // Deleted source: the label falls back to nothing rather than a guess.
        }
      }
      if (!cancelled) setMaterialTitles(titles)
    })()
    return () => {
      cancelled = true
    }
  }, [materials, model?.materialIds])

  // ---- Finish / abandon (D-11: neither invents an observation) -------------
  async function closeRun(outcome: 'completed' | 'abandoned') {
    if (!pointer || !eventStore || closing) return
    setClosing(true)
    try {
      await eventStore.append(PRACTICE_RUN_FINISHED, { runId: pointer.started.runId, outcome })
      setEvents(await eventStore.getAll())
    } catch (error) {
      logger.warn('[practice] PracticeRunFinished append failed', error)
    }
    setClosing(false)
  }

  async function handleAttemptRecorded() {
    await hydrate()
  }

  function handleRetryQuestion(questionId: string) {
    setRetryingIds((previous) => new Set(previous).add(questionId))
  }

  if (!materialId || !runId) return null

  if (events == null) {
    return (
      <div className="materials-page">
        <p className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
          Loading run…
        </p>
      </div>
    )
  }

  if (!pointer) {
    // The pointer is local-only (D-02), so an unknown runId on this device is
    // an honest dead end rather than a fabrication.
    return (
      <div className="materials-page">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(`/materials/${materialId}`)}
        >
          ← Back to material
        </button>
        <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '640px' }}>
          <div className="banner-body">
            <div className="banner-title">Run could not be found on this device</div>
            <div className="banner-desc">
              A practice run is saved on the device that started it. Start a new run from the
              material&rsquo;s practice page.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const allGraded = totalProblems > 0 && (model?.completedCount ?? 0) === totalProblems
  const currentQuestion = current?.group?.question
  // Never-attempted problems answer through the slot by default; retried ones
  // re-enter it until their fresh attempt resolves (the #40 pattern).
  const showSlot =
    current != null &&
    currentQuestion != null &&
    envelopes[current.assessmentId] != null &&
    envelopes[current.assessmentId].status !== 'generating' &&
    ((current.group?.attempts.length ?? 0) === 0 ||
      retryingIds.has(currentQuestion.id))

  // ---- Summary (P3): terminal problems, inline retry -----------------------
  const summaryProblems = model?.problems.filter(isSummaryEligible) ?? []
  const summaryActiveIndex =
    summaryProblems.length > 0 ? Math.min(summaryActive, summaryProblems.length - 1) : 0
  const summaryProblem = summaryProblems[summaryActiveIndex]
  const showSummary = model?.outcome === 'completed' && !summaryDismissed
  // While the active summary problem is retrying, its panel hosts the same
  // taking slot the run screen uses; the fresh grade returns it to the card.
  const summarySlot =
    summaryProblem?.group != null &&
    retryingIds.has(summaryProblem.group.question.id) &&
    envelopes[summaryProblem.assessmentId] != null ? (
      <AnswerSlot
        assessment={envelopes[summaryProblem.assessmentId]}
        question={summaryProblem.group.question}
        onAttemptRecorded={() => void handleAttemptRecorded()}
      />
    ) : undefined

  return (
    <div className="materials-page">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => navigate(`/materials/${materialId}`)}
      >
        ← Back to material
      </button>
      <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
        Practice run
      </h1>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        {model?.outcome === 'completed'
          ? 'Run complete — every problem has a grade.'
          : model?.outcome === 'abandoned'
            ? 'Run abandoned. Grades already earned stay in your history.'
            : `${model?.completedCount ?? 0} of ${totalProblems} done${
                model && model.missingCount > 0
                  ? ` · ${model.missingCount} problem${model.missingCount === 1 ? '' : 's'} were not generated`
                  : ''
              }`}
      </p>

      {model && showSummary ? (
        <PracticeSummary
          model={model}
          problems={summaryProblems}
          activeIndex={summaryActiveIndex}
          onSelect={setSummaryActive}
          materialTitles={materialTitles}
          panelSlot={summarySlot}
          onRetryQuestion={handleRetryQuestion}
          onBackToProblems={() => setSummaryDismissed(true)}
        />
      ) : (
        <div className="ar-variant-shell ar-variant-b">
          <QuestionNavigator groups={navigatorGroups} activeIndex={active} onSelect={setActiveIndex} />
          <div className="ar-content-col">
            {current == null && (
              <section className="card card-large" role="status">
                <p className="t-body-sm">
                  This run has no generated problems. Start a new run from the material&rsquo;s
                  practice page.
                </p>
              </section>
            )}

            {current != null && (
              <section className="ar-panel" aria-label={`Problem ${current.number}`}>
                <div className="ar-panel-meta">
                  <span className="tag tag-sm">Problem {current.number}</span>
                  {materialTitles[current.materialId] && (
                    <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                      from {materialTitles[current.materialId]}
                    </span>
                  )}
                </div>

                {current.assessmentStatus === 'generating' && (
                  <p className="t-body-sm" role="status" aria-busy="true">
                    Generating problem {current.number}…
                  </p>
                )}
                {current.assessmentStatus === 'failed' && (
                  <p className="t-body-sm" role="status">
                    Problem {current.number} could not be generated.
                  </p>
                )}

                {currentQuestion && (
                  <p className="ar-panel-prompt">{currentQuestion.prompt}</p>
                )}

                {showSlot && envelopes[current.assessmentId] && currentQuestion && (
                  <div className="ar-answer-slot">
                    <AnswerSlot
                      assessment={envelopes[current.assessmentId]}
                      question={currentQuestion}
                      onAttemptRecorded={() => void handleAttemptRecorded()}
                    />
                  </div>
                )}

                {!showSlot && current.group && (
                  <>
                    {current.group.attempts.length > 1 ? (
                      <AttemptHistoryBlock group={current.group} />
                    ) : (
                      current.group.latest && (
                        <QuestionReviewCard
                          question={current.group.question}
                          attempt={current.group.latest}
                        />
                      )
                    )}
                    <RetryQuestionButton onRetry={() => handleRetryQuestion(current.group!.question.id)} />
                  </>
                )}
              </section>
            )}

            {model && !model.isFinished && (
              <div className="material-practice-actions practice-run-actions">
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={!allGraded || closing}
                  onClick={() => void closeRun('completed')}
                >
                  {closing ? 'Finishing…' : 'Finish run'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={closing}
                  onClick={() => void closeRun('abandoned')}
                >
                  Abandon run
                </button>
                <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Leaving and coming back resumes this run where you left it.
                </span>
              </div>
            )}

            {model?.outcome === 'completed' && (
              <div className="material-practice-actions practice-run-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSummaryDismissed(false)}
                >
                  View summary
                </button>
                <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Every problem is graded — the summary reviews the run.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
