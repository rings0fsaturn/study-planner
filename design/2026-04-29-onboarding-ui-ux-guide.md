<!--
  This is the UI/UX implementation guide for slice 4 (onboarding). It is the
  source of truth for layout, structure, and visual fidelity. It is a sibling
  document to the slice 4 implementation plan — the plan owns architecture,
  state, routing, events, and tests; this guide owns how the screens look and
  how layout/responsive structure is wired in TSX and CSS.
-->

# Onboarding Screens — UI/UX Implementation Guide (Slice 4)

> **You are the implementing agent.** This document is your runbook for fixing
> the visual layout, positions, and responsive structure of the onboarding
> screens in the Study Tracker app. It is not a build-from-scratch plan — it
> assumes the architecture from `2026-04-29-onboarding-with-manual-materials.md`
> (the implementation plan) is already in place. Read this preamble in full
> before touching code.

## What you're holding

A reference document, not a phased plan. It has four parts:

1. **Part 0 · Orientation** — three load-bearing divergences between
   `design/screens.html` and the implementation. Read this first or you will
   waste hours hunting for screens that don't exist.
2. **Part 1 · System primitives** — the layout shell, the responsive
   convention, the `onboarding.css` class taxonomy, the stepdot variants, the
   action-row variants. Fix these once and every per-screen section in Part 2
   composes them.
3. **Part 2 · Per-screen recipes** — one section per logical step. Each
   section has the same shape: design reference, primitives composed,
   screen-specific elements, complete TSX, mobile/desktop deltas.
4. **Part 3 · Fix-up checklist** — a literal walk-through against the current
   codebase. Use this to drive a fix-up pass.
5. **Appendix** — the complete `onboarding.css` file as a single drop-in.

## Your job

1. **Read Part 0 in full first.** The 4-step vs 5-step divergence and the
   mockup-only chrome callouts are non-negotiable. If you don't internalize
   them you will write screens that don't exist.
2. **Apply Part 1 before Part 2.** Per-screen recipes assume the layout shell
   and CSS classes from Part 1 are already in place. Implementing Part 2
   without Part 1 yields a broken layout.
3. **Apply Part 2 screen by screen.** Each section is independent once Part 1
   is done. Order: 2.1 → 2.2 → 2.3 → 2.4 → 2.5.
4. **Use the corrected TSX as written.** Code blocks in this guide are the
   actual code, not pseudocode. Where this guide's TSX differs from the
   current codebase, this guide wins and you replace the file content.
5. **Run Part 3's checklist when done.** It catches mistakes Part 1 and Part 2
   don't.

## What you must NOT do

- **Do not introduce new viewport-detection JS calls.** The only allowed JS
  read of viewport is `useMatchMedia('(min-width: 1024px)')` in
  `Step3Materials.tsx`. Every other responsive switch is CSS. Adding
  `window.matchMedia(...).matches` reads inline during render is the bug this
  guide exists to fix — see Part 1B.
- **Do not introduce CSS Modules, styled-components, or Tailwind.** The
  styling system is design-tokens globals + `apps/app/src/onboarding/onboarding.css`.
  Per Q2 of the planning discussion.
- **Do not add a 5th step or render 5 stepdots.** The implementation uses 4
  logical steps and 4 stepdots. The design file's "Step 5: Welcome" is the
  implementation's Step 4 confirm. See Part 0.
- **Do not render mobile status bars, phone bezels, or desktop browser chrome
  (URL bars, traffic-light dots).** These are mockup decoration in
  `design/screens.html` and never appear in the real app. See Part 0.
- **Do not add the YT/BK/ART material icon variants.** Slice 4 is manual-only
  — there is no kind distinction yet. Every material row uses the `BK`
  variant. The role→icon mapping arrives in slice 6 with URL paste.

## If reality doesn't match this guide

If a referenced file or class doesn't exist where the guide says it should,
**stop and surface to the human**. Don't improvise. The guide assumes the
state described in the implementation plan after Phase 3 is complete and
Phase 4 is partially complete.

---

## Files this guide touches

| Path | Change | Driven by |
|------|--------|-----------|
| `apps/app/src/onboarding/OnboardingLayout.tsx` | replace | Part 1A |
| `apps/app/src/lib/useMatchMedia.ts` | new | Part 1B |
| `apps/app/src/onboarding/onboarding.css` | replace | Part 1C + Appendix |
| `apps/app/src/onboarding/components/StepDots.tsx` | new | Part 1D |
| `apps/app/src/onboarding/steps/Step1Deadline.tsx` | replace | Part 2.1 |
| `apps/app/src/onboarding/steps/Step2Hours.tsx` | replace | Part 2.2 |
| `apps/app/src/onboarding/steps/Step3Materials.tsx` | replace | Part 2.3 |
| `apps/app/src/onboarding/components/MaterialRow.tsx` | modify | Part 2.3 |
| `apps/app/src/onboarding/steps/Step3Preview.tsx` | replace | Part 2.4 |
| `apps/app/src/onboarding/components/SchedulePreview.tsx` | modify | Part 2.4 |
| `apps/app/src/onboarding/steps/Step4Confirm.tsx` | replace | Part 2.5 |

Files this guide does **not** touch (architecture is settled by the impl plan
and unchanged):

- `OnboardingProvider.tsx`, `OnboardingGate.tsx`, `CheckpointGate.tsx`
- `App.tsx` route definitions
- The `EventStoreProvider` Dexie schema
- `MaterialRow.tsx` logic (only the icon hard-coding is touched)
- The progress-engine package
- Tests

---

# Part 0 · Orientation

Three things to internalize before reading anything else.

## 0.1 — 4 logical steps, 4 stepdots, NOT 5

`design/screens.html` Section B shows **5 mobile screens** with **5 stepdots**:

| Design file | Implementation |
|---|---|
| Step 1 of 5: Deadline | Step 1 of 4 → `/onboarding/1` |
| Step 2 of 5: Weekly hours | Step 2 of 4 → `/onboarding/2` |
| Step 3 of 5: Materials | Step 3 of 4 → `/onboarding/3` |
| Step 4 of 5: Preview | Step 3 of 4 → `/onboarding/3/preview` (mobile only; desktop renders inline) |
| Step 5 of 5: Welcome | Step 4 of 4 → `/onboarding/4` |

Why the collapse: on desktop, the design file shows materials and preview
**fused** as a single two-column screen (`screens.html` lines 1868–1985). The
implementation models this as one logical step (step 3) that renders
differently per viewport. Mobile keeps the user on `/onboarding/3` for the
form, and a sub-route `/onboarding/3/preview` for the preview screen. Both
keep the third stepdot active. So the dot count drops from 5 to 4 because
"Materials" and "Preview" are one logical step that happens to have a
mobile-only sub-route.

**On mobile preview screen, dot 3 stays active, NOT dot 4.** The user is
still on logical step 3, just on its sub-route.

**On desktop fused screen, only dot 3 is active.** The implementation does
not light up two dots simultaneously (the design file does, at
`screens.html:1883–1885`, where dot 3 and dot 4 are both `.active` — that
pattern was rejected during planning since the implementation has 4 dots, not
5).

## 0.2 — Status bars, phone chrome, desktop URL bars are mockup-only

In `screens.html`, every mobile screen sits inside a `.phone` element with a
`.phone-statusbar` (showing 9:41, signal, battery) and rounded corners. Every
desktop screen sits inside a `.desktop` element with a `.desktop-chrome`
(traffic-light dots and a URL bar showing `studytracker.app/study/onboarding`).

**These are presentation chrome for the design showcase only.** The real app
renders inside the user's browser; the OS provides the status bar, the
browser provides the URL. None of these elements are in the TSX or the CSS
that's shipped.

If you find yourself implementing a status bar or a URL bar in TSX, stop —
you've been confused by the design file.

## 0.3 — Some elements in `screens.html` are out of slice 4 scope

The design file shows a few things slice 4 does not implement:

- **PWA install banner on welcome screen** (`screens.html:1847–1859` mobile,
  `4340–4349` desktop). Out of scope; lands in slice 13. Don't render it.
- **YT/BK/ART material icons** keyed on material kind. Slice 4 is manual-only;
  every material is `BK`. The kind distinction arrives in slice 6.
- **URL paste input on materials step**. Disabled placeholder in slice 4;
  functional in slice 6.
- **First-up "Start now" / "Later" actions on welcome screen**. The buttons
  exist in the design (`screens.html:1841–1844`) but the active session screen
  they'd open lands in slice 5. In slice 4 the welcome screen has only
  "Go to home".
- **Capacity prompts (over/under capacity)** — these are introduced by the
  implementation plan but are not in the design file. They use the existing
  `.banner` and `.modal-overlay` primitives from the design tokens. See Part
  2.4.

Don't implement these; don't try to make screens in this guide visually
identical to the design file when they intentionally diverge.

---

# Part 1 · System primitives

Six subsections. Implement all six before starting Part 2. Each fixes a
specific class of bug in the current code.

## 1A · Layout shell

**Bug it fixes:** the current `OnboardingLayout` is `<div className="app">`
wrapping a div with `padding: 16px 20px; max-width: 640px; margin: 0 auto`.
This has no `min-height`, no flex column, and no per-shape variants. The
result: (a) the `<div style={{flex:1}}/>` spacers in step components don't
work because nothing above them is a flex column with growable height, so the
Continue buttons sit immediately under the form on mobile instead of pinning
to the bottom; (b) all four steps render with identical chrome, breaking the
three different stepdot positioning patterns the design specifies.

**Fix:** the layout shell becomes a min-height flex column with a
`data-shape` attribute that drives all desktop variants via CSS attribute
selectors. `column` for steps 1, 2, 4; `fused` for step 3.

**Replace the entire contents of `apps/app/src/onboarding/OnboardingLayout.tsx`
with:**

```tsx
import { Outlet, useLocation } from 'react-router-dom'
import { useOnboarding } from './OnboardingProvider'
import { StepDots } from './components/StepDots'
import './onboarding.css'

type LayoutShape = 'column' | 'fused'

interface RouteInfo {
  step: number
  shape: LayoutShape
}

function routeInfo(pathname: string): RouteInfo {
  if (pathname.includes('/onboarding/4')) return { step: 4, shape: 'column' }
  if (pathname.includes('/onboarding/3')) return { step: 3, shape: 'fused' }
  if (pathname.includes('/onboarding/2')) return { step: 2, shape: 'column' }
  return { step: 1, shape: 'column' }
}

export function OnboardingLayout() {
  const location = useLocation()
  const { step, shape } = routeInfo(location.pathname)
  const { state } = useOnboarding()

  return (
    <div className="onboarding-shell" data-shape={shape}>
      <div className="onboarding-stepdots-wrap">
        <StepDots currentStep={step} reachedStep={state.stepReached} totalSteps={4} />
        <div className="mono-caps onboarding-mobile-caption">Step {step} of 4</div>
        {shape === 'fused' && (
          <div className="mono-caps onboarding-desktop-caption">Materials &amp; preview</div>
        )}
      </div>
      <main className="onboarding-content">
        <Outlet />
      </main>
    </div>
  )
}
```

