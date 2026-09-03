// PROTOTYPE — throwaway. Assessment Review + Feedback UX for wayfinder #34.
// Answers: "how should graded results, rubric breakdowns, per-test-case tables,
// and per-question explanations render in the /assessments/:id review view?"
// Nothing persists — no events, no storage, no service calls (D-05).
//
// Two surface variants, switchable via ?variant=A|B:
//   A — progressive-disclosure drawer (single column, expandable detail)
//   B — persistent split-pane (navigator rail + question pane on desktop)
// Five review states via ?state=ready|partial|processing|failed|retried.
// Route is dev-only (/assessment-review-prototype); never ships to production.
//
// Phase 2: summary band + question navigator + question panel shell.
// Phase 3: family feedback treatments (objective / written / coding), per-skill
// observations, expandable citations, honest states. `QuestionReviewCard` is the
// shared primitive #40 (and later Practice #16) would reuse.
// Phase 4: per-question retry (queued attempt appended below preserved history)
// and whole-assessment retry (new attempt timeline, prior timeline kept as a
// collapsed record). Retry mutates in-component state only (D-05/D-07).

import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PrototypeSwitcher } from '../practice-guide/PrototypeSwitcher';
import type { AssessmentFormat } from '../../assessments/types';
import {
  MOCK_STATE_KEYS,
  MOCK_STATE_TITLES,
  getMockAssessment,
  type MockAssessment,
  type MockAttempt,
  type MockQuestion,
  type MockRubricCriterion,
  type MockStateKey,
} from './assessment-review-fixtures';
import './assessment-review.css';

const VARIANT_NAMES = { A: 'Drawer', B: 'Split-pane' } as const;
type Variant = keyof typeof VARIANT_NAMES;

type QuestionDisplayStatus = 'correct' | 'partial' | 'incorrect' | 'processing' | 'pending';

function statusTagClass(status: MockAssessment['status']): string {
  switch (status) {
    case 'ready':
      return 'tag-moss';
    case 'failed':
      return 'tag-rust';
    case 'partial':
      return 'tag-terracotta';
    default:
      return '';
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function currentAttempt(q: MockQuestion): MockAttempt | undefined {
  return q.attempts[q.attempts.length - 1];
}

function displayStatus(q: MockQuestion): QuestionDisplayStatus {
  if (q.status === 'processing') return 'processing';
  const attempt = currentAttempt(q);
  if (!attempt) return 'pending';
  if (attempt.isQueued) return 'processing';
  if (attempt.correct) return 'correct';
  if (attempt.score >= 0.6) return 'partial';
  return 'incorrect';
}

function questionStatusTag(status: QuestionDisplayStatus): string {
  switch (status) {
    case 'correct':
      return 'tag-moss';
    case 'partial':
      return 'tag-terracotta';
    case 'incorrect':
      return 'tag-rust';
    default:
      return '';
  }
}

const STATUS_GLYPHS: Record<QuestionDisplayStatus, ReactNode> = {
  correct: <path d="M3 8.5 6.5 12 13 4.5" />,
  incorrect: <path d="M4 4 12 12M12 4 4 12" />,
  partial: <path d="M3 8h10" />,
  processing: <circle cx="8" cy="8" r="4" strokeDasharray="3 3" />,
  pending: <circle cx="8" cy="8" r="4.5" fill="none" />,
};

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
  );
}

interface FamilyStat {
  format: AssessmentFormat;
  total: number;
  correct: number;
}

const FAMILY_LABELS: Record<AssessmentFormat, string> = {
  objective: 'Objective',
  written: 'Written',
  coding: 'Coding',
};

function familyBreakdown(questions: MockQuestion[]): FamilyStat[] {
  const buckets: Record<AssessmentFormat, MockQuestion[]> = {
    objective: [],
    written: [],
    coding: [],
  };
  for (const q of questions) buckets[q.format].push(q);
  return (['objective', 'written', 'coding'] as const)
    .map((format) => ({
      format,
      total: buckets[format].length,
      correct: buckets[format].filter((q) => currentAttempt(q)?.correct).length,
    }))
    .filter((f) => f.total > 0);
}

function familyTagClass(f: FamilyStat, questions: MockQuestion[]): string {
  if (f.correct === f.total) return 'tag-moss';
  const inFlight = questions.some(
    (q) => q.format === f.format && (q.status === 'processing' || q.status === 'pending'),
  );
  return inFlight ? 'tag-terracotta' : 'tag-rust';
}

