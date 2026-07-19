import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { useEventStore } from '../events/useEventStore'
import { deriveRoadmapDraft, type RoadmapDraftSummary } from '../roadmap/roadmapDraft'
import {
  deriveRoadmapLifecycle,
  type RoadmapLifecycleEntry,
} from '../roadmap/roadmapLifecycle'
import { resolveRoadmap, type RoadmapResolutionKind } from '../roadmap/resolveRoadmap'
import { RoadmapEndedBanner } from '../roadmap/RoadmapEndedBanner'
import { summarizeRoadmapProgress } from '../roadmap/roadmapProgress'
import { deriveRoadmapEndedState } from '../roadmap/useRoadmapEndedState'
import { useSync } from '../sync/useSync'
import '../roadmap/roadmap.css'

function formatRange(entry: RoadmapLifecycleEntry): string {
  return `${format(parseISO(entry.startDate), 'MMM d')} to ${format(parseISO(entry.deadline), 'MMM d, yyyy')}`
}

function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

function onboardingPath(draft: RoadmapDraftSummary): string {
  return `/onboarding/${draft.stepReached}?new=1`
}

function HistoryRows({
  entries,
}: {
  entries: RoadmapLifecycleEntry[]
}) {
  if (entries.length === 0) {
    return <p className="roadmaps-muted">Completed and abandoned plans will settle here.</p>
  }

  return (
    <div className="roadmaps-list">
      {entries.map((entry) => (
        <Link
          key={entry.roadmapCreatedAt}
          className="roadmaps-row rmd-history-row"
          to={`/roadmap?roadmap=${encodeURIComponent(entry.roadmapCreatedAt)}`}
        >
          <span className="roadmaps-row-main">
            <span className="roadmaps-row-title">{entry.title}</span>
            <span className="roadmaps-row-meta">
              {formatRange(entry)} · {entry.weeks} weeks
            </span>
          </span>
          <span className={`rmd-status-pill rmd-status-${entry.status}`}>
            {entry.status}
          </span>
        </Link>
      ))}
    </div>
  )
}