**Why every line matters:**

- `data-shape={shape}` — drives all desktop CSS variants via attribute
  selectors. The CSS in Part 1C reads this. No JS-driven layout.
- The stepdots wrap is a sibling of `.onboarding-content`, not a child. This
  lets the column shape center stepdots above a separately-centered content
  column without coupling their max-widths.
- `<main className="onboarding-content">` has `flex: 1` set by CSS, which
  combined with `display: flex; flex-direction: column` on the inner
  `.onboarding-step` (Part 2 step components) makes `<div
  className="onboarding-spacer" />` actually push the action row to the
  bottom on mobile.
- Both captions are rendered always; CSS picks which is visible. This avoids
  a JS branch on viewport.
- The conditional rendering of the "Materials & preview" desktop caption is
  fine — it's not a viewport read, it's a route-shape read. Always safe to
  determine at render.

**Do not modify `App.tsx`.** The route definitions stay as in the
implementation plan: nested route group at `/onboarding`, child routes 1–4,
mobile preview as `/onboarding/3/preview`. The shell doesn't change them.

## 1B · Responsive convention and the `useMatchMedia` hook

**Convention:** the entire onboarding flow uses a single breakpoint at
**1024px**. Anything ≥1024px is desktop. Layout switching at this breakpoint
happens in **CSS only**. The only allowed JS read of viewport is the
`useMatchMedia` hook below, used in **exactly one place**: `Step3Materials.tsx`,
to decide which navigation handler to wire to the primary action button.

**Why this convention exists:** the current code reads
`window.matchMedia('(min-width: 1024px)').matches` inline during render in
both `Step3Materials.tsx` and `Step3Preview.tsx`. This is broken in two ways:
(1) it doesn't react to window resize, so resizing across the breakpoint
leaves the component in a stale state until next re-render from another
cause; (2) it creates two parallel responsive systems (CSS for steps 1/2/4,
JS for step 3) which is a debugging nightmare.

The fix is uniform: CSS handles all layout, the hook handles the one
interaction-decision case where TSX genuinely needs to know which button to
wire.

**Create `apps/app/src/lib/useMatchMedia.ts`:**

```ts
import { useEffect, useState } from 'react'

/**
 * Reactive matchMedia hook. Returns true if the media query currently matches,
 * and re-renders the component when the match state changes (e.g. on window
 * resize across the breakpoint).
 *
 * USAGE POLICY: this hook may be called only when TSX genuinely needs to
 * branch on viewport — currently only Step3Materials.tsx for the primary
 * action button choice. Layout switching is CSS-only and must not call this.
 *
 * Initial value is computed synchronously in the lazy initializer so the
 * first render matches the actual viewport. SSR-safe (returns false in
 * environments without `window`).
 */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    // Re-sync in case the query changed or the initial value was stale
    setMatches(mql.matches)

    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    } else {
      // Older Safari fallback (≤ 13)
      mql.addListener(handler)
      return () => mql.removeListener(handler)
    }
  }, [query])

  return matches
}
```

**Where it's allowed to be imported:**

- `apps/app/src/onboarding/steps/Step3Materials.tsx` — only.

**Where it must NOT be imported:**

- `OnboardingLayout.tsx` — uses `data-shape` attribute + CSS.
- `Step1Deadline.tsx`, `Step2Hours.tsx`, `Step4Confirm.tsx` — pure CSS.
- `Step3Preview.tsx` — renders both layouts in TSX, CSS hides what's not
  needed. (Reasoning: the mobile preview is rendered standalone via
  sub-route; the desktop preview is rendered into the parent's outlet. The
  same component handles both. Stat blocks and the lead paragraph that
  appear only on mobile use CSS visibility, not JS branching.)
- Any component that doesn't currently exist — if a future component thinks
  it needs viewport detection, the answer is almost always CSS instead.

**Existing inline `window.matchMedia(...)` reads to remove:**

- `Step3Materials.tsx` line ~1490 in current code: `const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches` — replace with `const isDesktop = useMatchMedia('(min-width: 1024px)')`. See Part 2.3.
- `Step3Preview.tsx` line ~2047 in current code: identical line — delete entirely. The component renders both mobile and desktop layouts in TSX; CSS hides the irrelevant one. See Part 2.4.

End of chunk 1.

## 1C · The `onboarding.css` class taxonomy

**Bug it fixes:** the current step components carry inline `style={{}}` props
on nearly every element, including patterns that repeat across all four
steps (the italic terracotta `<em>`, the bottom action row, the spacer, the
heading sizes that should differ per shape). This makes per-screen TSX
unreadable and means visual tweaks require touching every step file.

**Fix:** lift all repeating patterns into named classes in
`apps/app/src/onboarding/onboarding.css`. The full CSS file is in the
Appendix; this section explains what each class is for and where it's used.

| Class | Purpose | Used by |
|---|---|---|
| `.onboarding-shell` | Outer min-height flex column wrapper | `OnboardingLayout` |
| `.onboarding-content` | Inner flex column that grows to fill the shell, max-width 640 mobile | `OnboardingLayout` |
| `.onboarding-stepdots-wrap` | The flex row holding stepdots + caption | `OnboardingLayout` |
| `.onboarding-mobile-caption` | The "Step N of 4" caption | `OnboardingLayout` |
| `.onboarding-desktop-caption` | The "Materials & preview" caption (step 3 desktop only) | `OnboardingLayout` |
| `.onboarding-step` | Per-step content holder, `flex: 1` so the spacer works | All step components |
| `.onboarding-h1` | Display-typeface heading; size differs by shape | All step components |
| `.onboarding-h1 em` | Selector for the italic terracotta accent inside the heading | All step components |
| `.onboarding-lead` | Lead paragraph below the heading | All step components |
| `.onboarding-spacer` | `flex: 1` spacer pushing the action row to bottom on mobile | Step 1, 2, 3 form, 4 |
| `.onboarding-actions` | Bottom row of buttons (back + primary, or primary alone) | All step components |
| `.onboarding-success-check` | The 56px moss-tinted circle on Step 4 confirm | Step 4 |
| `.onboarding-materials-grid` | Step 3 desktop two-column grid; `display: contents` on mobile | `Step3Materials` |
| `.onboarding-materials-form` | Left column of step 3 desktop grid, full width on mobile | `Step3Materials` |
| `.onboarding-materials-preview-slot` | Right column of step 3 desktop grid, hidden on mobile | `Step3Materials` |
| `.onboarding-preview-mobile-only` | Stat blocks + lead paragraph that appear only on mobile preview | `Step3Preview` |
| `.onboarding-preview-desktop-only` | Stat blocks + label that appear only on desktop preview | `Step3Preview` |

**The italic terracotta accent — IMPORTANT.** Across the four steps, this
pattern appears 4 times in the current code:

```tsx
<em style={{ fontStyle: 'italic', color: 'var(--terracotta)', fontWeight: 400 }}>done</em>
```

In the corrected code, write:

```tsx
<em>done</em>
```

The `.onboarding-h1 em` selector handles styling. **Do not write the inline
style.** If you find yourself repeating it, you've forgotten to use the
class.

**The flex-spacer pattern — IMPORTANT.** Across steps 1, 2, 3-form, the
current code has:

```tsx
<div style={{ flex: 1 }} />
<button className="btn btn-primary btn-lg btn-block">Continue</button>
```

