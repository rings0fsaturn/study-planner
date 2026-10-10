import { useCallback, useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  AssessmentDeleteDialog,
  type AssessmentDeleteTarget,
} from './AssessmentDeleteDialog'

const TARGET: AssessmentDeleteTarget = {
  assessmentId: 'a-1',
  title: 'Operating Systems',
  meta: 'Objective · Sep 20 · 3 questions',
  generating: false,
}

function renderDialog(overrides: {
  confirming?: boolean
  error?: string | null
  target?: AssessmentDeleteTarget | null
} = {}) {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  const view = render(
    <AssessmentDeleteDialog
      open
      target={TARGET}
      confirming={overrides.confirming ?? false}
      error={overrides.error ?? null}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...(overrides.target === undefined ? {} : { target: overrides.target })}
    />,
  )
  return { ...view, onCancel, onConfirm }
}

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
  document.body.style.overscrollBehavior = ''
})

describe('AssessmentDeleteDialog', () => {
  it('renders an accessible confirm dialog naming the assessment and what goes away', async () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Confirm delete this assessment?' })
    expect(dialog.parentElement).toBe(document.body)
    expect(screen.getByText('Operating Systems')).toBeInTheDocument()
    expect(screen.getByText(/Objective · Sep 20 · 3 questions/)).toBeInTheDocument()
    expect(screen.getByText(/question and all attempts, including local rows/i)).toBeInTheDocument()
    expect(screen.getByText(/cached copy on this device/i)).toBeInTheDocument()
    expect(screen.getByText(/Practice history keeps pointing here as unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/still generating/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete assessment' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('does not render without an open flag or target', () => {
    const view = renderDialog({ target: null })
    expect(screen.queryByRole('dialog')).toBeNull()
    view.unmount()
    render(
      <AssessmentDeleteDialog
        open={false}
        target={TARGET}
        confirming={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('locks body scroll while open and restores it on close', async () => {
    const view = renderDialog()
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('traps Tab inside the dialog: Shift+Tab from Cancel wraps to Delete, Tab from Delete wraps back', async () => {
    renderDialog()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Delete assessment' })
    await waitFor(() => expect(cancel).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(cancel).toHaveFocus()
  })

  it('cancels on Escape and on a backdrop click, but not on a click inside the shell', () => {
    const { onCancel } = renderDialog()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(document.querySelector('.assessment-delete-shell') as HTMLElement)
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('assessment-delete-backdrop'))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('shows the generating warning and the typed error alert', () => {
    renderDialog({
      target: { ...TARGET, generating: true },
      error: 'A deletion job is already open for this assessment.',
    })
    expect(screen.getByText(/still generating: deletion also drops its queued generation job/i)).toBeInTheDocument()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('A deletion job is already open for this assessment.')
  })

  it('locks both buttons and ignores Escape and backdrop while confirming', () => {
    const { onCancel } = renderDialog({ confirming: true })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Deleting…' })
    expect(cancel).toBeDisabled()
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveAttribute('aria-busy', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('assessment-delete-backdrop'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('keeps Tab on the dialog shell while confirming with both buttons disabled', () => {
    render(
      <>
        <button type="button">Background</button>
        <AssessmentDeleteDialog
          open
          target={TARGET}
          confirming
          error={null}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      </>,
    )
    const background = screen.getByRole('button', { name: 'Background' })
    background.focus()
    expect(background).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('dialog', { name: 'Confirm delete this assessment?' })).toHaveFocus()
    expect(background).not.toHaveFocus()
  })

  it('restores focus to the opener after cancel when the dialog closes', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      const close = useCallback(() => setOpen(false), [])
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open delete</button>
          <AssessmentDeleteDialog
            open={open}
            target={TARGET}
            confirming={false}
            error={null}
            onCancel={close}
            onConfirm={() => {}}
          />
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open delete' })
    opener.focus()
    fireEvent.click(opener)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(opener).toHaveFocus())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  it('restores the explicit opener when nothing inside was focused at open', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      const opener = useRef<HTMLButtonElement>(null)
      const close = useCallback(() => setOpen(false), [])
      return (
        <>
          <button ref={opener} type="button" onClick={() => setOpen(true)}>Open delete</button>
          <AssessmentDeleteDialog
            open={open}
            target={TARGET}
            confirming={false}
            error={null}
            opener={opener.current}
            onCancel={close}
            onConfirm={() => {}}
          />
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open delete' })
    // jsdom's fireEvent.click never focuses the button (Safari-like); the
    // explicit opener prop is what focus must return to.
    fireEvent.click(opener)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
    ;(document.activeElement as HTMLElement | null)?.blur()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(opener).toHaveFocus())
  })
})
