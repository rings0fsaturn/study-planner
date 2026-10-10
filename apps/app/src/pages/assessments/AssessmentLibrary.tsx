import { useCallback, useEffect, useRef, useState } from 'react'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import { AssessmentServiceError } from '../../assessments/types'
import { ASSESSMENT_DELETED, type EventStore } from '../../events/EventStore'
import { useEventStoreContext } from '../../events/EventStoreProvider'
import { logger } from '../../lib/logger'
import { AssessmentDeleteDialog, type AssessmentDeleteTarget } from '../../library/AssessmentDeleteDialog'
import { AssessmentCard, assessmentMeta } from '../../library/LibraryCards'
import {
  LibraryHubError,
  LibraryHubLoading,
  LibraryHubShell,
} from '../../library/LibraryHubShell'
import {
  MATERIAL_TITLE_PENDING,
  POLL_INTERVAL_MS,
  useLibraryRows,
} from '../../library/useLibraryRows'

const DELETE_FAILED_COPY = 'Could not delete this assessment. Try again.'
const JOB_DELETE_FAILED_COPY = 'The deletion job failed. The assessment is still here.'
const RECORD_FAILED_COPY = 'Deleted on the server, but this device could not record it. Reload to refresh.'
const CONFIRM_FAILED_COPY = 'Could not confirm the deletion. Reload to check.'

/**
 * One delete flow at a time. Every phase is the single source of the dialog's
 * open/locked/error affordances, so illegal combinations (a job without a
 * target, confirming with nothing pending) cannot be represented.
 */
type DeleteFlow =
  | { phase: 'idle' }
  | { phase: 'confirming'; target: AssessmentDeleteTarget }
  | { phase: 'submitting'; target: AssessmentDeleteTarget }
  | { phase: 'polling'; target: AssessmentDeleteTarget; jobId: string }
  | { phase: 'error'; target: AssessmentDeleteTarget; message: string }

/**
 * `/assessments` hub (Phase 2, variant B card grid). Renders hydrated rows
 * only; derivation lives in the library model, I/O in the hook. Owns the
 * delete flow: confirm dialog -> typed delete call -> job poll -> tombstone
 * event -> local eviction, so the row leaves only after the server confirms.
 */