This currently does nothing because no parent is a flex column with growable
height. After Part 1A's layout shell and the `.onboarding-step` class
(which wraps each step's body in `display: flex; flex-direction: column;
flex: 1`), the spacer works. In the corrected code, write:

```tsx
<div className="onboarding-spacer" />
```

Not `style={{flex:1}}`. The class makes the intent obvious and lets us tune
behavior in one place (e.g. on desktop column shape, the spacer is a no-op
since content is centered, not bottom-aligned).

**Where inline `style={{}}` is still allowed:** narrow per-element tweaks
that don't repeat across steps. Examples:

- A single `marginBottom: 12` on one specific field group between two other
  field groups whose spacing is governed by `.field-group`'s own margin —
  inline. (Or better, a one-off helper class.)
- Dynamic computed values: `style={{ width: \`${pct}%\` }}` — inline.
- A `<span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>`
  inside a label — inline (it's a single nested span).

**Where inline `style={{}}` must be removed:** every pattern in the table
above, anything that appears on more than one step, anything resembling
layout (display, flex, grid, padding, max-width, alignment).

## 1D · The StepDots component

**Bug it fixes:** the current `OnboardingLayout` inlines stepdot rendering
with the dot-class logic spread across a single template literal that's hard
to read and gets the active/done state slightly wrong. (Specifically, the
template `${n < step || (n === step && state.stepReached >= n) ? 'done' : ''}`
makes the current dot also `done`, which is correct for visual continuity but
means the `.active` class always applies on top of `.done`. The component
extracts this so the logic is testable and reusable.)

**Create `apps/app/src/onboarding/components/StepDots.tsx`:**

```tsx
interface StepDotsProps {
  currentStep: number
  reachedStep: number
  totalSteps: number
}

export function StepDots({ currentStep, reachedStep, totalSteps }: StepDotsProps) {
  return (
    <div className="stepdots">
      {Array.from({ length: totalSteps }, (_, i) => {
        const n = i + 1
        const isDone = n < currentStep
        const isReached = n <= reachedStep
        const isActive = n === currentStep
        const classes = ['stepdot']
        if (isDone || (isActive && isReached)) classes.push('done')
        if (isActive) classes.push('active')
        return <div key={n} className={classes.join(' ')} />
      })}
    </div>
  )
}
```

**Behavior:**

- A dot for a step the user is past (`n < currentStep`) is `.done`.
- The dot for the current step (`n === currentStep`) is `.active`. If the
  user has previously reached this step (`reachedStep >= n`), it is also
  `.done` — this gives the visual continuity of a filled dot the user has
  earned, with the active ring on top.
- A dot for a step the user has not reached (`n > currentStep` and
  `n > reachedStep`) gets neither class — empty.

The `.stepdots`, `.stepdot`, `.stepdot.done`, `.stepdot.active` CSS classes
already exist in `packages/design-tokens/src/components.css` (extracted from
`design/screens.html` lines 751–755 per impl plan D-15).

**Positioning is governed by Part 1A's `.onboarding-stepdots-wrap` and the
`data-shape` CSS variants in Part 1C / the Appendix. The StepDots component
itself doesn't know about positioning.**

## 1E · The bottom action row

**Bug it fixes:** the current code has three different ad-hoc patterns for
the bottom action row across the four steps — Step 1 uses
`<button className="btn btn-primary btn-lg btn-block">Continue</button>`
directly, Step 2 and Step 3 wrap a back-icon button + Continue button in a
`<div className="row" style={{ gap: 8 }}>`, Step 4 confirm has a different
shape entirely. They should compose a single primitive.

**Convention:** every step's bottom buttons live inside an
`<div className="onboarding-actions">`. The contents differ per step:

- **Step 1**: just a primary "Continue" button. No back button (nothing to
  go back to).
- **Steps 2, 3-form, 3-preview, 4 (where applicable)**: a small back-icon
  button on the left, primary Continue on the right with `flex: 1`.
- **Step 4 confirm**: a primary "Go to home" button. Architecture is similar
  to Step 1 but the confirm screen also has the inverted card containing its
  own internal action — both live in `.onboarding-step` body, not in
  `.onboarding-actions`.

**The mobile vs desktop deltas:**

| | Mobile | Desktop column (steps 1, 2, 4) | Desktop fused (step 3) |
|---|---|---|---|
| Layout | back-icon + primary fills row | back-icon left, primary right, no `flex: 1` | back-icon left, primary right, no `flex: 1` |
| Button text | "Continue" | "Continue" (kept identical to mobile — see note) | "Looks good — let's start" or per-step text |
| Primary button width | `flex: 1` | hugs content | hugs content |

**Note on button text deviation:** `screens.html` K3/K4 desktop variants
show buttons labeled "Next · weekly hours" and "Next · materials". This
implementation keeps the text "Continue" on every step regardless of
viewport. The "Next · X" pattern is a nice-to-have but adds responsive text
branching that would require either CSS pseudo-content tricks or a JS
viewport read. We chose simpler. If a future revision wants the longer text,
it can be added with a `::after` pseudo-element on a `data-next-step` data
attribute — but not in slice 4.

**The TSX shape every step uses:**

```tsx
<div className="onboarding-actions">
  {/* Optional back button — omit on step 1 */}
  <button className="btn btn-secondary onboarding-back-btn" onClick={handleBack}>
    <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
  </button>
  <button
    className="btn btn-primary btn-lg onboarding-continue-btn"
    onClick={handleContinue}
    disabled={!canContinue}
  >
    Continue
    <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  </button>
</div>
```

CSS in the Appendix handles:

- `.onboarding-actions { display: flex; gap: 8px; margin-top: 24px; }`
- `.onboarding-back-btn { flex-shrink: 0; }`
- `.onboarding-continue-btn { flex: 1; }` on mobile
- On desktop column shape, the row uses `justify-content: space-between`
  and the primary button drops `flex: 1` so it hugs content.

## 1F · Material list — icon variants deferred

**Bug it fixes:** the current `MaterialRow.tsx` hard-codes the icon to `BK`
on every material, even though `components.css` defines `.material-icon.yt`
and `.material-icon.art` variants. Slice 4 is correct to use only `BK` — see
below — but the guide should call out that this is deliberate, not an
oversight to "fix."

**The deliberate hold:** the `.material-icon.yt` (YouTube) and
`.material-icon.art` (article) variants in
`packages/design-tokens/src/components.css` represent material **kind**
(video vs book vs article), not role (anchor vs foundation vs practice).

Slice 4 introduces only manual materials. There is no kind distinction in
slice 4 — the user types a title and an estimated duration, and that's the
material. The kind distinction arrives in slice 6 when URL paste introduces
the metadata fetch that returns YouTube vs article identification.

**Therefore, in slice 4: every material row uses the `BK` icon.** Do not add
logic to map role → icon. Do not introduce a `kind` field on the material
model. Both are slice 6 work.

**One small fix to `MaterialRow.tsx`:** the hard-coded `<div className="material-icon bk">BK</div>`
is correct, but make sure the `BK` text content matches the design — it's
the bare two-letter abbreviation, no emoji, no SVG. The current
implementation already does this; it's listed here only so the fix-up
checklist (Part 3) can verify it.


---

# Part 2 · Per-screen recipes

Each section follows the same shape:

1. **Reference** — line ranges in `design/screens.html`.
2. **Composition** — which Part 1 primitives are used.
3. **Screen-specific elements** — anything that doesn't fit a Part 1
   primitive.
4. **Corrected TSX** — complete file content. Replace the existing file
   entirely.
5. **Mobile vs desktop deltas** — what differs and how it's expressed.

## 2.1 · Step 1: Deadline

### Reference

- Mobile: `design/screens.html` lines 1449–1500
- Desktop column shell: `design/screens.html` lines 4222–4263

### Composition

- Layout shell from Part 1A wraps everything (`.onboarding-shell[data-shape="column"]`).
- Heading uses `.onboarding-h1` with `<em>` for "done".
- Lead uses `.onboarding-lead`.
- Action row uses `.onboarding-actions` with a single Continue button (no
  back button — nothing to go back to from step 1).
- `.onboarding-spacer` between the last field and the action row pushes the
  button to the bottom on mobile.

### Screen-specific elements

- A `<input type="date">` with the existing `.field` styling.
- A `.chip-row` of five date chips ("In 2 weeks" through "In 6 months").
- A second `.field-group` for an optional purpose field.

### Corrected TSX

**Replace the entire contents of `apps/app/src/onboarding/steps/Step1Deadline.tsx`
with:**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startOfToday, addWeeks, addMonths, format, isBefore } from 'date-fns'
import { useOnboarding } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'

const TODAY = startOfToday()
const TODAY_ISO = format(TODAY, 'yyyy-MM-dd')

const CHIPS = [
  { label: 'In 2 weeks', getDate: () => format(addWeeks(TODAY, 2), 'yyyy-MM-dd') },
  { label: 'In 1 month',  getDate: () => format(addMonths(TODAY, 1), 'yyyy-MM-dd') },
  { label: 'In 2 months', getDate: () => format(addMonths(TODAY, 2), 'yyyy-MM-dd') },
  { label: 'In 3 months', getDate: () => format(addMonths(TODAY, 3), 'yyyy-MM-dd') },
  { label: 'In 6 months', getDate: () => format(addMonths(TODAY, 6), 'yyyy-MM-dd') },
]

export function Step1Deadline() {
  const { state, dispatch } = useOnboarding()
  const navigate = useNavigate()
  const [deadline, setDeadline] = useState(state.deadline ?? '')
  const [purpose, setPurpose] = useState(state.purpose ?? '')
  const [selectedChip, setSelectedChip] = useState<string | null>(null)

  const handleChipClick = (chip: typeof CHIPS[number]) => {
    setDeadline(chip.getDate())
    setSelectedChip(chip.label)
  }

  const handleContinue = () => {
    if (!deadline || isBefore(deadline, TODAY_ISO)) return
    dispatch({ type: 'SET_DEADLINE', deadline, purpose })
    dispatch({ type: 'SET_STEP_REACHED', step: 1 })
    navigate('/onboarding/2')
  }

  return (
    <CheckpointGate step={1}>
      <div className="onboarding-step">
        <h1 className="onboarding-h1">
          When do you need to be <em>done</em>?
        </h1>
        <p className="onboarding-lead">
          A real date or a rough one — we'll work backwards from it.
        </p>

        <div className="field-group">
          <label className="field-label">Target date</label>
          <input
            className="field"
            type="date"
            min={TODAY_ISO}
            value={deadline}
            onChange={e => { setDeadline(e.target.value); setSelectedChip(null) }}
          />
        </div>

        <div className="chip-row">
          {CHIPS.map(chip => (
            <button
              key={chip.label}
              className={`chip ${selectedChip === chip.label ? 'selected' : ''}`}
              onClick={() => handleChipClick(chip)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="field-group">
          <label className="field-label">
            What are you preparing for?{' '}
            <span style={{ color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-body)' }}>
              (optional)
            </span>
          </label>
          <input
            className="field"
            type="text"
            placeholder="e.g. System design interview"
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
          />
        </div>

        <div className="onboarding-spacer" />

        <div className="onboarding-actions">
          <button
            className="btn btn-primary btn-lg onboarding-continue-btn"
            onClick={handleContinue}
            disabled={!deadline}
          >
            Continue
            <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </CheckpointGate>
  )
}
```

### Mobile vs desktop deltas

| Aspect | Mobile | Desktop column |
|---|---|---|
| Heading size | 22–24px | 36px |
| Content alignment | Left | Centered (`text-align: center`) |
| Stepdots | Top-row, "Step 1 of 4" caption right | Centered above, no caption |
| Continue button | Full-width (`flex: 1` from `.onboarding-continue-btn`) | Hugs content, right-aligned |
| Spacer | Pushes button to bottom of viewport | No-op (content centered vertically) |

All of these deltas are expressed in CSS via the
`.onboarding-shell[data-shape="column"]` selector chain. **No JS viewport
reads.** No conditional rendering on `isDesktop`.

### What changed from the current code

- The single inline `<em style={{ fontStyle: 'italic', color: 'var(--terracotta)', fontWeight: 400 }}>`
  becomes plain `<em>`. CSS handles styling via `.onboarding-h1 em`.
- The bare `<div style={{ flex: 1 }} />` becomes `<div className="onboarding-spacer" />`.
- The bare top-level `<div>` becomes `<div className="onboarding-step">`.
- The standalone Continue button becomes wrapped in `<div className="onboarding-actions">`
  for layout consistency with steps 2/3 and to give the action row a single
  named primitive to style.
- All inline `style={{ marginBottom: ... }}` props on field groups and chip
  rows are removed — `.field-group` and `.chip-row` already have correct
  default margin-bottom from the design tokens; the design's exact 12px /
  24px / 32px rhythm will come from a uniform 24px default with one-off
  inline `marginBottom` only where the rhythm genuinely differs (none in
  this step).
- The `<h2 className="screen-h1">` becomes `<h1 className="onboarding-h1">`.
  The element is the page's primary heading; using `<h1>` is correct
  semantics. The class change is the load-bearing fix — `.screen-h1` is the
  generic primitive, `.onboarding-h1` is the onboarding-specific size variant.

---

## 2.2 · Step 2: Weekly hours and study days

### Reference

- Mobile: `design/screens.html` lines 1502–1565
- Desktop column shell: `design/screens.html` lines 4265–4304

### Composition

- Layout shell from Part 1A (`.onboarding-shell[data-shape="column"]`).
- Heading + lead from Part 1C.
- Action row from Part 1E (back-icon + Continue).

### Screen-specific elements

- A centered "big number" hours display showing the currently-selected
  weekly total.
- A `.chip-row` of preset hour values (2, 4, 6, 8, 10, 15, 20+).
- A two-column grid splitting the total into weekday and weekend hours, with
  validation that they sum to the total.
- A `.field-helper.error` shown when the split doesn't sum.
- A `.chip-row` of 7 day-of-week chips for picking study days.

### Corrected TSX

**Replace the entire contents of `apps/app/src/onboarding/steps/Step2Hours.tsx`
with:**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DayOfWeek } from '@study-tracker/progress-engine'
import { useOnboarding } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'

const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOUR_CHIPS = [2, 4, 6, 8, 10, 15, 20]

export function Step2Hours() {
  const { state, dispatch } = useOnboarding()
  const navigate = useNavigate()
  const [weeklyHours, setWeeklyHours] = useState(state.weeklyHours || 0)
  const [weekdayHours, setWeekdayHours] = useState(state.weekdayHours || 0)
  const [weekendHours, setWeekendHours] = useState(state.weekendHours || 0)
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(state.selectedStudyDays)
  const [selectedChip, setSelectedChip] = useState<number | null>(null)

  const hoursMatch = weekdayHours + weekendHours === weeklyHours
  const canContinue = weeklyHours > 0 && selectedDays.length > 0 && hoursMatch

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleChipClick = (h: number) => {
    setWeeklyHours(h)
    setSelectedChip(h)
    const wd = Math.round(h * 0.6)
    setWeekdayHours(wd)
    setWeekendHours(h - wd)
  }

  const handleBack = () => navigate('/onboarding/1')
  const handleContinue = () => {
    if (!canContinue) return
    dispatch({
      type: 'SET_HOURS',
      weeklyHours,
      weekdayHours,
      weekendHours,
      selectedStudyDays: selectedDays,
    })
    dispatch({ type: 'SET_STEP_REACHED', step: 2 })
    navigate('/onboarding/3')
  }

  return (
    <CheckpointGate step={2}>
      <div className="onboarding-step">
        <h1 className="onboarding-h1">
          How many <em>hours</em> a week?
        </h1>
        <p className="onboarding-lead">
          Be honest. We'd rather underestimate and let you exceed than the other way.
        </p>

        <div className="onboarding-hours-display">
          <span className="onboarding-hours-number">{weeklyHours}</span>
          <span className="onboarding-hours-suffix">h / wk</span>
          <div className="mono-caps onboarding-hours-sublabel">
            {weeklyHours > 0
              ? `≈ ${Math.floor((weeklyHours * 60) / 7 / 60)}h ${Math.round((weeklyHours * 60) / 7 % 60)}m a day`
              : 'Pick a starting point'}
          </div>
        </div>

        <div className="chip-row" style={{ justifyContent: 'center' }}>
          {HOUR_CHIPS.map(h => (
            <button
              key={h}
              className={`chip ${selectedChip === h ? 'selected' : ''}`}
              onClick={() => handleChipClick(h)}
            >
              {h}h{h === 20 ? '+' : ''}
            </button>
          ))}
        </div>

        <div className="onboarding-hours-split">
          <div className="field-group">
            <label className="field-label">Weekday hours</label>
            <input
              className="field"
              type="number"
              min={0}
              value={weekdayHours}
              onChange={e => { setWeekdayHours(Number(e.target.value)); setSelectedChip(null) }}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Weekend hours</label>
            <input
              className="field"
              type="number"
              min={0}
              value={weekendHours}
              onChange={e => { setWeekendHours(Number(e.target.value)); setSelectedChip(null) }}
            />
          </div>
        </div>

        {!hoursMatch && weeklyHours > 0 && (
          <div className="field-helper error">
            Weekday + weekend must equal {weeklyHours}h total. Currently {weekdayHours + weekendHours}h.
          </div>
        )}

        <div className="field-group">
          <label className="field-label">Study days</label>
          <div className="chip-row">
            {DAYS_OF_WEEK.map(day => (
              <button
                key={day}
                className={`chip ${selectedDays.includes(day) ? 'selected' : ''}`}
                onClick={() => toggleDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="onboarding-spacer" />

        <div className="onboarding-actions">
          <button className="btn btn-secondary onboarding-back-btn" onClick={handleBack} aria-label="Back">
            <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
          </button>
          <button
            className="btn btn-primary btn-lg onboarding-continue-btn"
            onClick={handleContinue}
            disabled={!canContinue}
          >
            Continue
            <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </CheckpointGate>
  )
}
```

### Mobile vs desktop deltas

| Aspect | Mobile | Desktop column |
|---|---|---|
| Hours number size | 56px (`.onboarding-hours-number` mobile rule) | 88px (`@media min-width: 1024px` rule) |
| Hours number `font-variation-settings` | `'opsz' 96` | `'opsz' 144` |
| Content alignment | Left | Centered |
| Sublabel | "≈ 1h 10m per day" mono-caps | Same text, slightly larger |
| Action row | back-icon + Continue, Continue takes `flex: 1` | back + Continue side-by-side, no `flex: 1`, `justify-content: space-between` |

All deltas are CSS via `.onboarding-shell[data-shape="column"]`. The
`.onboarding-hours-display`, `.onboarding-hours-number`,
`.onboarding-hours-suffix`, `.onboarding-hours-sublabel`, and
`.onboarding-hours-split` classes are step-2-specific — added to
`onboarding.css` (see Appendix). They are listed in 1C's table only for
completeness; their CSS lives in the Appendix, not duplicated here.

### What changed from the current code

- The big stat-value block went from inline `style={{ textAlign: 'center', margin: '24px 0 32px' }}`
  with a `.stat-value lg` and `.stat-label` to a dedicated
  `.onboarding-hours-display` block with three child classes that handle the
  responsive size jump. The desktop variant matches K4 (88px display) which
  the current code does not implement at all.
- The weekday/weekend grid went from inline
  `style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}` to
  the named class `.onboarding-hours-split`.
- The italic terracotta `<em>` is plain `<em>` — see Step 1's notes.
- The flex spacer is now `<div className="onboarding-spacer" />` and
  actually works because of the layout shell fix.
- Action row uses the named primitives `.onboarding-back-btn` and
  `.onboarding-continue-btn`. The back button gets `aria-label="Back"` which
  the current code is missing.
- Per-day chips use the existing `.chip` class, not custom button styling.
- Removed inline `style={{ marginBottom: ... }}` everywhere; the named
  classes handle vertical rhythm.


---

## 2.3 · Step 3: Materials (form view + desktop fusion)

### Reference

- Mobile form: `design/screens.html` lines 1567–1653
- Desktop fused (form + preview side by side): `design/screens.html` lines 1868–1985

### Composition

- Layout shell from Part 1A (`.onboarding-shell[data-shape="fused"]`).
- Heading + lead from Part 1C.
- Action row from Part 1E (back + "Build my plan" on mobile; back-only on desktop because the preview column has its own commit action — see deviations below).
- The desktop two-column grid uses three new classes: `.onboarding-materials-grid` (the grid container), `.onboarding-materials-form` (left column), `.onboarding-materials-preview-slot` (right column).
- The `useMatchMedia` hook (Part 1B) is allowed to be called here, exactly once. This is the single legitimate viewport-detection JS read in the entire app.

### Screen-specific elements

- A `.field-group` with a disabled URL input and helper text ("URL paste is coming soon — add materials manually below"). The URL input is intentionally disabled until slice 6 lands; do not enable it in slice 4.
- An "Add manually" button that appends a blank material row to the draft state.
- A material-count line: "{n} added · ~Xh Ym".
- A `.material-list` rendering one `<MaterialRow>` per draft material.
- On desktop, a right-column slot with the label "Live preview · updates as you add" and an embedded `<Step3Preview />`.

### Important deviations from `screens.html`

`design/screens.html` lines 1934–1939 shows the desktop fused screen with a single action row at the bottom of the **left column**, containing Back + "Looks good — let's start". Implementing this exactly would require lifting the entire commit logic and roadmap-state ownership from `Step3Preview` up to `Step3Materials` (because the commit button needs `displayRoadmap`, `capacityCheck`, `unresolvedTieCount`, etc., all currently owned by `Step3Preview`).

**This guide takes the simpler path:** on desktop fused, the form column has only a Back button at its bottom, and the preview column has its own action row (Looks good only) at the bottom of the right column. The user has one Back and one commit, just in different columns.

This is a deliberate divergence from the design file. The user accepts it. If a future revision wants the screens.html-exact action-row layout, that's a state-lifting refactor in a separate slice, not slice 4 work.

The CSS hides the form's "Build my plan" button on desktop (since there's nothing to navigate to), keeping only the Back button visible in the form column action row.

### Corrected TSX

**Replace the entire contents of `apps/app/src/onboarding/steps/Step3Materials.tsx`
with:**

```tsx
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useOnboarding, type OnboardingMaterial } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'
import { MaterialRow } from '../components/MaterialRow'
import { Step3Preview } from './Step3Preview'
import { useMatchMedia } from '../../lib/useMatchMedia'

export function Step3Materials() {
  const { state, dispatch } = useOnboarding()
  const navigate = useNavigate()
  const location = useLocation()
  // The single legitimate JS viewport read in the codebase. Decides composition,
  // not layout — layout is CSS via data-shape on the shell.
  const isDesktop = useMatchMedia('(min-width: 1024px)')
  const isPreviewRoute = location.pathname.includes('/preview')

  const handleAdd = () => {
    dispatch({
      type: 'ADD_MATERIAL',
      material: {
        id: crypto.randomUUID(),
        title: '',
        estimatedDuration: 0,
        role: 'foundation',
        url: undefined,
        additionOrder: state.materials.length,
        userOverrodeType: false,
      },
    })
  }
  const handleUpdate = (id: string, updates: Partial<OnboardingMaterial>) =>
    dispatch({ type: 'UPDATE_MATERIAL', id, updates })
  const handleRemove = (id: string) => dispatch({ type: 'REMOVE_MATERIAL', id })
  const handleBack = () => navigate('/onboarding/2')
  const handleBuildPlan = () => {
    dispatch({ type: 'SET_STEP_REACHED', step: 3 })
    navigate('/onboarding/3/preview')
  }

  const materialsWithTitle = state.materials.filter(m => m.title && m.estimatedDuration > 0)
  const totalMinutes = materialsWithTitle.reduce((s, m) => s + m.estimatedDuration, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalMinsRemainder = totalMinutes % 60

  const formMarkup = (
    <>
      <h1 className="onboarding-h1">
        What are you <em>studying</em>?
      </h1>
      <p className="onboarding-lead">Paste links, or add things by hand.</p>

      <div className="field-group">
        <label className="field-label">Paste a URL</label>
        <input className="field" type="url" placeholder="youtube.com/… or any article link" disabled />
        <div className="field-helper">URL paste is coming soon — add materials manually below.</div>
      </div>

      <button className="btn btn-secondary btn-sm onboarding-add-manually-btn" onClick={handleAdd}>
        <svg className="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add manually
      </button>

      {state.materials.length > 0 && (
        <>
          <div className="mono-caps onboarding-materials-count">
            {materialsWithTitle.length} added · ~{totalHours}h {totalMinsRemainder}m
          </div>
          <div className="material-list">
            {state.materials.map(mat => (
              <MaterialRow
                key={mat.id}
                material={mat}
                existingMaterials={state.materials}
                onUpdate={updates => handleUpdate(mat.id, updates)}
                onRemove={() => handleRemove(mat.id)}
              />
            ))}
          </div>
        </>
      )}

      <div className="onboarding-spacer" />

      <div className="onboarding-actions">
        <button className="btn btn-secondary onboarding-back-btn" onClick={handleBack} aria-label="Back">
          <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
        </button>
        {/* Mobile only: navigates to the preview sub-route. CSS hides on desktop. */}
        <button
          className="btn btn-primary btn-lg onboarding-continue-btn onboarding-form-build-btn"
          onClick={handleBuildPlan}
          disabled={materialsWithTitle.length === 0}
        >
          Build my plan
          <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </>
  )

  // Desktop: fused two-column. Form on left, Step3Preview on right (rendered
  // directly, not via Outlet — the route's <Outlet /> would only fire at
  // /3/preview, but on desktop we want the preview to show at /3 too).
  if (isDesktop) {
    return (
      <CheckpointGate step={3}>
        <div className="onboarding-step onboarding-materials-grid">
          <div className="onboarding-materials-form">{formMarkup}</div>
          <div className="onboarding-materials-preview-slot">
            <div className="mono-caps onboarding-materials-preview-label">Live preview · updates as you add</div>
            <Step3Preview />
          </div>
        </div>
      </CheckpointGate>
    )
  }

  // Mobile: form OR preview, never both. The preview is rendered into <Outlet />
  // when the route is /3/preview.
  return (
    <CheckpointGate step={3}>
      {isPreviewRoute ? <Outlet /> : <div className="onboarding-step">{formMarkup}</div>}
    </CheckpointGate>
  )
}
```

### MaterialRow — small fix

`apps/app/src/onboarding/components/MaterialRow.tsx` already exists from Phase 4. **Verify** it has the hard-coded `<div className="material-icon bk">BK</div>`, not a role-based icon picker. If the current code introduced role→icon logic, remove it and revert to `BK` per Part 1F.

The MaterialRow itself doesn't need other layout changes for this guide — the input fields and remove-button layout are correct.

### Mobile vs desktop deltas

| Aspect | Mobile (`/onboarding/3`) | Mobile (`/onboarding/3/preview`) | Desktop (`/onboarding/3`) |
|---|---|---|---|
| Component rendered | `Step3Materials` form view | `Step3Materials` outlet view | `Step3Materials` two-column |
| Form visible | Yes | No | Yes (left column) |
| Preview visible | No | Yes (Step3Preview via Outlet) | Yes (Step3Preview direct) |
| Form action row | Back + "Build my plan" | n/a | Back only ("Build my plan" hidden by CSS) |
| Preview action row | n/a | Back + "Looks good" | Looks good only (Back hidden by CSS — see Part 2.4) |
| Stepdots caption | "Step 3 of 4" (mobile-caption visible) | "Step 3 of 4" | "Materials & preview" (desktop-caption visible) |
| Stepdot 3 active | Yes | Yes | Yes |

### What changed from the current code

- `const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches`
  becomes `const isDesktop = useMatchMedia('(min-width: 1024px)')`. Reactive on resize.
- The desktop branch's inline-style grid (`style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}`)
  becomes the named class `.onboarding-materials-grid`.
- The right column on desktop currently renders `<Outlet />`. Replace with `<Step3Preview />` rendered directly. The Outlet is only used on mobile at `/3/preview`.
- The form's "Build my plan" button is always rendered; the `!isDesktop &&` JSX guard becomes a CSS `display: none` rule on `.onboarding-form-build-btn` at desktop breakpoint. (This is the inverse of what you might expect — we keep the button in the JSX tree always so React doesn't unmount/remount it on resize.)
- Italic terracotta `<em>` styling moves to `.onboarding-h1 em` selector.
- Inline `style={{}}` margin/padding props removed in favor of named classes and `.onboarding-step`'s flex behavior.
- The form-content variable goes from inline JSX inside the function body to a named JSX expression `formMarkup` — purely cosmetic, makes the desktop/mobile switch easier to read.
- The text "URL paste is coming soon" replaces the previous (more vague) field helper. This pre-empts user confusion about whether they're missing something.
- Action row composes the named primitives `.onboarding-back-btn`, `.onboarding-continue-btn`, with the additional class `.onboarding-form-build-btn` on the primary button so CSS can target it specifically for the desktop hide rule.


---

## 2.4 · Step 3: Preview (mobile sub-route + desktop inline)

### Reference

- Mobile preview: `design/screens.html` lines 1655–1729
- Desktop fused right column: `design/screens.html` lines 1939–1985

### Composition

- `Step3Preview` is rendered in two contexts:
  1. **Mobile, standalone via Outlet** at `/onboarding/3/preview`. The
     parent `Step3Materials` returns `<Outlet />` instead of the form when
     `isPreviewRoute` is true.
  2. **Desktop, directly rendered** inside the right column slot of
     `Step3Materials`'s two-column grid. Not via Outlet — `Step3Materials`
     imports and renders `<Step3Preview />` directly, so the URL stays
     `/onboarding/3` on desktop.
- The component renders both mobile-only and desktop-only sub-blocks in TSX
  always. CSS visibility classes (`.onboarding-preview-mobile-only` and
  `.onboarding-preview-desktop-only`) hide the wrong one per viewport. **No
  `useMatchMedia`** in this component — pure CSS.
- The action row uses Part 1E's primitive, with two sub-classes:
  `.onboarding-preview-actions` on the row, `.onboarding-preview-back-btn`
  on the back button. The back button is hidden on desktop fused (it would
  navigate to `/3` from `/3`, nonsensical).

### Screen-specific elements

- An empty-state placeholder when no materials are present
  (`.onboarding-empty-preview`).
- A mobile-only heading "Here's a plan." with terracotta `<em>` accent.
- A mobile-only lead summarizing deadline / weeks / hours.
- A mobile-only 3-stat block (weeks · sessions · total hours).
- A desktop-only 3-stat block (target finish · weeks · per week).
- Capacity prompts: `<UnderCapacityBanner />` and `<OverCapacityModal />`
  composed from existing Phase 5 components.
- `<SchedulePreview />` from Phase 5, unchanged.
- A mobile-only "Show all N weeks" toggle button (this is a UI affordance
  for slice 4; functionally it's a no-op until a future slice wires the
  collapse/expand behavior).
- The action row at the bottom: back (mobile only) + Looks good (always).

### Corrected TSX

**Replace the entire contents of `apps/app/src/onboarding/steps/Step3Preview.tsx`
with:**

```tsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateRoadmap, type RoadmapInput, type RoadmapOutput } from '@study-tracker/progress-engine'
import { differenceInCalendarDays } from 'date-fns'
import { useOnboarding, type OnboardingSlotEdit } from '../OnboardingProvider'
import { useSync } from '../../sync/useSync'
import { useEventStore } from '../../events/useEventStore'
import { SchedulePreview } from '../components/SchedulePreview'
import { OverCapacityModal, UnderCapacityBanner } from '../components/CapacityPrompt'
import type { MaterialAddedPayload, RoadmapCreatedPayload } from '../../sync/types'

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function Step3Preview() {
  const { state, dispatch } = useOnboarding()
  const { logEvent } = useSync()
  const eventStore = useEventStore()
  const navigate = useNavigate()
  const [committing, setCommitting] = useState(false)

  const previewEdits = useMemo(() => {
    const edits = new Map<string, { materialId: string | null; sessionTitle: string | null }>()
    for (const e of state.previewEdits) {
      edits.set(`${e.weekIndex}:${e.dayOfWeek}`, { materialId: e.materialId, sessionTitle: e.sessionTitle })
    }
    return edits
  }, [state.previewEdits])

  const roadmapInput = useMemo((): RoadmapInput | null => {
    if (!state.deadline || state.selectedStudyDays.length === 0 || state.materials.length === 0) return null
    const today = new Date().toISOString().split('T')[0]
    const days = differenceInCalendarDays(state.deadline, today)
    const weeks = Math.max(1, Math.ceil(days / 7))
    return {
      materials: state.materials
        .filter(m => m.title && m.estimatedDuration > 0)
        .map((m, i) => ({ id: m.id, title: m.title, totalMinutes: m.estimatedDuration, role: m.role, additionOrder: i })),
      weeks,
      startDate: today,
      selectedStudyDays: state.selectedStudyDays,
      weekdayHours: state.weekdayHours,
      weekendHours: state.weekendHours,
    }
  }, [state.deadline, state.selectedStudyDays, state.weekdayHours, state.weekendHours, state.materials])

  const debouncedInput = useDebouncedValue(roadmapInput, 150)
  const roadmap = useMemo((): RoadmapOutput | null => {
    if (!debouncedInput || debouncedInput.materials.length === 0) return null
    return generateRoadmap(debouncedInput)
  }, [debouncedInput])

  const displayRoadmap = useMemo((): RoadmapOutput | null => {
    if (!roadmap) return null
    const resolved = { ...roadmap, weeks: roadmap.weeks.map(w => ({ ...w, slots: w.slots.map(s => ({ ...s })) })) }
    for (const week of resolved.weeks) {
      for (const slot of week.slots) {
        const key = `${slot.weekIndex}:${slot.dayOfWeek}`
        const edit = previewEdits.get(key)
        if (edit) {
          if (edit.materialId && slot.candidateMaterialIds.includes(edit.materialId)) {
            slot.candidateMaterialIds = [edit.materialId]
          } else if (edit.materialId === null) {
            slot.candidateMaterialIds = []
          }
          if (edit.sessionTitle !== null) {
            slot.sessionTitle = edit.sessionTitle
          }
        }
      }
    }
    return resolved
  }, [roadmap, previewEdits])

  const capacityCheck = displayRoadmap?.capacityCheck
  const unresolvedTieCount = (displayRoadmap?.warnings.find(w => w.kind === 'unresolved-tie-count')?.detail?.count as number) ?? 0

  const handleResolveTie = useCallback((weekIndex: number, dayOfWeek: string, materialId: string | null) => {
    const edits: OnboardingSlotEdit[] = [...state.previewEdits]
    const existingIdx = edits.findIndex(e => e.weekIndex === weekIndex && e.dayOfWeek === dayOfWeek)
    if (existingIdx >= 0) {
      edits[existingIdx] = { ...edits[existingIdx], materialId }
    } else {
      edits.push({ weekIndex, dayOfWeek, materialId, sessionTitle: null, plannedMinutes: 0 })
    }
    dispatch({ type: 'SET_PREVIEW_EDITS', edits })
  }, [state.previewEdits, dispatch])

  const handleRename = useCallback((weekIndex: number, dayOfWeek: string, sessionTitle: string) => {
    const edits: OnboardingSlotEdit[] = [...state.previewEdits]
    const existingIdx = edits.findIndex(e => e.weekIndex === weekIndex && e.dayOfWeek === dayOfWeek)
    if (existingIdx >= 0) {
      edits[existingIdx] = { ...edits[existingIdx], sessionTitle }
    } else {
      edits.push({ weekIndex, dayOfWeek, materialId: null, sessionTitle, plannedMinutes: 0 })
    }
    dispatch({ type: 'SET_PREVIEW_EDITS', edits })
  }, [state.previewEdits, dispatch])

  const handleCompress = useCallback(() => {
    // Recompute with capacityCheck.suggestedWeeks. See OQ-03 for the
    // reconciliation between deadline-driven weeks and compressed weeks.
  }, [])

  const handleCommit = useCallback(async () => {
    if (!displayRoadmap || committing || unresolvedTieCount > 0) return
    setCommitting(true)
    try {
      const allSlots = displayRoadmap.weeks.flatMap(w => w.slots)

      for (const mat of state.materials) {
        if (!mat.title || mat.estimatedDuration <= 0) continue
        const payload: MaterialAddedPayload = {
          materialId: mat.id,
          title: mat.title,
          estimatedDuration: mat.estimatedDuration,
          url: mat.url,
          kind: 'manual',
          role: mat.role,
        }
        await logEvent('MaterialAdded', payload as unknown as Record<string, unknown>)
      }

      const roadmapPayload: RoadmapCreatedPayload = {
        startDate: roadmapInput!.startDate,
        deadline: state.deadline!,
        weeks: roadmapInput!.weeks,
        purpose: state.purpose || undefined,
        selectedStudyDays: state.selectedStudyDays,
        weekdayHours: state.weekdayHours,
        weekendHours: state.weekendHours,
        weeklyHours: state.weeklyHours,
        slots: allSlots,
      }
      await logEvent('RoadmapCreated', roadmapPayload as unknown as Record<string, unknown>)

      await logEvent('OnboardingCompleted', {})
      await eventStore.table('onboardingDraft').clear()

      navigate('/onboarding/4')
    } finally {
      setCommitting(false)
    }
  }, [displayRoadmap, state, committing, unresolvedTieCount, logEvent, eventStore, navigate, roadmapInput])

  // Empty state — shown when not enough info to compute the roadmap. No
  // CheckpointGate wrapper here: the parent Step3Materials already wraps in
  // one, regardless of whether we're rendered via Outlet or directly.
  if (!roadmapInput) {
    return (
      <p className="onboarding-empty-preview">
        Add at least one material to see your plan preview.
      </p>
    )
  }

  const sessionsCount = roadmapInput.materials.length * roadmapInput.weeks
  const totalHours = Math.round((capacityCheck?.totalMaterialMinutes ?? 0) / 60)

  return (
    <div className="onboarding-step onboarding-preview">
      {/* Mobile-only heading + lead. CSS hides on desktop fused. */}
      <h1 className="onboarding-h1 onboarding-preview-mobile-only">
        Here's a <em>plan</em>.
      </h1>
      <p className="onboarding-lead onboarding-preview-mobile-only">
        Done by {state.deadline} · {roadmapInput.weeks} week{roadmapInput.weeks !== 1 ? 's' : ''} · {state.weeklyHours}h/week. Tap a row to edit.
      </p>

      {/* Mobile stat block */}
      <div className="onboarding-preview-stats onboarding-preview-mobile-only">
        <div className="stat"><div className="stat-value sm">{roadmapInput.weeks}</div><div className="stat-label">weeks</div></div>
        <div className="stat"><div className="stat-value sm">{sessionsCount}</div><div className="stat-label">sessions</div></div>
        <div className="stat"><div className="stat-value sm">{totalHours}h</div><div className="stat-label">total</div></div>
      </div>

      {/* Desktop stat block */}
      <div className="onboarding-preview-stats onboarding-preview-desktop-only">
        <div className="stat"><div className="stat-value md">{state.deadline}</div><div className="stat-label">target finish</div></div>
        <div className="stat"><div className="stat-value md">{roadmapInput.weeks}</div><div className="stat-label">weeks</div></div>
        <div className="stat"><div className="stat-value md">{state.weeklyHours}h</div><div className="stat-label">per week</div></div>
      </div>

      {capacityCheck && (
        <>
          <UnderCapacityBanner
            capacityCheck={capacityCheck}
            warnings={displayRoadmap?.warnings ?? []}
            onCompress={handleCompress}
            onKeepBuffer={() => {}}
          />
          <OverCapacityModal
            capacityCheck={capacityCheck}
            warnings={displayRoadmap?.warnings ?? []}
            onCompress={handleCompress}
            onKeepBuffer={() => {}}
          />
        </>
      )}

      {displayRoadmap && (
        <SchedulePreview
          roadmap={displayRoadmap}
          materials={state.materials.map(m => ({ id: m.id, title: m.title }))}
          onResolveTie={handleResolveTie}
          onRename={handleRename}
        />
      )}

      <button className="btn btn-ghost btn-sm btn-block onboarding-preview-mobile-only">
        Show all {roadmapInput.weeks} weeks
      </button>

      <div className="onboarding-spacer onboarding-preview-mobile-only" />

      <div className="onboarding-actions onboarding-preview-actions">
        <button
          className="btn btn-secondary onboarding-back-btn onboarding-preview-back-btn"
          onClick={() => navigate('/onboarding/3')}
          aria-label="Back"
        >
          <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
        </button>
        <button
          className="btn btn-primary btn-lg onboarding-continue-btn"
          disabled={unresolvedTieCount > 0 || committing || capacityCheck?.status === 'over-capacity'}
          title={unresolvedTieCount > 0 ? `Resolve ${unresolvedTieCount} undecided slot${unresolvedTieCount !== 1 ? 's' : ''} to continue.` : undefined}
          onClick={handleCommit}
        >
          {committing ? 'Saving…' : 'Looks good'}
          <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>
  )
}
```

### SchedulePreview — no changes required

The existing `SchedulePreview.tsx` from Phase 5 is correct as-is. It is
purely presentational, takes the roadmap as a prop, and uses the existing
`.schedule-card`, `.sched-week`, `.sched-week-label`, `.sched-row`,
`.sched-day`, `.sched-title`, `.sched-dur` classes from
`packages/design-tokens/src/components.css`. Don't touch it.

If you find that the desktop right-column rendering of SchedulePreview
overflows or wraps awkwardly, the fix is in
`.onboarding-materials-preview-slot` width constraints in `onboarding.css`,
not in `SchedulePreview` itself.

### CapacityPrompt — no changes required

Existing `OverCapacityModal` and `UnderCapacityBanner` in Phase 5's
`CapacityPrompt.tsx` are correct as-is. They use existing `.banner`,
`.banner.attention`, `.modal-overlay`, `.modal-card` primitives from the
design tokens.

### Mobile vs desktop deltas

| Aspect | Mobile (`/onboarding/3/preview`) | Desktop (right column at `/onboarding/3`) |
|---|---|---|
| Render path | via `<Outlet />` from `Step3Materials` | directly imported and rendered by `Step3Materials` |
| Heading "Here's a plan." | Visible (`.onboarding-preview-mobile-only` shown on mobile) | Hidden by CSS |
| Lead "Done by … · …" | Visible | Hidden by CSS |
| Mobile stat block (weeks · sessions · total) | Visible | Hidden by CSS |
| Desktop stat block (target · weeks · per week) | Hidden by CSS | Visible |
| "Show all N weeks" toggle | Visible | Hidden by CSS |
| Spacer | Visible (pushes action row to bottom) | Hidden (preview slot doesn't bottom-pin) |
| Action row Back button | Visible | Hidden by CSS — same URL `/3`, navigation would be a no-op |
| Action row Looks good button | Visible, full width via `flex: 1` | Visible, hugs content |
| URL | `/study/onboarding/3/preview` | `/study/onboarding/3` |
| Stepdot 3 active | Yes | Yes |
| Stepdots caption | "Step 3 of 4" | "Materials & preview" |

### What changed from the current code

- Removed the inline `const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches` at line 2047. The component now renders both mobile-only and desktop-only blocks always; CSS picks which is visible via the `.onboarding-preview-mobile-only` and `.onboarding-preview-desktop-only` classes.
- Removed the inner `<CheckpointGate step={3}>` wrap. The parent `Step3Materials` already wraps in CheckpointGate, regardless of whether `Step3Preview` is rendered via Outlet (mobile) or directly (desktop). Double-wrapping was redundant.
- The empty-state paragraph went from inline-styled `<p className="t-body" style={{ color: ..., padding: ..., textAlign: ... }}>` to `<p className="onboarding-empty-preview">`. The class lives in `onboarding.css`.
- The mobile stat block's inline-styled wrapper (`<div style={{ display: 'flex', gap: '16px', padding: '12px 14px', background: ..., border: ..., borderRadius: ..., marginBottom: '16px' }}>`) becomes `<div className="onboarding-preview-stats onboarding-preview-mobile-only">`. Same for the desktop stat block.
- The italic terracotta `<em>` becomes plain `<em>` — the `.onboarding-h1 em` selector handles styling.
- The `<div style={{ flex: 1 }} />` mobile spacer becomes `<div className="onboarding-spacer onboarding-preview-mobile-only" />` so it actually works (after the layout shell fix in Part 1A) and is hidden on desktop where the preview doesn't bottom-pin.
- The bottom action row's inline-styled `<div className="row" style={{ gap: '8px', marginTop: '16px' }}>` becomes `<div className="onboarding-actions onboarding-preview-actions">`.
- The back button gets the `.onboarding-preview-back-btn` class so CSS can hide it on desktop fused.
- Action row primary button uses `.onboarding-continue-btn` (the same primitive as steps 1, 2, 3 form), so its responsive sizing (full width on mobile, hug content on desktop) is consistent with the rest of the flow.
- Removed the `resolvedTies` state — it was unused. The `previewEdits` state already tracks tie resolutions.
- Removed the unused `useEffect` import path (the only `useEffect` used is now inside `useDebouncedValue`).


---

## 2.5 · Step 4: Confirmation (success + first session preview)

### Reference

- Mobile: `design/screens.html` lines 1733–1865
- Desktop K5: `design/screens.html` lines 4306–4353

### Composition

- Layout shell from Part 1A (`.onboarding-shell[data-shape="column"]`).
- Heading + lead from Part 1C.
- Action row from Part 1E (single primary "Go to home" button — no back).

### Screen-specific elements

- A 56px circular moss-tinted success check icon (`.onboarding-success-check`).
- The heading "All set." with terracotta `<em>` on the period? No — the
  design uses a plain heading here. (`.onboarding-h1` without `<em>`.)
- A lead summarizing deadline / weeks / hours.
- A "FIRST UP · TODAY" mono-caps section header.
- An inverted material card showing the first scheduled session
  (`.material-row.inverted` from design tokens).
- A "Go to home" primary button.

### Out of scope from `screens.html`

- The PWA install banner at lines 1847–1859 (mobile) and 4340–4349 (desktop).
  Drops in slice 13. **Do not render it in slice 4.** See Part 0.3.
- The "Start now" / "Later" buttons. The active-session screen they'd open
  lands in slice 5. In slice 4 the welcome has only "Go to home".

### Corrected TSX

**Replace the entire contents of `apps/app/src/onboarding/steps/Step4Confirm.tsx`
with:**

```tsx
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../../events/useEventStore'
import { CheckpointGate } from '../CheckpointGate'
import type { RoadmapCreatedPayload, MaterialAddedPayload } from '../../sync/types'

function formatMinutes(m: number): string {
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

export function Step4Confirm() {
  const navigate = useNavigate()
  const eventStore = useEventStore()

  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])

  // Derive the most recent RoadmapCreated payload + first scheduled session
  const summary = (() => {
    if (!events) return null
    const roadmapEvents = events.filter(e => e.kind === 'RoadmapCreated')
    if (roadmapEvents.length === 0) return null
    const roadmap = roadmapEvents[roadmapEvents.length - 1].payload as unknown as RoadmapCreatedPayload

    const today = new Date().toISOString().split('T')[0]
    const firstSlot = roadmap.slots
      .filter(s => s.date >= today && s.candidateMaterialIds.length >= 1)
      .sort((a, b) => a.date.localeCompare(b.date))[0]

    if (!firstSlot) return { roadmap, firstMaterial: null, firstSlot: null }

    const materialEvents = events.filter(e => e.kind === 'MaterialAdded')
    const firstMaterialId = firstSlot.candidateMaterialIds[0]
    const firstMaterial = materialEvents
      .map(e => e.payload as unknown as MaterialAddedPayload)
      .find(m => m.materialId === firstMaterialId)

    return { roadmap, firstMaterial, firstSlot }
  })()

  if (!summary) {
    // Events still loading or no roadmap — show minimal success state
    return (
      <CheckpointGate step={4}>
        <div className="onboarding-step">
          <div style={{ textAlign: 'center' }}>
            <div className="onboarding-success-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 className="onboarding-h1">All set.</h1>
          </div>
          <div className="onboarding-spacer" />
          <div className="onboarding-actions">
            <button className="btn btn-primary btn-lg onboarding-continue-btn" onClick={() => navigate('/home')}>
              Go to home
              <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>
      </CheckpointGate>
    )
  }

  const { roadmap, firstMaterial, firstSlot } = summary

  return (
    <CheckpointGate step={4}>
      <div className="onboarding-step">
        <div style={{ textAlign: 'center' }}>
          <div className="onboarding-success-check">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="onboarding-h1">All set.</h1>
          <p className="onboarding-lead">
            Done by {roadmap.deadline} · {roadmap.weeks} week{roadmap.weeks !== 1 ? 's' : ''} · {roadmap.weeklyHours}h/week.
          </p>
        </div>

        {firstMaterial && firstSlot && (
          <div style={{ marginBottom: 32 }}>
            <div className="mono-caps" style={{ marginBottom: 12 }}>FIRST UP · TODAY</div>
            <div className="material-row inverted">
              <div className="material-icon bk">BK</div>
              <div className="material-body">
                <div className="material-title">{firstMaterial.title}</div>
                <div className="material-meta">
                  ~{formatMinutes(firstSlot.plannedMinutes)} · {firstMaterial.estimatedDuration / 60}h cap
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="onboarding-spacer" />

        <div className="onboarding-actions">
          <button className="btn btn-primary btn-lg onboarding-continue-btn" onClick={() => navigate('/home')}>
            Go to home
            <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </CheckpointGate>
  )
}
```

### Mobile vs desktop deltas

| Aspect | Mobile | Desktop column |
|---|---|---|
| Heading size | 24px | 36px |
| Lead size | 14px | 15px |
| Content alignment | Top-aligned, full-width | Centered horizontally + vertically (max-width 480px) |
| Stepdots | Top-row, "Step 4 of 4" caption right | Centered above, no caption |
| Spacer | Pushes button to viewport bottom | No-op (content centered) |
| "Go to home" button | Full width via `.onboarding-continue-btn` `flex: 1` | Hugs content |

All deltas are CSS via `.onboarding-shell[data-shape="column"]`. Same shape
as steps 1, 2.

### What changed from the current code

This is the first implementation of `Step4Confirm.tsx` — Phase 6 in the
implementation plan is "Not started." The corrected TSX above is the full
file as it should be created, not a diff.

The only subtleties beyond the obvious composition:

- The `.onboarding-success-check` class encapsulates the moss-tinted
  56-pixel circle. The SVG inside it should be a checkmark sized 28×28.
- The first-up section uses inline `style={{ marginBottom: 32 }}` because
  it's a one-off rhythm that doesn't repeat anywhere; per Part 1C this is
  acceptable. If desired, a `.onboarding-first-up` class can lift it.
- The `useLiveQuery` hook reads events reactively. If events are still
  loading (`events === undefined`), `summary` is `null`, and we render the
  minimal success state without the first-up card. Once events resolve, the
  card fills in.


---

# Part 3 · Fix-up checklist

Run these checks against your implementation after applying Parts 1 and 2.
Each item is a literal check with a verification command or a manual visual
step. If a check fails, the corresponding part of the guide tells you what
to do.

## 3.1 — File-existence checks

```bash
# Layout shell uses the new shape attribute and named classes
grep -n "data-shape" apps/app/src/onboarding/OnboardingLayout.tsx
# Must show: data-shape={shape}

# useMatchMedia hook exists at the expected path
ls apps/app/src/lib/useMatchMedia.ts

# StepDots component exists
ls apps/app/src/onboarding/components/StepDots.tsx

# onboarding.css has the new classes (spot check)
grep -E "onboarding-shell|onboarding-step|onboarding-h1|onboarding-spacer" apps/app/src/onboarding/onboarding.css
# Must show all four
```

## 3.2 — Anti-pattern grep (these must return ZERO matches)

```bash
# 1. No inline window.matchMedia reads anywhere in onboarding
grep -rn "window.matchMedia" apps/app/src/onboarding/
# Expected: no matches

# 2. No inline italic-terracotta em styling
grep -rn "fontStyle: 'italic', color: 'var(--terracotta)'" apps/app/src/onboarding/
# Expected: no matches

# 3. No inline flex-1 spacer divs
grep -rn "style={{ flex: 1 }}" apps/app/src/onboarding/
# Expected: no matches (use .onboarding-spacer instead)

# 4. No useMatchMedia imports outside Step3Materials
grep -rln "useMatchMedia" apps/app/src/onboarding/
# Expected: only steps/Step3Materials.tsx

# 5. No grid templates inlined in step components
grep -rn "gridTemplateColumns" apps/app/src/onboarding/steps/
# Expected: no matches (use .onboarding-materials-grid or .onboarding-hours-split)
```

If any of these greps return matches, that file still has the old pattern
and needs the corresponding Part 2 recipe applied.

## 3.3 — Per-step structural checks

Run these in your editor or with grep:

1. **`OnboardingLayout.tsx`** uses `<div className="onboarding-shell" data-shape={shape}>` as the outer wrapper. The `<div className="app">` wrapper is gone. The `<main>` element wrapping `<Outlet />` has class `onboarding-content`.

2. **`Step1Deadline.tsx`** wraps its body in `<div className="onboarding-step">`. The `<em>done</em>` inside `.onboarding-h1` has no inline style. The Continue button is wrapped in `<div className="onboarding-actions">`.

3. **`Step2Hours.tsx`** uses `.onboarding-hours-display` (with three child spans for number/suffix/sublabel) and `.onboarding-hours-split` for the weekday/weekend grid. The back button has `aria-label="Back"`.

4. **`Step3Materials.tsx`** imports `useMatchMedia` from `'../../lib/useMatchMedia'`. The `isDesktop` value is the result of `useMatchMedia('(min-width: 1024px)')`, not a `window.matchMedia(...).matches` read. The desktop branch returns `<div className="onboarding-step onboarding-materials-grid">` with two children (`.onboarding-materials-form` and `.onboarding-materials-preview-slot`), and the preview slot directly contains `<Step3Preview />` (not `<Outlet />`). The mobile branch returns `<Outlet />` (when on `/preview`) or `<div className="onboarding-step">{formMarkup}</div>` (otherwise).

5. **`Step3Preview.tsx`** has no `useMatchMedia` import and no `window.matchMedia` calls. Its outer wrapper is `<div className="onboarding-step onboarding-preview">` with no `<CheckpointGate>` (the parent provides it). Both mobile-only and desktop-only sub-blocks are rendered always; CSS handles visibility via `.onboarding-preview-mobile-only` and `.onboarding-preview-desktop-only` classes.

6. **`Step4Confirm.tsx`** exists and renders the success check via `<div className="onboarding-success-check">`, the heading via `.onboarding-h1`, and a single primary button in `<div className="onboarding-actions">`. There is no PWA install banner and no "Start now" / "Later" buttons.

7. **`MaterialRow.tsx`** has `<div className="material-icon bk">BK</div>` hard-coded for every material, no role-to-icon mapping.

## 3.4 — Visual checks (manual)

Open the dev server and walk each step in both viewports:

**Mobile viewport (browser dev tools, ~390×844):**

1. Stepdots sit top-left, `Step N of 4` caption sits top-right.
2. On step 1, the Continue button sits at the **bottom of the viewport**, not immediately under the optional purpose field. (If it doesn't, the layout shell or `.onboarding-spacer` is wrong.)
3. On step 2, the big number `8` is centered above the chip row, sized roughly 56px.
4. On step 3, the URL input is disabled and shows the helper "URL paste is coming soon — add materials manually below."
5. On step 3, clicking "Build my plan" navigates to `/onboarding/3/preview` and the URL changes accordingly.
6. On step 3 preview, dot 3 is still active (NOT dot 4).
7. On step 4, the success check circle is moss-green-tinted, 56px, centered. The "Go to home" button sits at the bottom of the viewport.

**Desktop viewport (browser dev tools, ~1280×800 or full screen):**

1. On steps 1, 2, 4: stepdots are centered above the content, no caption to the right of them. Content is centered both horizontally (max-width ~480px) and vertically.
2. On step 3: stepdots sit top-left, "Materials & preview" caption sits top-right (NOT "Step 3 of 4").
3. On step 3: the screen is two columns — form on the left, live preview on the right with the label "Live preview · updates as you add" above the schedule card.
4. On step 3: the form's bottom action row has only a Back button. There is no "Build my plan" button visible.
5. On step 3 preview (right column): the first heading you see is the `.onboarding-materials-preview-label` (not "Here's a plan"). The desktop stat block shows three stats: target finish, weeks, per week.
6. On step 3 preview: the bottom of the right column has only a "Looks good" button. No back button.
7. Resize across the 1024px breakpoint — the layout should swap immediately and reactively. (If it doesn't, the `useMatchMedia` hook is broken or a component is reading viewport synchronously during render.)

## 3.5 — TypeScript + tests

```bash
pnpm --filter app typecheck   # no errors
pnpm --filter app test        # all existing tests pass
```

If typecheck fails on `Step3Preview` after removing the inner `CheckpointGate`,
check the `import` line — it should not include `CheckpointGate` anymore.

If tests fail in `Step3Materials.test.tsx` because of the new `useMatchMedia`
hook, the test setup may need to mock `window.matchMedia`. Add to your
`test/setup.ts` if not already present:

```ts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
```

This makes the hook return `false` (mobile) by default in tests. Tests that
need to assert desktop behavior can override this per-test.


---

# Appendix · Complete `onboarding.css`

**Replace the entire contents of `apps/app/src/onboarding/onboarding.css`
with the file below.** Do not merge with the existing file — replace
wholesale. The classes referenced by Parts 1 and 2 are all defined here.

```css
/* apps/app/src/onboarding/onboarding.css
 *
 * Onboarding-specific styles. Imported once by OnboardingLayout.tsx.
 *
 * All layout switching at the 1024px breakpoint happens in this file.
 * The single permitted JS viewport read is in Step3Materials.tsx via
 * useMatchMedia — and that's only for choosing a button, not for layout.
 *
 * Layout shape selectors:
 *   .onboarding-shell[data-shape="column"]  → steps 1, 2, 4 (centered narrow column on desktop)
 *   .onboarding-shell[data-shape="fused"]   → step 3 (two-column fused on desktop)
 */

/* ============================================================
 * 1. Shell + content wrappers
 * ============================================================ */

.onboarding-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-page);
}

.onboarding-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 20px 16px;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.onboarding-step {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ============================================================
 * 2. Stepdots wrap + captions
 * ============================================================ */

.onboarding-stepdots-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 0;
  max-width: 640px;
  margin: 0 auto 32px;
  width: 100%;
  box-sizing: border-box;
}

.onboarding-mobile-caption { display: block; }
.onboarding-desktop-caption { display: none; }

/* ============================================================
 * 3. Heading + lead typography
 * ============================================================ */

.onboarding-h1 {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.018em;
  line-height: 1.1;
  font-variation-settings: 'opsz' 96;
  margin: 0 0 12px;
  color: var(--text-primary);
}

.onboarding-h1 em {
  font-style: italic;
  color: var(--terracotta);
  font-weight: 400;
}

.onboarding-lead {
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 0 0 24px;
}

/* ============================================================
 * 4. Spacer + bottom action row
 * ============================================================ */

.onboarding-spacer {
  flex: 1;
  min-height: 24px;
}

.onboarding-actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  align-items: stretch;
}

.onboarding-back-btn {
  flex-shrink: 0;
  padding: 0 14px;
}

.onboarding-continue-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* ============================================================
 * 5. Step 2 — hours display + split fields
 * ============================================================ */

.onboarding-hours-display {
  text-align: center;
  margin: 16px 0 24px;
}

.onboarding-hours-number {
  font-family: var(--font-display);
  font-size: 56px;
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1;
  font-variation-settings: 'opsz' 96;
  color: var(--text-primary);
  display: inline-block;
}

.onboarding-hours-suffix {
  font-size: 18px;
  color: var(--text-tertiary);
  margin-left: 6px;
}

.onboarding-hours-sublabel {
  margin-top: 8px;
  display: block;
}

.onboarding-hours-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

/* ============================================================
 * 6. Step 3 — materials form + grid + slot
 * ============================================================ */

.onboarding-add-manually-btn {
  align-self: flex-start;
  margin: 12px 0 16px;
}

.onboarding-materials-count {
  margin: 16px 0 8px;
}

/* Mobile: grid is "display: contents" so its children become flex items
 * of the parent .onboarding-step. The form fills the column; the preview
 * slot is hidden. */
.onboarding-materials-grid {
  display: contents;
}

.onboarding-materials-form {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.onboarding-materials-preview-slot {
  display: none;
}

.onboarding-materials-preview-label {
  margin-bottom: 12px;
}

/* ============================================================
 * 7. Step 3 preview — visibility + stats + actions
 * ============================================================ */

.onboarding-preview {
  /* No special styles on mobile — sits inside .onboarding-step */
}

.onboarding-preview-mobile-only { display: block; }
.onboarding-preview-desktop-only { display: none; }

.onboarding-preview-stats {
  display: flex;
  gap: 16px;
  padding: 12px 14px;
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.onboarding-preview-stats .stat {
  flex: 1;
}

.onboarding-preview-actions {
  margin-top: 16px;
}

.onboarding-empty-preview {
  font-family: var(--font-body);
  color: var(--text-secondary);
  padding: 2rem 0;
  text-align: center;
}

/* ============================================================
 * 8. Step 4 — success check
 * ============================================================ */

.onboarding-success-check {
  display: inline-flex;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(74, 107, 58, 0.12);
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.onboarding-success-check svg {
  width: 28px;
  height: 28px;
  color: var(--moss);
  stroke: currentColor;
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ============================================================
 * 9. Desktop overrides at 1024px
 *
 * Everything below this line activates only on desktop. The shape
 * attribute on .onboarding-shell discriminates between column shells
 * (steps 1, 2, 4) and the fused shell (step 3).
 * ============================================================ */

@media (min-width: 1024px) {

  /* --- Caption visibility ---------------------------------- */

  .onboarding-shell[data-shape="column"] .onboarding-mobile-caption,
  .onboarding-shell[data-shape="fused"]  .onboarding-mobile-caption {
    display: none;
  }
  .onboarding-shell[data-shape="fused"] .onboarding-desktop-caption {
    display: block;
  }

  /* --- Column shape (steps 1, 2, 4) ------------------------ */

  .onboarding-shell[data-shape="column"] .onboarding-stepdots-wrap {
    justify-content: center;
    padding: 32px 20px 0;
    margin-bottom: 24px;
  }

  .onboarding-shell[data-shape="column"] .onboarding-content {
    max-width: 480px;
    padding: 0 20px 40px;
    text-align: center;
    justify-content: center;
  }

  .onboarding-shell[data-shape="column"] .onboarding-step {
    flex: initial;
  }

  .onboarding-shell[data-shape="column"] .onboarding-h1 {
    font-size: 36px;
    letter-spacing: -0.02em;
    margin-bottom: 16px;
  }

  .onboarding-shell[data-shape="column"] .onboarding-lead {
    font-size: 15px;
    margin-bottom: 32px;
  }

  /* Form fields stay left-aligned even though the body is centered. */
  .onboarding-shell[data-shape="column"] .field-group,
  .onboarding-shell[data-shape="column"] .onboarding-hours-split {
    text-align: left;
  }

  /* Action row on desktop column: side-by-side, hugs content. */
  .onboarding-shell[data-shape="column"] .onboarding-actions {
    justify-content: space-between;
    margin-top: 32px;
  }

  .onboarding-shell[data-shape="column"] .onboarding-continue-btn {
    flex: initial;
  }

  /* Spacer is a no-op on desktop column (content vertically centered). */
  .onboarding-shell[data-shape="column"] .onboarding-spacer {
    display: none;
  }

  /* Step 2 hours display scales up on desktop column. */
  .onboarding-shell[data-shape="column"] .onboarding-hours-number {
    font-size: 88px;
    font-variation-settings: 'opsz' 144;
  }
  .onboarding-shell[data-shape="column"] .onboarding-hours-suffix {
    font-size: 28px;
  }

  /* --- Fused shape (step 3 only) --------------------------- */

  .onboarding-shell[data-shape="fused"] .onboarding-stepdots-wrap {
    padding: 24px 48px 0;
    max-width: 1200px;
    margin-bottom: 24px;
  }

  .onboarding-shell[data-shape="fused"] .onboarding-content {
    max-width: 1200px;
    padding: 0 48px 48px;
  }

  .onboarding-shell[data-shape="fused"] .onboarding-h1 {
    font-size: 28px;
    margin-bottom: 8px;
  }

  /* Activate the two-column grid. */
  .onboarding-shell[data-shape="fused"] .onboarding-materials-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    flex: 1;
  }

  .onboarding-shell[data-shape="fused"] .onboarding-materials-form {
    display: flex;
    flex-direction: column;
    flex: initial;
  }

  /* Preview slot becomes visible. */
  .onboarding-shell[data-shape="fused"] .onboarding-materials-preview-slot {
    display: block;
  }

  /* Form's "Build my plan" button hidden — preview has the commit. */
  .onboarding-shell[data-shape="fused"] .onboarding-form-build-btn {
    display: none;
  }

  /* Flip preview visibility classes. */
  .onboarding-shell[data-shape="fused"] .onboarding-preview-mobile-only {
    display: none;
  }
  .onboarding-shell[data-shape="fused"] .onboarding-preview-desktop-only {
    display: block;
  }

  /* Preview stats are slightly more padded on desktop. */
  .onboarding-shell[data-shape="fused"] .onboarding-preview-stats {
    padding: 16px;
  }

  /* Preview's back button is hidden on desktop fused (we're already at /3). */
  .onboarding-shell[data-shape="fused"] .onboarding-preview-back-btn {
    display: none;
  }

  /* Preview's continue button hugs content on desktop. */
  .onboarding-shell[data-shape="fused"] .onboarding-preview-actions .onboarding-continue-btn {
    flex: initial;
  }
}
```

---

# End of guide

You now have everything you need to bring the slice 4 onboarding screens
into visual fidelity with `design/screens.html` while keeping the
architecture from the implementation plan intact.

**Order of operations** when implementing:

1. Replace `OnboardingLayout.tsx` per Part 1A.
2. Create `apps/app/src/lib/useMatchMedia.ts` per Part 1B.
3. Create `apps/app/src/onboarding/components/StepDots.tsx` per Part 1D.
4. Replace `apps/app/src/onboarding/onboarding.css` with the Appendix.
5. Replace `Step1Deadline.tsx` per Part 2.1.
6. Replace `Step2Hours.tsx` per Part 2.2.
7. Replace `Step3Materials.tsx` per Part 2.3.
8. Verify `MaterialRow.tsx` still hard-codes `BK` per Part 1F.
9. Replace `Step3Preview.tsx` per Part 2.4.
10. Replace (or create) `Step4Confirm.tsx` per Part 2.5.
11. Run Part 3's checklist.
12. Resize-test across the 1024px breakpoint in dev tools — the layout
    should swap reactively without any hydration warnings or stale state.

If something resists fitting into one of the named primitives, the right
move is usually to extend the primitive — not to add inline styles. Please
add a one-off helper class to `onboarding.css` and document why in a
short comment inside the CSS file. The goal of this guide is that, after
applying it, *no inline `style={{}}` props remain in any onboarding step
component except for the narrowly-allowed cases listed in Part 1C*.