export function Roadmaps() {
  const eventStore = useEventStore()
  const navigate = useNavigate()
  const { logEvent } = useSync()
  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])
  const loadedEvents = events ?? []
  const hasCompletedOnboarding = loadedEvents.some((event) => event.kind === 'OnboardingCompleted')
  const draft = useLiveQuery(
    () => deriveRoadmapDraft(eventStore, hasCompletedOnboarding),
    [eventStore, hasCompletedOnboarding],
  ) ?? null
  const [showCloseControls, setShowCloseControls] = useState(false)
  const [closePromptDraft, setClosePromptDraft] = useState<RoadmapDraftSummary | null>(null)

  const lifecycle = useMemo(
    () => deriveRoadmapLifecycle(loadedEvents),
    [loadedEvents],
  )
  const roadmapEnded = useMemo(
    () => deriveRoadmapEndedState(loadedEvents),
    [loadedEvents],
  )
  const activeEntry = lifecycle.active[0] ?? null
  const activeEnded = roadmapEnded.ended &&
    roadmapEnded.entry?.roadmapCreatedAt === activeEntry?.roadmapCreatedAt
  const historyEntries = lifecycle.all.filter((entry) => entry.status !== 'active')
  const activeStats = activeEntry ? summarizeRoadmapProgress(activeEntry, loadedEvents) : null

  const handleResolve = async (kind: RoadmapResolutionKind) => {
    if (!activeEntry) return
    const resolved = await resolveRoadmap({
      kind,
      roadmapCreatedAt: activeEntry.roadmapCreatedAt,
      logEvent,
    })
    if (!resolved) return

    setShowCloseControls(false)
    setClosePromptDraft(draft)
  }

  const handleDiscardDraft = async () => {
    await eventStore.table('onboardingDraft').delete(1)
    setClosePromptDraft(null)
  }

  if (!events) {
    return (
      <div className="roadmaps-page">
        <p className="t-body" role="status" style={{ color: 'var(--text-secondary)' }}>
          Loading roadmaps...
        </p>
      </div>
    )
  }

  return (
    <div className="roadmaps-page">
      <header className="roadmaps-header">
        <div>
          <div className="mono-caps">Roadmaps</div>
          <h1 className="roadmaps-title">Plan, close, and begin again</h1>
          <p className="roadmaps-subtitle">
            Keep one active roadmap, one next draft, and a quiet ledger of what you have finished.
          </p>
        </div>
      </header>

      <section className="rmd-zone" aria-label="Active roadmap">
        <div className="rmd-zone-head">
          <h2>Active</h2>
          {activeEntry && (
            <span className={`rmd-status-pill ${activeEnded ? 'rmd-status-ended' : 'rmd-status-active'}`}>
              {activeEnded ? <>&bull; Ended &mdash; needs review</> : 'active'}
            </span>
          )}
        </div>

        {activeEntry && activeStats ? (
          <div className="rmd-hero" data-testid="roadmaps-active-hero">
            {activeEnded && (
              <RoadmapEndedBanner
                entry={activeEntry}
                onMarkComplete={() => void handleResolve('RoadmapMarkedComplete')}
                onAbandon={() => void handleResolve('RoadmapMarkedAbandoned')}
              />
            )}

            <div className="rmd-hero-main">
              <div className="mono-caps">{formatRange(activeEntry)} · {activeEntry.weeks} weeks</div>
              <h2 className="rmd-hero-title">{activeEntry.title}</h2>
              <div className="rmd-progress-row">
                <span className="mono-caps">Progress</span>
                <span className="rmd-progress-number">{activeStats.percentComplete}%</span>
              </div>
              <div className="progress" aria-label={`${activeStats.percentComplete}% complete`}>
                <div className="progress-fill" style={{ width: `${activeStats.percentComplete}%` }} />
              </div>
              <div className="rmd-stat-strip" aria-label="Active roadmap stats">
                <span><strong>{activeStats.sessionsCount}</strong> sessions</span>
                <span><strong>{formatMinutes(activeStats.loggedMinutes)}</strong> logged</span>
                <span><strong>{activeStats.percentComplete}%</strong> complete</span>
              </div>
            </div>
            <div className="rmd-actions">
              <Link className="btn btn-accent" to="/roadmap">
                Open plan
              </Link>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowCloseControls((shown) => !shown)}
              >
                Close plan
              </button>
            </div>

            {showCloseControls && (
              <div className="rmd-close-panel" data-testid="roadmaps-close-controls">
                <span className="rmd-close-copy">Move this roadmap to history as:</span>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => void handleResolve('RoadmapMarkedComplete')}
                >
                  Complete
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => void handleResolve('RoadmapMarkedAbandoned')}
                >
                  Abandon
                </button>
              </div>
            )}

            {closePromptDraft && (
              <div className="rmd-start-prompt" data-testid="roadmaps-close-prompt">
                <div>
                  <div className="mono-caps">Next up</div>
                  <p>Ready to start {closePromptDraft.title}?</p>
                </div>
                <div className="rmd-actions-inline">
                  <Link className="btn btn-accent" to={onboardingPath(closePromptDraft)}>
                    Start now
                  </Link>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setClosePromptDraft(null)}
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rmd-empty-active" data-testid="roadmaps-empty">
            <div>
              <div className="mono-caps">No active roadmap</div>
              <h2>Plan your next roadmap</h2>
            </div>
            {!draft && (
              <Link className="btn btn-accent" to="/onboarding?new=1">
                Plan your next roadmap
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="rmd-zone" aria-label="Next roadmap draft">
        <div className="rmd-zone-head">
          <h2>Next up</h2>
          {draft && <span className="rmd-status-pill rmd-status-draft">draft</span>}
        </div>

        {draft ? (
          <div className="rmd-draft" data-testid="roadmaps-draft-card">
            <div>
              <div className="mono-caps">Paused at step {draft.stepReached} · {draft.stepLabel}</div>
              <h3>{draft.title}</h3>
              {activeEntry && (
                <p className="rmd-lock-note">Start unlocks when the current plan is closed.</p>
              )}
            </div>
            <div className="rmd-actions">
              <Link className="btn btn-secondary" to={onboardingPath(draft)}>
                Resume setup
              </Link>
              <button
                className="btn btn-accent"
                type="button"
                data-testid="roadmaps-start-plan"
                disabled={activeEntry !== null}
                onClick={() => navigate(onboardingPath(draft))}
              >
                Start plan
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void handleDiscardDraft()}
              >
                Discard
              </button>
            </div>
          </div>
        ) : activeEntry ? (
          <Link className="rmd-slim-add" to="/onboarding?new=1">
            + Plan your next roadmap
          </Link>
        ) : (
          <p className="roadmaps-muted">No draft waiting.</p>
        )}
      </section>

      <section className="rmd-zone" aria-label="Roadmap history">
        <div className="rmd-zone-head">
          <h2>History</h2>
          <span className="roadmaps-count">{historyEntries.length}</span>
        </div>
        <div className="roadmaps-groups">
          <HistoryRows entries={historyEntries} />
        </div>
      </section>
    </div>
  )
}