export function AssessmentLibrary() {
  const assessments = useAssessmentClient()
  const { eventStore } = useEventStoreContext()
  const {
    assessmentRows,
    materialTitles,
    loading,
    refreshing,
    errorCount,
    reload,
    evictAssessment,
  } = useLibraryRows()

  const [flow, setFlow] = useState<DeleteFlow>({ phase: 'idle' })
  const openerRef = useRef<HTMLElement | null>(null)
  // The store that is active right now; a late enqueue response must not arm
  // the poll against the next account's store (flow-recreation discipline).
  const eventStoreRef = useRef(eventStore)

  // Account switch: drop every in-flight delete affordance; the flow belongs
  // to the store that started it (flow-recreation precedent, useLibraryRows).
  useEffect(() => {
    eventStoreRef.current = eventStore
    setFlow({ phase: 'idle' })
  }, [eventStore])

  async function handleRetry(assessmentId: string) {
    try {
      await assessments.regenerateAssessment(assessmentId)
    } catch (error) {
      logger.warn('[library] regenerate failed', error)
    }
  }

  function handleDeleteOpen(assessmentId: string, opener: HTMLElement) {
    // One delete at a time: retargeting while a job is in flight would drop
    // the polling job id and lose the first tombstone, so the second X is ignored.
    if (flow.phase === 'submitting' || flow.phase === 'polling') return
    const row = assessmentRows.find((candidate) => candidate.assessmentId === assessmentId)
    if (!row) return
    openerRef.current = opener
    setFlow({
      phase: 'confirming',
      target: {
        assessmentId: row.assessmentId,
        title: materialTitles[row.primaryMaterialId] ?? MATERIAL_TITLE_PENDING,
        meta: assessmentMeta(row),
        generating: row.state === 'generating',
      },
    })
  }

  const handleCancel = useCallback(() => setFlow({ phase: 'idle' }), [])

  /** The durable tombstone + local eviction; the server row is already gone. */
  const finalizeDeleted = useCallback(
    async (store: EventStore, assessmentId: string) => {
      await store.append(ASSESSMENT_DELETED, { assessmentId })
      await evictAssessment(assessmentId)
    },
    [evictAssessment],
  )

  async function handleConfirm() {
    if ((flow.phase !== 'confirming' && flow.phase !== 'error') || !eventStore) return
    const { target } = flow
    const store = eventStore
    setFlow({ phase: 'submitting', target })
    try {
      const job = await assessments.deleteAssessment(target.assessmentId)
      if (eventStoreRef.current !== store) return
      setFlow({ phase: 'polling', target, jobId: job.jobId })
    } catch (error) {
      logger.warn('[library] delete enqueue failed', error)
      if (eventStoreRef.current !== store) return
      if (error instanceof AssessmentServiceError && error.code === 'not_found') {
        // Already gone server-side (deleted here earlier or on another
        // device): finalize locally instead of showing a raw 404.
        try {
          await finalizeDeleted(store, target.assessmentId)
          if (eventStoreRef.current !== store) return
          setFlow({ phase: 'idle' })
        } catch (finalizeError) {
          logger.warn('[library] delete finalize failed', finalizeError)
          if (eventStoreRef.current !== store) return
          setFlow({ phase: 'error', target, message: RECORD_FAILED_COPY })
        }
        return
      }
      setFlow({
        phase: 'error',
        target,
        message: error instanceof AssessmentServiceError ? error.message : DELETE_FAILED_COPY,
      })
    }
  }

  // One job id, polled on the hub cadence until it resolves (rule 17: the
  // enqueue and poll calls each carry their own X-Request-ID). The in-flight
  // guard mirrors the library poll: a getJob slower than the interval must
  // never overlap its predecessor and double-append the tombstone.
  const pollingJobId = flow.phase === 'polling' ? flow.jobId : null
  const pollingTarget = flow.phase === 'polling' ? flow.target : null
  const pollInFlight = useRef(false)
  useEffect(() => {
    if (!pollingJobId || !pollingTarget || !eventStore) return
    const target = pollingTarget
    const { assessmentId } = target
    const jobId = pollingJobId
    const store = eventStore
    let cancelled = false

    async function poll() {
      if (pollInFlight.current) return
      pollInFlight.current = true
      try {
        const job = await assessments.getJob(jobId)
        if (cancelled) return
        if (job.status === 'succeeded') {
          try {
            await finalizeDeleted(store, assessmentId)
          } catch (error) {
            logger.warn('[library] delete finalize failed', error)
            if (cancelled) return
            setFlow({ phase: 'error', target, message: RECORD_FAILED_COPY })
            return
          }
          if (cancelled) return
          setFlow({ phase: 'idle' })
          return
        }
        if (job.status !== 'queued' && job.status !== 'running') {
          logger.warn('[library] delete job not successful', job.error?.code ?? job.status)
          if (cancelled) return
          setFlow({
            phase: 'error',
            target,
            message: job.error?.message || JOB_DELETE_FAILED_COPY,
          })
        }
      } catch (error) {
        if (cancelled) return
        if (error instanceof AssessmentServiceError && !error.retryable) {
          // A dead job (purged, foreign, expired session) must stop the loop:
          // polling a terminal answer forever leaves the dialog locked.
          logger.warn('[library] delete poll terminal failure', error)
          setFlow({ phase: 'error', target, message: CONFIRM_FAILED_COPY })
          return
        }
        // Transient poll failure: keep polling until the job resolves.
        logger.warn('[library] delete poll failed', error)
      } finally {
        pollInFlight.current = false
      }
    }

    void poll()
    const timer = setInterval(() => {
      void poll()
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pollingJobId, pollingTarget, eventStore, assessments, finalizeDeleted])

  const target = flow.phase === 'idle' ? null : flow.target
  const confirming = flow.phase === 'submitting' || flow.phase === 'polling'
  const deleteError = flow.phase === 'error' ? flow.message : null
  const deletingId = confirming ? flow.target.assessmentId : null

  return (
    <LibraryHubShell
      title="Assessments"
      emptyTitle="No assessments yet"
      emptyBody="Generate your first assessment from a material to see it here."
      empty={!loading && assessmentRows.length === 0}
      refreshing={!loading && refreshing && assessmentRows.length > 0}
    >
      {loading && <LibraryHubLoading text="Loading assessments…" />}
      {!loading && errorCount > 0 && (
        <LibraryHubError
          title="Some assessments could not be read"
          errorCount={errorCount}
          onReload={() => reload()}
        />
      )}
      {!loading && assessmentRows.length > 0 && (
        <div className="materials-grid">
          {assessmentRows.map((row) => (
            <AssessmentCard
              key={row.assessmentId}
              row={row}
              title={materialTitles[row.primaryMaterialId] ?? MATERIAL_TITLE_PENDING}
              onRetry={(id) => void handleRetry(id)}
              onDelete={handleDeleteOpen}
              deleting={deletingId === row.assessmentId}
            />
          ))}
        </div>
      )}
      <AssessmentDeleteDialog
        open={flow.phase !== 'idle'}
        target={target}
        confirming={confirming}
        error={deleteError}
        opener={openerRef.current}
        onCancel={handleCancel}
        onConfirm={() => void handleConfirm()}
      />
    </LibraryHubShell>
  )
}