function SummaryBand({
  assessment,
  onJumpToQuestion,
  onRetryAssessment,
}: {
  assessment: MockAssessment;
  onJumpToQuestion: (index: number) => void;
  onRetryAssessment: () => void;
}) {
  const latest = assessment.attempts[assessment.attempts.length - 1];
  const total = assessment.questions.length;
  const graded = assessment.questions.filter((q) => q.status === 'graded').length;
  const hasInFlight = assessment.questions.some((q) => q.status !== 'graded');
  const families = familyBreakdown(assessment.questions);

  let verdict: string;
  if (total === 0) {
    verdict = 'Grading blocked · no questions scored';
  } else if (hasInFlight) {
    const score =
      latest?.score != null ? ` · score so far ${latest.score.toFixed(2)}` : ' · scores pending';
    verdict = `${graded} of ${total} graded${score}`;
  } else {
    const correct = latest?.correctCount ?? graded;
    const score = latest?.score != null ? ` · score ${latest.score.toFixed(2)}` : '';
    verdict = `${correct} of ${total} questions correct${score}`;
  }

  function jumpToWarning(questionId: string | undefined) {
    if (!questionId) return;
    const index = assessment.questions.findIndex((q) => q.id === questionId);
    onJumpToQuestion(index >= 0 ? index : 0);
  }

  return (
    <section className="ar-summary" aria-label="Assessment summary">
      <div className="ar-summary-head">
        <span className={`tag tag-sm ${statusTagClass(assessment.status)}`}>{assessment.status}</span>
        {latest && (
          <span className="ar-summary-meta">
            Attempt {assessment.attempts.length} of {assessment.attempts.length} · started{' '}
            {formatTime(latest.startedAt)}
          </span>
        )}
        {total > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm ar-retry-assessment"
            onClick={onRetryAssessment}
          >
            Retry assessment
          </button>
        )}
      </div>
      <AttemptTimeline assessment={assessment} />
      <p className="ar-verdict t-display-2">{verdict}</p>

      {families.length > 0 && (
        <div className="ar-family-row" aria-label="Score by family">
          {families.map((f) => (
            <span key={f.format} className={`tag tag-sm ${familyTagClass(f, assessment.questions)}`}>
              {FAMILY_LABELS[f.format]} {f.correct}/{f.total}
            </span>
          ))}
        </div>
      )}

      {assessment.warnings
        .filter((w) => w.code === 'grounding_stale')
        .map((w) => (
          <div className="banner attention ar-stale-banner" role="status" key={w.code}>
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
              <p className="banner-desc">{w.message}</p>
            </div>
          </div>
        ))}

      {assessment.warnings.filter((w) => w.code !== 'grounding_stale').length > 0 && (
        <div className="ar-warnings" role="status" aria-label="Assessment warnings">
          {assessment.warnings
            .filter((w) => w.code !== 'grounding_stale')
            .map((w) => (
              <div className="ar-warning" key={`${w.code}-${w.questionId ?? 'global'}`}>
                <code className="ar-warning-code">{w.code}</code>
                <p className="ar-warning-msg">{w.message}</p>
                {w.questionId && (
                  <button
                    type="button"
                    className="ar-warning-jump"
                    onClick={() => jumpToWarning(w.questionId)}
                  >
                    Go to question
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

function QuestionNavigator({
  questions,
  activeIndex,
  onSelect,
  layout,
}: {
  questions: MockQuestion[];
  activeIndex: number;
  onSelect: (index: number) => void;
  layout: 'rail' | 'strip';
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    onSelect((activeIndex + delta + questions.length) % questions.length);
  }

  return (
    <nav
      className={`ar-navigator is-${layout}`}
      role="tablist"
      aria-label="Question navigator"
      onKeyDown={handleKeyDown}
    >
      {questions.map((q, index) => {
        const status = displayStatus(q);
        const active = index === activeIndex;
        return (
          <button
            key={q.id}
            type="button"
            role="tab"
            aria-current={active ? 'true' : undefined}
            aria-label={`Question ${index + 1}, ${status}`}
            className={`ar-navtab is-${status}${active ? ' is-active' : ''}`}
            onClick={() => onSelect(index)}
          >
            <StatusIcon status={status} />
            <span className="ar-navtab-num">{index + 1}</span>
            <span className="ar-navtab-format">{q.format}</span>
          </button>
        );
      })}
    </nav>
  );
}

const CRITERION_LABELS: Record<MockRubricCriterion['outcome'], string> = {
  met: 'met',
  partial: 'partial',
  not_met: 'not met',
};

function criterionTagClass(outcome: MockRubricCriterion['outcome']): string {
  switch (outcome) {
    case 'met':
      return 'tag-moss';
    case 'partial':
      return 'tag-terracotta';
    default:
      return 'tag-rust';
  }
}

/** Shared per-skill observations list — part of the QuestionReviewCard primitive. */
function PerSkillList({ attempt }: { attempt: MockAttempt }) {
  if (attempt.perSkill.length === 0) return null;
  return (
    <div className="ar-perskill">
      <h4 className="ar-subhead">Skills observed</h4>
      <ul className="ar-perskill-list">
        {attempt.perSkill.map((s) => (
          <li key={s.skillTag} className="ar-perskill-row">
            <span className="ar-perskill-tag">{s.skillTag}</span>
            <span className={`tag tag-sm ${s.correct ? 'tag-moss' : 'tag-rust'}`}>
              {s.correct ? 'correct' : 'not yet'}
            </span>
            <span className="ar-perskill-score t-mono-sm">{s.score.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Expandable source evidence (chunkId + quote) — mirrors the issue-38 treatment. */
function CitationList({ question }: { question: MockQuestion }) {
  const [open, setOpen] = useState(false);
  if (question.citations.length === 0) return null;
  return (
    <div className="ar-citations">
      <button
        type="button"
        className="ar-citations-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
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
          {question.citations.map((c) => (
            <li key={c.chunkId} className="ar-citation">
              <code className="ar-citation-chunk">chunk {c.chunkId.slice(0, 8)}</code>
              <span className="ar-citation-quote">&ldquo;{c.quote}&rdquo;</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ObjectiveFeedback({ question, attempt }: { question: MockQuestion; attempt: MockAttempt }) {
  return (
    <>
      <div className="ar-options" role="list" aria-label="Answer options with your selection">
        {question.options.map((option, index) => {
          const selected = attempt.selectedOptionIndex === index;
          return (
            <div
              key={option}
              role="listitem"
              className={`ar-option${selected ? ' is-selected' : ''}`}
            >
              <span className="ar-option-marker" aria-hidden="true">
                {selected ? '●' : '○'}
              </span>
              <span className="ar-option-label">{option}</span>
              {selected && <span className="tag tag-sm">your answer</span>}
            </div>
          );
        })}
      </div>
      <PerSkillList attempt={attempt} />
      <CitationList question={question} />
    </>
  );
}

function WrittenFeedback({ question, attempt }: { question: MockQuestion; attempt: MockAttempt }) {
  return (
    <>
      {attempt.rubricCriteria && attempt.rubricCriteria.length > 0 && (
        <div className="ar-rubric">
          <h4 className="ar-subhead">Feedback by criterion</h4>
          <ul className="ar-rubric-list">
            {attempt.rubricCriteria.map((c) => (
              <li key={c.label} className="ar-rubric-row">
                <span className={`tag tag-sm ${criterionTagClass(c.outcome)}`}>
                  {CRITERION_LABELS[c.outcome]}
                </span>
                <span className="ar-rubric-label">{c.label}</span>
                <span className="ar-rubric-score t-mono-sm">{c.score.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {attempt.explanation && <p className="ar-explanation">{attempt.explanation}</p>}
      <PerSkillList attempt={attempt} />
      <CitationList question={question} />
    </>
  );
}

function CodingFeedback({ question, attempt }: { question: MockQuestion; attempt: MockAttempt }) {
  const execution = attempt.execution;
  if (!execution) return null;
  const anyFailed = execution.testCases.some((t) => !t.passed);

  return (
    <>
      <div className="ar-exec-rows">
        <div className="ar-exec-row">
          <span className="ar-exec-key">Compile</span>
          <span
            className={`tag tag-sm ${
              execution.compile.status === 'failed'
                ? 'tag-rust'
                : execution.compile.status === 'passed'
                  ? 'tag-moss'
                  : ''
            }`}
          >
            {execution.compile.status === 'not_run' ? 'not run' : execution.compile.status}
          </span>
          {execution.compile.stderr && (
            <pre className="ar-stderr">{execution.compile.stderr}</pre>
          )}
        </div>
        <div className="ar-exec-row">
          <span className="ar-exec-key">Run</span>
          <span
            className={`tag tag-sm ${
              execution.runtime.status === 'succeeded'
                ? 'tag-moss'
                : execution.runtime.status === 'failed'
                  ? 'tag-rust'
                  : ''
            }`}
          >
            {execution.runtime.status === 'not_run' ? 'not run' : execution.runtime.status}
            {execution.runtime.durationMs != null && ` · ${execution.runtime.durationMs} ms`}
          </span>
        </div>
      </div>

      <table className="ar-tests">
        <caption className="ar-subhead">
          Test cases {anyFailed ? '' : '— all passed'}
        </caption>
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Expected</th>
            <th scope="col">Actual</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {execution.testCases.map((t) => (
            <tr key={t.name} className={t.passed ? 'is-pass' : 'is-fail'}>
              <td>{t.name}</td>
              <td className="t-mono-sm">{t.expected ?? '—'}</td>
              <td className="t-mono-sm">{t.actual ?? '—'}</td>
              <td>
                <span
                  className={`tag tag-sm ${t.passed ? 'tag-moss' : 'tag-rust'}`}
                  aria-label={t.passed ? 'passed' : 'failed'}
                >
                  {t.passed ? 'pass' : 'fail'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <PerSkillList attempt={attempt} />
      <CitationList question={question} />
    </>
  );
}

/** One attempt in the visible history — prior attempts stay expandable (D-07). */
function AttemptCard({
  attempt,
  question,
  attemptNumber,
  isLatest,
}: {
  attempt: MockAttempt;
  question: MockQuestion;
  attemptNumber: number;
  isLatest: boolean;
}) {
  const [open, setOpen] = useState(isLatest);
  const status: QuestionDisplayStatus = attempt.isQueued
    ? 'processing'
    : attempt.correct
      ? 'correct'
      : attempt.score >= 0.6
        ? 'partial'
        : 'incorrect';

  if (attempt.isQueued) {
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
    );
  }

  return (
    <div className={`ar-attempt${isLatest ? ' is-latest' : ' is-prior'}`}>
      <button
        type="button"
        className="ar-attempt-head ar-attempt-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ar-attempt-label">Attempt #{attemptNumber}</span>
        <span className={`tag tag-sm ${questionStatusTag(status)} ar-attempt-tag`}>
          <StatusIcon status={status} /> {status} · {attempt.score.toFixed(2)}
        </span>
        <span className="ar-attempt-time t-mono-sm">{formatTime(attempt.attemptedAt)}</span>
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
          <p className="ar-feedback-line">{attempt.publicFeedback}</p>
          {question.format === 'objective' && (
            <ObjectiveFeedback question={question} attempt={attempt} />
          )}
          {question.format === 'written' && (
            <WrittenFeedback question={question} attempt={attempt} />
          )}
          {question.format === 'coding' && <CodingFeedback question={question} attempt={attempt} />}
        </div>
      )}
    </div>
  );
}

/** Preserved attempt history, oldest first — the retry record #40 must keep. */
function AttemptHistoryBlock({ question }: { question: MockQuestion }) {
  const last = question.attempts.length - 1;
  if (last < 0) return null;
  const prior = question.attempts[last - 1];
  return (
    <div className="ar-attempts" aria-label="Attempt history">
      {last > 0 && question.attempts[last].isQueued && prior && (
        <p className="ar-queued-note" role="status">
          New attempt queued — previous attempt kept (Attempt #{last} · score{' '}
          {prior.score.toFixed(2)}).
        </p>
      )}
      {question.attempts.map((attempt, index) => (
        <AttemptCard
          key={attempt.attemptId}
          attempt={attempt}
          question={question}
          attemptNumber={index + 1}
          isLatest={index === last}
        />
      ))}
    </div>
  );
}

/**
 * Shared question-review primitive — the component #40 (and Practice #16) would
 * reuse: prompt + family feedback treatment + per-skill observations + citations,
 * rendered for one attempt of the question.
 */
function QuestionReviewCard({ question, attempt }: { question: MockQuestion; attempt: MockAttempt }) {
  return (
    <>
      <p className="ar-feedback-line">{attempt.publicFeedback}</p>
      {question.format === 'objective' && <ObjectiveFeedback question={question} attempt={attempt} />}
      {question.format === 'written' && <WrittenFeedback question={question} attempt={attempt} />}
      {question.format === 'coding' && <CodingFeedback question={question} attempt={attempt} />}
    </>
  );
}

function RetryQuestionButton({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ar-retry-row">
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
        Retry question
      </button>
      <span className="ar-retry-hint t-body-sm">Queues a fresh attempt — this one stays.</span>
    </div>
  );
}

function QuestionPanelShell({
  question,
  onRetryQuestion,
}: {
  question: MockQuestion | undefined;
  onRetryQuestion: (questionId: string) => void;
}) {
  if (!question) return null;
  const status = displayStatus(question);
  const graded = status === 'correct' || status === 'incorrect' || status === 'partial';
  const latest = currentAttempt(question);

  return (
    <section className="ar-panel" aria-label={`Question ${question.format} review`}>
      <div className="ar-panel-meta">
        <span className="tag tag-sm">{question.format}</span>
        <span className="ar-panel-difficulty t-mono-sm">Difficulty {question.authoredDifficulty}</span>
        {graded && <span className={`tag tag-sm ${questionStatusTag(status)}`}>{status}</span>}
      </div>
      <p className="ar-panel-prompt">{question.prompt}</p>
      {status === 'processing' && !latest && (
        <div className="ar-skeleton" aria-busy="true" aria-label="Grading question">
          <span className="ar-skeleton-line" />
          <span className="ar-skeleton-line" style={{ width: '82%' }} />
          <span className="ar-skeleton-line" style={{ width: '64%' }} />
        </div>
      )}
      {status === 'pending' && (
        <p className="ar-panel-pending t-body-sm">This question is waiting to be graded.</p>
      )}
      {graded && question.attempts.length <= 1 && latest && (
        <>
          <QuestionReviewCard question={question} attempt={latest} />
          <RetryQuestionButton onRetry={() => onRetryQuestion(question.id)} />
        </>
      )}
      {question.attempts.length > 1 && (
        <>
          <AttemptHistoryBlock question={question} />
          {graded && <RetryQuestionButton onRetry={() => onRetryQuestion(question.id)} />}
        </>
      )}
    </section>
  );
}

/** Collapsed record of the prior attempt timeline — stays present after retry (D-07). */
function AttemptTimeline({ assessment }: { assessment: MockAssessment }) {
  const past = assessment.attempts.slice(0, -1);
  if (past.length === 0) return null;
  return (
    <details className="ar-timeline-prior">
      <summary>
        Previous attempt timeline — {past.length} attempt{past.length > 1 ? 's' : ''}
        {past[past.length - 1].score != null &&
          ` · last score ${past[past.length - 1].score!.toFixed(2)}`}
      </summary>
      <ul className="ar-timeline-list">
        {past.map((a) => (
          <li key={a.attemptId}>
            <span className="t-mono-sm">
              {formatTime(a.startedAt)}
              {a.completedAt ? ` → ${formatTime(a.completedAt)}` : ' → in flight'}
            </span>
            <span
              className={`tag tag-sm ${
                a.status === 'graded' ? 'tag-moss' : a.status === 'failed' ? 'tag-rust' : ''
              }`}
            >
              {a.status}
              {a.score != null && ` · ${a.score.toFixed(2)}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ReviewSurface({ seedAssessment, variant }: { seedAssessment: MockAssessment; variant: Variant }) {
  const [live, setLive] = useState(seedAssessment);
  const [activeIndex, setActiveIndex] = useState(0);
  const total = live.questions.length;

  function queuedAttempt(questionId: string, attemptNumber: number): MockAttempt {
    return {
      attemptId: `att-live-q${attemptNumber}-${questionId}-queued`,
      questionId,
      attemptedAt: new Date().toISOString(),
      score: 0,
      correct: false,
      grader: 'objective',
      publicFeedback: 'Grading in progress — a fresh signal is on its way.',
      isQueued: true,
      perSkill: [],
    };
  }

  function retryQuestion(questionId: string) {
    setLive((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              attempts: [...q.attempts, queuedAttempt(questionId, q.attempts.length + 1)],
            }
          : q,
      ),
    }));
  }

  function retryAssessment() {
    setLive((prev) => ({
      ...prev,
      attempts: [
        ...prev.attempts,
        {
          attemptId: `att-live-${prev.attempts.length + 1}`,
          startedAt: new Date().toISOString(),
          status: 'processing' as const,
        },
      ],
      questions: prev.questions.map((q) => ({
        ...q,
        status: 'processing' as const,
        attempts: [...q.attempts, queuedAttempt(q.id, q.attempts.length + 1)],
      })),
    }));
  }

  useEffect(() => {
    setLive(seedAssessment);
    setActiveIndex(0);
  }, [seedAssessment]);

  if (total === 0) {
    return (
      <div className={`ar-variant-shell ar-variant-${variant.toLowerCase()}`}>
        <SummaryBand assessment={live} onJumpToQuestion={() => {}} onRetryAssessment={retryAssessment} />
        <section className="ar-empty" role="status" aria-label="No questions to review">
          <p className="t-body-sm">No questions to review.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={retryAssessment}>
            Retry assessment
          </button>
          {live.attempts.length > 0 && (
            <p className="ar-timeline-current">
              Attempt #{live.attempts.length} — started{' '}
              {formatTime(live.attempts[live.attempts.length - 1].startedAt)} · grading in flight
            </p>
          )}
        </section>
      </div>
    );
  }

  const activeQuestion = live.questions[Math.min(activeIndex, total - 1)];

  if (variant === 'B') {
    return (
      <div className="ar-variant-shell ar-variant-b">
        <QuestionNavigator
          questions={live.questions}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          layout="rail"
        />
        <div className="ar-content-col">
          <SummaryBand
            assessment={live}
            onJumpToQuestion={setActiveIndex}
            onRetryAssessment={retryAssessment}
          />
          <QuestionPanelShell question={activeQuestion} onRetryQuestion={retryQuestion} />
        </div>
      </div>
    );
  }

  return (
    <div className="ar-variant-shell ar-variant-a">
      <SummaryBand
        assessment={live}
        onJumpToQuestion={setActiveIndex}
        onRetryAssessment={retryAssessment}
      />
      <QuestionNavigator
        questions={live.questions}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        layout="strip"
      />
      <QuestionPanelShell question={activeQuestion} onRetryQuestion={retryQuestion} />
    </div>
  );
}

export default function AssessmentReviewPrototype() {
  const [params, setParams] = useSearchParams();
  const stateParam = params.get('state');
  const state: MockStateKey = MOCK_STATE_KEYS.includes(stateParam as MockStateKey)
    ? (stateParam as MockStateKey)
    : 'ready';
  const variant: Variant = (params.get('variant') ?? 'A').toUpperCase() === 'B' ? 'B' : 'A';

  const assessment = getMockAssessment(state);

  function goState(next: MockStateKey) {
    const p = new URLSearchParams(params);
    p.set('state', next);
    setParams(p, { replace: true });
  }

  return (
    <div className="ar-page">
      <header className="ar-header">
        <div className="ar-eyebrow">Prototype · wayfinder #34 · throwaway</div>
        <h1 className="ar-title">Assessment review and feedback</h1>
        <p className="ar-sub">
          How should graded results — rubric breakdowns, per-test-case tables, per-question
          explanations — read in the review view? Compare the drawer (A) and split-pane (B)
          arrangements across every honest state. Nothing persists.
        </p>

        <div className="ar-statebar" role="toolbar" aria-label="Assessment review state">
          {MOCK_STATE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`ar-statebtn${state === key ? ' is-active' : ''}`}
              aria-pressed={state === key}
              onClick={() => goState(key)}
            >
              {MOCK_STATE_TITLES[key]}
            </button>
          ))}
        </div>
      </header>

      <ReviewSurface seedAssessment={assessment} variant={variant} />

      <div className="ar-note">
        <strong>Drive it:</strong> flip the five states to see the review vocabulary, then switch
        A/B to compare the drawer and split-pane arrangements. Refresh resets to the seed state —
        retry buttons mutate in-component state only (Phase 4).
      </div>

      <PrototypeSwitcher names={VARIANT_NAMES} keys={['A', 'B']} />
    </div>
  );
}