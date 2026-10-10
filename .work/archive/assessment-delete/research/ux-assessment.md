# UX assessment - assessment delete (impeccable, Operate mode)

Date: 2026-10-10. Surface: `/assessments` hub cards + confirm modal.
World: Marginalia preserved (cream paper, ink, rust destructive, mono eyebrows).
Incumbent truth: `AssessmentCard` (`LibraryCards.tsx:43`) renders title link,
meta, status tag, and only terminal-state actions (Retry / Start-new-run).
Roadmap `dir-detach` (`roadmap.css:811`) is the hover-X precedent; `ProgressLabModal`
(`ProgressLabModal.tsx:188` + `.css:6`) is the modal precedent; `.btn-destructive`
(`components.css:70`) is the destructive token precedent.

## Verdict

Ship a corner-X reveal plus a small centered confirm modal. No new visual
language, no overflow menu, no swipe gesture. The request maps 1:1 onto two
proven in-repo patterns, so novelty here would be cost with no user gain.

## Affordance decisions (and why)

1. **Corner X, card-relative, always in DOM.** Absolute top-right over the
   card (`position:absolute; top:8px; right:8px`), `opacity:0` resting,
   revealed on card `:hover`, `:focus-within`, and control `:focus-visible`.
   Always-mounted keeps touch and keyboard reachable; JS-hover state would
   strand both. Matches `dir-detach` exactly.
2. **Rust, not pure red.** `--rust: #A0432A` is the destructive token
   (`--status-behind`, `.btn-destructive`, `.tag-rust`). A 28px rust-filled
   circle with a paper `times` glyph reads destructive on cream without
   importing a foreign red. Hover darkens to `#8E4429` lineage; focus shows a
   2px ink outline (ProgressLabModal `:98` precedent).
3. **Hit target 28px visual, 44px on coarse pointers.** Design-system rule is
   44px on mobile (`components.css:87`), enforced with padding on coarse
   pointers, so the visual stays compact on desktop and the tap target grows
   only where a thumb does the tapping.
4. **One visible row action preserved.** The card body keeps its single-action
   rhythm (Retry / Start-new-run / Resume live below in
   `.material-card-actions`); the X rides the corner badge zone, never the
   action row, so `dir-detach`'s "one visible action" discipline holds.
5. **All card states deletable, copy varies.** Ready, generating, failed, and
   unavailable all show the X. Generating adds one modal line: deletion also
   drops the queued generation message (safe: worker archives orphans at
   `worker.py:333`). Failed keeps its Start-new-run secondary path; the modal
   offers `Keep + start new run` as the safe alternative, mirroring the card.
6. **Deleting state, not disappearance.** Confirm flips the card to
   `aria-busy` with inline dots (`GeneratingDots` precedent) and a disabled X
   plus `role="status"` text (`Deleting…`). The row only leaves on confirmed
   job success; failure restores the card with the typed error inline. Silent
   removal would lie about an async job.

## Modal decisions (and why)

1. **Small centered confirm, not full Lab shell.** `min(440px, 100%)` card on
   the standard overlay (`rgba(42,31,24,0.58)` + 4px blur,
   `ProgressLabModal.css:6`), `place-items:center`, `16px` safe-area padding.
   Same overlay, smaller shell: the brain reads it as the same app, lower
   stakes than the Lab.
2. **Title is the user's words:** `Confirm delete this assessment?` followed
   by one line naming the target (material title + family + date) and a
   3-item what-goes-away list (questions, attempts incl. local rows, cached
   envelope evicted; practice history referencing it becomes unavailable,
   never deleted). No jargon (`tombstone`, `cascade`, `RPC` stay in the plan).
3. **Destructive confirm is right-aligned, secondary-styled destructive, and
   never autofocused.** Initial focus lands on Cancel (or the dialog close);
   focus trap + Esc + backdrop-click cancel + opener restore follow
   `ProgressLabModal.tsx:188` line for line. Autofocusing Delete is the
   classic destructive-modal defect; the plan gates on it.
4. **No double-submit.** Confirm disables both buttons while the job is in
   flight and mints one `X-Request-ID` reused across the single retry (rule
   17). Second click cannot mint a second job.
5. **Phone is a sheet, desktop is a card.** Same markup; at 375px the shell
   goes full-width with 16px margins and stacked buttons (Delete on top,
   Cancel below, both 44px). No separate mobile component.

## What was deliberately skipped

- Overflow (`...`) menu: heavier than a one-action card needs; hides the
  destructive path behind discovery cost.
- Swipe-to-delete: undiscoverable on desktop, conflicts with grid scroll on
  touch, zero precedent in this codebase.
- Undo toast window: honest but doubles the state machine (tombstone +
  resurrect + worker race); the confirm modal already gates the irreversible
  step. Revisit only if user testing shows confirm remorse.
- New red, new modal shell, new button variant: all rejected; tokens and
  precedents above cover every pixel.

## A11y gate (must hold in impl)

- X has `aria-label="Delete <material title> assessment"` (not bare `X`).
- Modal is `role="dialog" aria-modal="true"` with labelledby/describedby,
  trap, Esc, backdrop-cancel, and focus restore to the invoking X.
- `prefers-reduced-motion` disables the opacity transition; contrast of
  paper-on-rust clears AA at 16px glyph size.
- Live region announces `Deleting…`, `Deleted`, and failure text.

## Viewport gate (must hold in impl)

- 1280px: X appears on card hover with zero layout shift (absolute, no reflow).
- 375px: X tappable at 44px, modal full-width sheet, actions unclipped with
  safe-area padding, zero console errors.
