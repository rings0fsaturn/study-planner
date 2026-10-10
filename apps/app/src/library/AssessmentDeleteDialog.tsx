import { useEffect, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import './library.css'

export interface AssessmentDeleteTarget {
  assessmentId: string
  title: string
  meta: string
  generating: boolean
}

export interface AssessmentDeleteDialogProps {
  open: boolean
  target: AssessmentDeleteTarget | null
  /** One delete job is in flight: both buttons lock, confirm reads Deleting… */
  confirming: boolean
  /** Typed failure copy shown inline; the dialog stays open for a retry/cancel. */
  error: string | null
  /**
   * The control that opened the dialog; focus returns here on close. The page
   * passes the corner X explicitly because browsers such as Safari do not
   * focus a button on mouse click. Falls back to the active element at open.
   */
  opener?: HTMLElement | null
  onCancel: () => void
  onConfirm: () => void
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getAttribute('aria-hidden') !== 'true')
}

/**
 * Destructive confirm for the library delete flow (Delete assessment).
 * Focus contract copied from ProgressLabModal: initial focus on Cancel, trap
 * on Tab, Esc + backdrop cancel, opener focus restored on close. While the
 * job is in flight the dialog stays open and neither path can dismiss it.
 */
export function AssessmentDeleteDialog({
  open,
  target,
  confirming,
  error,
  opener,
  onCancel,
  onConfirm,
}: AssessmentDeleteDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const confirmingRef = useRef(confirming)

  useEffect(() => {
    confirmingRef.current = confirming
  }, [confirming])

  useEffect(() => {
    if (!open || !target || typeof document === 'undefined') return

    // Prefer the page-supplied X; the active element only covers keyboard
    // activation and browsers that focus buttons on click.
    openerRef.current =
      opener ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    const previousOverflow = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'

    const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus())
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!confirmingRef.current) onCancel()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = focusableElements(dialogRef.current)
      if (focusable.length === 0) {
        // Both actions are disabled while confirming; the browser drops focus
        // to the body, so Tab must be pulled back onto the dialog shell
        // instead of escaping to the page behind the overlay.
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior = previousOverscroll
      if (openerRef.current?.isConnected) openerRef.current.focus()
    }
  }, [onCancel, opener, open, target])

  if (!open || !target || typeof document === 'undefined') return null

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !confirmingRef.current) onCancel()
  }

  return createPortal(
    <div
      ref={dialogRef}
      className="assessment-delete-overlay"
      data-testid="assessment-delete-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assessment-delete-title"
      aria-describedby="assessment-delete-desc"
      tabIndex={-1}
      onClick={handleBackdrop}
    >
      <article className="assessment-delete-shell">
        <div className="mono-caps assessment-delete-eyebrow">Delete assessment</div>
        <h2 id="assessment-delete-title" className="assessment-delete-heading">
          Confirm delete this assessment?
        </h2>
        <div id="assessment-delete-desc">
          <p className="assessment-delete-target">
            <strong>{target.title}</strong>
            <span className="assessment-delete-target-meta"> · {target.meta}</span>
          </p>
          <ul className="assessment-delete-list">
            <li>Its question and all attempts, including local rows</li>
            <li>Its cached copy on this device</li>
            <li>Practice history keeps pointing here as unavailable, never deleted</li>
          </ul>
          {target.generating && (
            <p className="assessment-delete-warning">
              This one is still generating: deletion also drops its queued generation job.
            </p>
          )}
        </div>
        {error && (
          <p className="assessment-delete-error" role="alert">
            {error}
          </p>
        )}
        <div className="assessment-delete-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            disabled={confirming}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-destructive"
            disabled={confirming}
            aria-busy={confirming}
            onClick={onConfirm}
          >
            {confirming ? 'Deleting…' : 'Delete assessment'}
          </button>
        </div>
      </article>
    </div>,
    document.body,
  )
}

export default AssessmentDeleteDialog
