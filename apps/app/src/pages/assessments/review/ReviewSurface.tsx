/**
 * Production review components (#40, PLAN D-03/D-05) — ported from the
 * approved Split-pane B prototype (`src/prototype/assessment-review/`).
 *
 * Vocabulary preserved verbatim: SummaryBand verdict logic, QuestionNavigator
 * `role="tablist"` + `aria-current` + arrow keys, warnings `role="status"`
 * with jump-to-question, AttemptCards oldest → latest with the latest
 * expanded, prior timeline collapsed into `<details>`.
 *
 * Family treatments keyed off `question.format`: objective renders the full
 * treatment (options + your-pick marker + per-skill + citations); written
 * renders the learner's text + rubric breakdown (#41, D-04); coding renders
 * the shared grade shape with a placeholder line #42 replaces without
 * touching the shell.
 */

import { Fragment, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { LocalAttemptRow } from '../../../assessments/attemptFlow'
import type {
  Assessment,
  AssessmentFormat,
  Question,
  QuestionGradedResult,
  RubricCriterionResult,
  TestCaseResult,
} from '../../../assessments/types'
import {
  describeAnswer,
  feedbackText,
  pickedOptionIndexes,
  type QuestionDisplayStatus,
  type QuestionReviewGroup,
  type ReviewTimelineEntry,
  type ReviewViewModel,
} from './reviewModel'
import './review.css'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function assessmentStatusTagClass(status: Assessment['status']): string {
  switch (status) {
    case 'ready':
      return 'tag-moss'
    case 'failed':
      return 'tag-rust'
    case 'partial':
      return 'tag-terracotta'
    default:
      return ''
  }
}

function questionStatusTagClass(status: QuestionDisplayStatus): string {
  switch (status) {
    case 'correct':
      return 'tag-moss'
    case 'partial':
      return 'tag-terracotta'
    case 'incorrect':
      return 'tag-rust'
    default:
      return ''
  }
}

const STATUS_GLYPHS: Record<QuestionDisplayStatus, ReactNode> = {
  correct: <path d="M3 8.5 6.5 12 13 4.5" />,
  incorrect: <path d="M4 4 12 12M12 4 4 12" />,
  partial: <path d="M3 8h10" />,
  processing: <circle cx="8" cy="8" r="4" strokeDasharray="3 3" />,
  pending: <circle cx="8" cy="8" r="4.5" fill="none" />,
}

function StatusIcon({ status }: { status: QuestionDisplayStatus }) {
  return (
    <svg
      className={`ar-status-icon is-${status}`}
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {STATUS_GLYPHS[status]}
    </svg>
  )
}

const FAMILY_LABELS: Record<AssessmentFormat, string> = {
  objective: 'Objective',
  written: 'Written',
  coding: 'Coding',
}

function familyTagClass(correct: number, total: number, inFlight: boolean): string {
  if (correct === total) return 'tag-moss'
  return inFlight ? 'tag-terracotta' : 'tag-rust'
}

function formatStartedAt(entry: ReviewTimelineEntry): string {
  return entry.completedAt
    ? `${formatTime(entry.startedAt)} → ${formatTime(entry.completedAt)}`
    : `${formatTime(entry.startedAt)} → in flight`
}

/** Collapsed record of prior whole-assessment attempts — stays present after retry. */
export function AttemptTimeline({ entries }: { entries: ReviewTimelineEntry[] }) {
  const past = entries.slice(0, -1)
  if (past.length === 0) return null
  const last = past[past.length - 1]
  return (
    <details className="ar-timeline-prior">
      <summary>
        Previous attempt timeline — {past.length} attempt{past.length > 1 ? 's' : ''}
        {last.score != null && ` · last score ${last.score.toFixed(2)}`}
      </summary>
      <ul className="ar-timeline-list">
        {past.map((entry) => (
          <li key={`attempt-${entry.attemptNumber}`}>
            <span className="t-mono-sm">{formatStartedAt(entry)}</span>
            <span
              className={`tag tag-sm ${
                entry.status === 'graded'
                  ? 'tag-moss'
                  : entry.status === 'failed'
                    ? 'tag-rust'
                    : ''
              }`}
            >
              {entry.status}
              {entry.score != null && ` · ${entry.score.toFixed(2)}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export function SummaryBand({
  assessment,
  model,
  timeline,
  onJumpToQuestion,
  onRetryAssessment,
}: {
  assessment: Assessment
  model: ReviewViewModel
  timeline: ReviewTimelineEntry[]
  onJumpToQuestion: (index: number) => void
  onRetryAssessment: () => void
}) {
  const current = timeline.length > 0 ? timeline[timeline.length - 1] : null

  function jumpToWarning(questionId: string | undefined) {
    if (!questionId) return
    const index = assessment.questions.findIndex((question) => question.id === questionId)
    onJumpToQuestion(index >= 0 ? index : 0)
  }

  return (
    <section className="ar-summary" aria-label="Assessment summary">
      <div className="ar-summary-head">
        <span className={`tag tag-sm ${assessmentStatusTagClass(assessment.status)}`}>
          {assessment.status}
        </span>
        {current && (
          <span className="ar-summary-meta">
            Attempt {timeline.length} of {timeline.length} · started {formatTime(current.startedAt)}
          </span>
        )}
        {model.totalCount > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm ar-retry-assessment"
            onClick={onRetryAssessment}
          >
            Retry assessment
          </button>
        )}
      </div>
      <AttemptTimeline entries={timeline} />
      <p className="ar-verdict t-display-2">{model.verdict}</p>

      {model.families.length > 0 && (
        <div className="ar-family-row" aria-label="Score by family">
          {model.families.map((family) => {
            const inFlight = model.groups.some(
              (group) =>
                group.question.format === family.format &&
                (group.display === 'processing' || group.display === 'pending'),
            )
            return (
              <span
                key={family.format}
                className={`tag tag-sm ${familyTagClass(family.correct, family.total, inFlight)}`}
              >
                {FAMILY_LABELS[family.format]} {family.correct}/{family.total}
              </span>
            )
          })}
        </div>
      )}

      {assessment.groundingStale && (
        <div className="banner attention ar-stale-banner" role="status">
          <div className="banner-icon-wrap" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M8 2v6" />
              <circle cx="8" cy="12" r="0.9" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="banner-body">
            <p className="banner-title">Source material replaced</p>
            <p className="banner-desc">
              Material changed after this assessment was authored — regenerate before trusting new
              questions.
            </p>
          </div>
        </div>
      )}

      {assessment.warnings.length > 0 && (
        <div className="ar-warnings" role="status" aria-label="Assessment warnings">
          {assessment.warnings.map((warning) => (
            <div className="ar-warning" key={`${warning.code}-${warning.questionId ?? 'global'}`}>
              <code className="ar-warning-code">{warning.code}</code>
              <p className="ar-warning-msg">{warning.message}</p>
              {warning.questionId && (
                <button
                  type="button"
                  className="ar-warning-jump"
                  onClick={() => jumpToWarning(warning.questionId)}
                >
                  Go to question
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function QuestionNavigator({
  groups,
  activeIndex,
  onSelect,
}: {
  groups: QuestionReviewGroup[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = event.key === 'ArrowRight' ? 1 : -1
    onSelect((activeIndex + delta + groups.length) % groups.length)
  }

  return (
    <nav
      className="ar-navigator is-rail"
      role="tablist"
      aria-label="Question navigator"
      onKeyDown={handleKeyDown}
    >
      {groups.map((group, index) => {
        const active = index === activeIndex
        return (
          <button
            key={group.question.id}
            type="button"
            role="tab"
            aria-current={active ? 'true' : undefined}
            aria-label={`Question ${index + 1}, ${group.display}`}
            className={`ar-navtab is-${group.display}${active ? ' is-active' : ''}`}
            onClick={() => onSelect(index)}
          >
            <StatusIcon status={group.display} />
            <span className="ar-navtab-num">{index + 1}</span>
            <span className="ar-navtab-format">{group.question.format}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** Shared per-skill observations list — part of the QuestionReviewCard primitive. */
function PerSkillList({ grade }: { grade: QuestionGradedResult }) {
  const observations = grade.perSkill ?? []
  if (observations.length === 0) return null
  return (
    <div className="ar-perskill">
      <h4 className="ar-subhead">Skills observed</h4>
      <ul className="ar-perskill-list">
        {observations.map((observation) => (
          <li key={observation.skillTag} className="ar-perskill-row">
            <span className="ar-perskill-tag">{observation.skillTag}</span>
            <span className={`tag tag-sm ${observation.correct ? 'tag-moss' : 'tag-rust'}`}>
              {observation.correct ? 'correct' : 'not yet'}
            </span>
            <span className="ar-perskill-score t-mono-sm">{observation.score.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Expandable source evidence (chunkId + quote) — key material never renders here. */
function CitationList({ question }: { question: Question }) {
  const [open, setOpen] = useState(false)
  if (question.citations.length === 0) return null
  return (
    <div className="ar-citations">
      <button
        type="button"
        className="ar-citations-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide source evidence' : `Source evidence (${question.citations.length})`}
        <svg
          className={`ar-caret${open ? ' is-open' : ''}`}
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul className="ar-citation-list">
          {question.citations.map((citation) => (
            <li key={citation.chunkId} className="ar-citation">
              <code className="ar-citation-chunk">chunk {citation.chunkId.slice(0, 8)}</code>
              <span className="ar-citation-quote">&ldquo;{citation.quote}&rdquo;</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Full objective treatment: options + your-pick marker + per-skill + citations. */
function ObjectiveFeedback({
  question,
  attempt,
}: {
  question: Question
  attempt: LocalAttemptRow
}) {
  const picked = pickedOptionIndexes(attempt.answer)
  const written = describeAnswer(attempt.answer)
  return (
    <>
      {question.options.length > 0 ? (
        <div className="ar-options" role="list" aria-label="Answer options with your selection">
          {question.options.map((option, index) => {
            const selected = picked.includes(index)
            return (
              <div
                key={`${question.id}-opt-${index}`}
                role="listitem"
                className={`ar-option${selected ? ' is-selected' : ''}`}
              >
                <span className="ar-option-marker" aria-hidden="true">
                  {selected ? '●' : '○'}
                </span>
                <span className="ar-option-label">{option}</span>
                {selected && <span className="tag tag-sm">your answer</span>}
              </div>
            )
          })}
        </div>
      ) : (
        written != null && (
          <p className="ar-answer-line">
            Your answer: <span className="t-mono-sm">{written}</span>
          </p>
        )
      )}
      {attempt.grade && <PerSkillList grade={attempt.grade} />}
      <CitationList question={question} />
    </>
  )
}

/**
 * Written treatment (#41 D-04): the learner's own text, the rubric
 * explanation, the criterion breakdown table, per-skill observations and the
 * source evidence. Only learner-facing criterion fields render — the authored
 * rubric text and any reference answer stay server-side.
 */
function WrittenFeedback({
  question,
  attempt,
  shownFeedback,
}: {
  question: Question
  attempt: LocalAttemptRow
  /** The narrative already rendered as the card's feedback line, if any. */
  shownFeedback: string | null
}) {
  const grade = attempt.grade
  const written = describeAnswer(attempt.answer)
  const criteria = grade?.rubricBreakdown ?? []
  return (
    <>
      {written != null && (
        <p className="ar-answer-line">
          Your answer: <span className="t-mono-sm">{written}</span>
        </p>
      )}
      {grade?.explanation && grade.explanation !== shownFeedback && (
        <p className="ar-explanation">{grade.explanation}</p>
      )}
      {criteria.length > 0 && <RubricBreakdown criteria={criteria} />}
      {grade && <PerSkillList grade={grade} />}
      <CitationList question={question} />
    </>
  )
}

/**
 * Coding treatment (#42): the learner's submitted source, the public
 * verdict table (visible rows by name, hidden rows veiled as `Hidden test
 * N`), per-skill observations, and the source evidence. Hidden stdin,
 * expected outputs, and the reference solution are never in the grade
 * payload, so there is nothing here that can leak them. The
 * `output_prediction` subtype never ran the sandbox: it renders the authored
 * snippet and the learner's numeric prediction instead of the table.
 */
function CodingFeedback({
  question,
  attempt,
}: {
  question: Question
  attempt: LocalAttemptRow
}) {
  const grade = attempt.grade
  const source = submittedSource(attempt.answer)
  const prediction = submittedValue(attempt.answer)
  const testCases = grade?.testCases ?? []
  const isPrediction = question.subtype === 'output_prediction'
  return (
    <>
      {isPrediction ? (
        <>
          {question.starterCode && (
            <pre className="ar-code" aria-label="Code snippet">
              {question.starterCode}
            </pre>
          )}
          {prediction != null && (
            <p className="ar-answer-line">
              Your prediction: <span className="t-mono-sm">{prediction}</span>
            </p>
          )}
        </>
      ) : (
        <>
          {source != null && (
            <pre className="ar-code" aria-label="Your submitted code">
              {source}
            </pre>
          )}
          {testCases.length > 0 && (
            <>
              <h4 className="ar-subhead">Test cases</h4>
              <TestCaseTable testCases={testCases} />
            </>
          )}
        </>
      )}
      {grade && <PerSkillList grade={grade} />}
      <CitationList question={question} />
    </>
  )
}

/** The learner's own submitted source (never the reference solution). */
function submittedSource(answer: LocalAttemptRow['answer']): string | null {
  if (answer == null) return null
  const candidate = answer as { source?: unknown }
  return typeof candidate.source === 'string' ? candidate.source : null
}

/** The learner's own numeric prediction of an output_prediction question. */
function submittedValue(answer: LocalAttemptRow['answer']): string | null {
  if (answer == null) return null
  const candidate = answer as { value?: unknown }
  return typeof candidate.value === 'string' ? candidate.value : null
}

/** Public per-test verdicts of a coding grade (#42 D-05/D-07). */
function TestCaseTable({ testCases }: { testCases: TestCaseResult[] }) {
  return (
    <table className="ar-tests" aria-label="Test results">
      <thead>
        <tr>
          <th scope="col">Case</th>
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {testCases.map((testCase) => (
          <tr key={testCase.name} className={testCase.passed ? 'is-pass' : 'is-fail'}>
            <td>{testCase.name}</td>
            <td>
              <span
                className={`tag tag-sm ${testCase.passed ? 'tag-moss' : 'tag-rust'}`}
                aria-label={testCase.passed ? 'passed' : 'failed'}
              >
                {testCase.passed ? 'pass' : 'fail'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Public per-criterion breakdown of a written grade (#41) — public keys only. */
function RubricBreakdown({ criteria }: { criteria: RubricCriterionResult[] }) {
  return (
    <table className="ar-rubric-table" aria-label="Rubric breakdown">
      <thead>
        <tr>
          <th scope="col">Criterion</th>
          <th scope="col">Share</th>
          <th scope="col">Score</th>
          <th scope="col">Outcome</th>
        </tr>
      </thead>
      <tbody>
        {criteria.map((criterion, index) => (
          <Fragment key={`${criterion.criterion}-${index}`}>
            <tr className={criterion.met ? '' : 'is-miss'}>
              <td className="ar-rubric-criterion">{criterion.criterion}</td>
              <td className="ar-rubric-share t-mono-sm">
                {Math.round(criterion.weight * 100)}%
              </td>
              <td className="ar-rubric-points t-mono-sm">{criterion.score.toFixed(2)}</td>
              <td className="ar-rubric-outcome">
                <span className={`tag tag-sm ${criterion.met ? 'tag-moss' : 'tag-rust'}`}>
                  {criterion.met ? 'met' : 'not met'}
                </span>
              </td>
            </tr>
            {criterion.feedback && (
              <tr className="ar-rubric-feedback-row">
                <td className="ar-rubric-feedback" colSpan={4}>
                  {criterion.feedback}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Shared question-review primitive — `QuestionReviewCard(question, attempt)`
 * keeps the `(question, attempt)` signature so Practice (#16) can reuse it.
 */
export function QuestionReviewCard({
  question,
  attempt,
}: {
  question: Question
  attempt: LocalAttemptRow
}) {
  const feedback = feedbackText(attempt.grade)
  return (
    <>
      {feedback && <p className="ar-feedback-line">{feedback}</p>}
      {question.format === 'objective' && (
        <ObjectiveFeedback question={question} attempt={attempt} />
      )}
      {question.format === 'written' && (
        <WrittenFeedback question={question} attempt={attempt} shownFeedback={feedback} />
      )}
      {question.format === 'coding' && <CodingFeedback question={question} attempt={attempt} />}
    </>
  )
}

function isQueued(row: LocalAttemptRow): boolean {
  return !row.grade && (row.status === 'queued' || row.status === 'submitted')
}

/** One attempt in the visible history — prior attempts stay expandable, never deleted. */
function AttemptCard({
  attempt,
  question,
  attemptNumber,
  isLatest,
}: {
  attempt: LocalAttemptRow
  question: Question
  attemptNumber: number
  isLatest: boolean
}) {
  const [open, setOpen] = useState(isLatest)
  const grade = attempt.grade
  const status: QuestionDisplayStatus = isQueued(attempt)
    ? 'processing'
    : grade
      ? grade.correct
        ? 'correct'
        : grade.score >= 0.6
          ? 'partial'
          : 'incorrect'
      : 'pending'

  if (isQueued(attempt)) {
    return (
      <div className="ar-attempt is-queued" aria-busy="true">
        <div className="ar-attempt-head">
          <span className="ar-attempt-label">Attempt #{attemptNumber} · queued</span>
          <span className="tag tag-sm ar-attempt-tag">
            <StatusIcon status="processing" /> grading
          </span>
        </div>
        <div className="ar-skeleton" aria-label="Grading attempt">
          <span className="ar-skeleton-line" />
          <span className="ar-skeleton-line" style={{ width: '70%' }} />
        </div>
      </div>
    )
  }

  return (
    <div className={`ar-attempt${isLatest ? ' is-latest' : ' is-prior'}`}>
      <button
        type="button"
        className="ar-attempt-head ar-attempt-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ar-attempt-label">Attempt #{attemptNumber}</span>
        <span className={`tag tag-sm ${questionStatusTagClass(status)} ar-attempt-tag`}>
          <StatusIcon status={status} /> {status}
          {grade ? ` · ${grade.score.toFixed(2)}` : ''}
        </span>
        <span className="ar-attempt-time t-mono-sm">{formatTime(attempt.submittedAt)}</span>
        <svg
          className={`ar-caret${open ? ' is-open' : ''}`}
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="ar-attempt-body">
          <QuestionReviewCard question={question} attempt={attempt} />
        </div>
      )}
    </div>
  )
}

/** Preserved attempt history, oldest first — the retry record #40 must keep. */
export function AttemptHistoryBlock({ group }: { group: QuestionReviewGroup }) {
  const attempts = group.attempts
  const last = attempts.length - 1
  if (last < 0) return null
  const prior = attempts[last - 1]
  return (
    <div className="ar-attempts" aria-label="Attempt history">
      {last > 0 && isQueued(attempts[last]) && prior?.grade && (
        <p className="ar-queued-note" role="status">
          New attempt queued — previous attempt kept (Attempt #{last} · score{' '}
          {prior.grade.score.toFixed(2)}).
        </p>
      )}
      {attempts.map((attempt, index) => (
        <AttemptCard
          key={attempt.clientAttemptId}
          attempt={attempt}
          question={group.question}
          attemptNumber={index + 1}
          isLatest={index === last}
        />
      ))}
    </div>
  )
}

export function RetryQuestionButton({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ar-retry-row">
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
        Retry question
      </button>
      <span className="ar-retry-hint t-body-sm">Queues a fresh attempt — this one stays.</span>
    </div>
  )
}

/**
 * Per-question review panel: honest graded/processing/pending states + history + retry.
 * `panelSlot` (P4 wire-up, D-04) replaces the panel body with a taking UI when
 * the question still needs an answer or a retry was requested — the review
 * states above stay the fallback for standalone use (prototype comparison).
 */
export function QuestionPanel({
  group,
  onRetryQuestion,
  panelSlot,
}: {
  group: QuestionReviewGroup | undefined
  onRetryQuestion: (questionId: string) => void
  panelSlot?: ReactNode
}) {
  if (!group) return null
  const { question, attempts, latest, display } = group
  const graded = display === 'correct' || display === 'incorrect' || display === 'partial'
  const retried = attempts.length > 1
  // While the latest attempt is in flight, the retry control hides (honest
  // state — no double-queue); the queued skeleton carries the copy instead.
  const retryable = graded && latest != null && !isQueued(latest)

  return (
    <section className="ar-panel" aria-label={`Question ${question.format} review`}>
      <div className="ar-panel-meta">
        <span className="tag tag-sm">{question.format}</span>
        <span className="ar-panel-difficulty t-mono-sm">Difficulty {question.authoredDifficulty}</span>
        {graded && <span className={`tag tag-sm ${questionStatusTagClass(display)}`}>{display}</span>}
      </div>
      <p className="ar-panel-prompt">{question.prompt}</p>
      {panelSlot ? (
        <div className="ar-answer-slot">{panelSlot}</div>
      ) : (
        <>
          {display === 'processing' && !latest && (
            <div className="ar-skeleton" aria-busy="true" aria-label="Grading question">
              <span className="ar-skeleton-line" />
              <span className="ar-skeleton-line" style={{ width: '82%' }} />
              <span className="ar-skeleton-line" style={{ width: '64%' }} />
            </div>
          )}
          {display === 'pending' && (
            <p className="ar-panel-pending t-body-sm">This question is waiting to be graded.</p>
          )}
          {graded && !retried && latest && (
            <>
              <QuestionReviewCard question={question} attempt={latest} />
              {retryable && <RetryQuestionButton onRetry={() => onRetryQuestion(question.id)} />}
            </>
          )}
          {retried && (
            <>
              <AttemptHistoryBlock group={group} />
              {retryable && <RetryQuestionButton onRetry={() => onRetryQuestion(question.id)} />}
            </>
          )}
        </>
      )}
    </section>
  )
}

export function ReviewSurface({
  assessment,
  model,
  timeline,
  activeIndex,
  onSelect,
  onRetryQuestion,
  onRetryAssessment,
  panelSlot,
}: {
  assessment: Assessment
  model: ReviewViewModel
  timeline: ReviewTimelineEntry[]
  activeIndex: number
  onSelect: (index: number) => void
  onRetryQuestion: (questionId: string) => void
  onRetryAssessment: () => void
  panelSlot?: ReactNode
}) {
  const activeGroup =
    model.groups.length > 0 ? model.groups[Math.min(activeIndex, model.groups.length - 1)] : undefined

  if (model.totalCount === 0) {
    return (
      <div className="ar-variant-shell ar-variant-b">
        <SummaryBand
          assessment={assessment}
          model={model}
          timeline={timeline}
          onJumpToQuestion={onSelect}
          onRetryAssessment={onRetryAssessment}
        />
        <section className="ar-empty" role="status" aria-label="No questions to review">
          <p className="t-body-sm">No questions to review.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetryAssessment}>
            Retry assessment
          </button>
          {timeline.length > 0 && (
            <p className="ar-timeline-current">
              Attempt #{timeline.length} — started {formatTime(timeline[timeline.length - 1].startedAt)}{' '}
              · grading in flight
            </p>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="ar-variant-shell ar-variant-b">
      <QuestionNavigator groups={model.groups} activeIndex={activeIndex} onSelect={onSelect} />
      <div className="ar-content-col">
        <SummaryBand
          assessment={assessment}
          model={model}
          timeline={timeline}
          onJumpToQuestion={onSelect}
          onRetryAssessment={onRetryAssessment}
        />
        <QuestionPanel group={activeGroup} onRetryQuestion={onRetryQuestion} panelSlot={panelSlot} />
      </div>
    </div>
  )
}
