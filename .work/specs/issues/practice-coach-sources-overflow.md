# Practice coach sources overflow (bug contract)

_Area: APP practice run coach popover. Reporter flow: practice page -> `I'm stuck` -> accept hint -> open sources disclosure._

## Reported behavior

On the practice run page the learner opens `I'm stuck` and accepts the hint.
The generated hint carries a sources disclosure (`N source(s)`).
Opening it shows long quotes that overflow the coach card.
The region is not scrollable and the disclosure cannot be collapsed again because the card grows past the viewport and pushes its own controls out of reach.

## Reproduction sketch

Sign in with the dev account (creds in `.work/specs/test-login-cred.txt`, never printed).
Start a practice run from a material with enough content to yield multi-quote citations.
Click `I'm stuck`, then `Yes, help me`, wait for the hint stream to finish.
Click the `N source(s)` summary.
Measure `.coach` and `.coach-citations ul` rects against the viewport at 1280 and 375.

## Root-cause hypothesis (verified in code, to confirm in browser)

`.coach` (`apps/app/src/guide/practiceCoach.css:6-19`) is `position: fixed` with no `max-height` and no `overflow`.
`.coach-body` (`:102-109`) and `.coach-citations ul` (`:137-143`) are uncapped, so long quotes grow the card beyond the viewport.
The native `<details>` (`apps/app/src/guide/PracticeCoach.tsx:103-116`) is fine; its summary just becomes unreachable.

## Acceptance criteria

AC1: With a long multi-quote sources list open, the coach card stays fully inside the viewport at 1280 and 375.
AC2: The sources list scrolls internally and the summary toggles open and closed by pointer and keyboard.
AC3: Dismiss (`x`), `Got it`, and tier actions stay reachable with sources open.
AC4: Hint streaming, tier ladder, reveal gate, and run-pointer contracts are unchanged (rule 42).
AC5: Unit tests plus browser evidence at both viewports are green with zero console errors.

## Scope and non-goals

In scope: `PracticeCoach.tsx` markup only if needed, `practiceCoach.css` containment, `PracticeCoach.test.tsx` regression assertions, one Playwright regression check modeled on `e2e/practice-guide-live.spec.ts`.
Out of scope: generation, grading, reveal-gate logic, run pointers, new dependencies, custom collapsible components.
The fix stays native `<details>` plus CSS (`ponytail` ladder rung 4).

## Files involved

- `apps/app/src/guide/PracticeCoach.tsx:103-116` (disclosure markup).
- `apps/app/src/guide/practiceCoach.css:6-19,102-150` (fix lands here).
- `apps/app/src/guide/PracticeCoach.test.tsx:101-111` (existing disclosure test, no overflow coverage).
- `e2e/practice-guide-live.spec.ts:148-168,256-278` (live pattern to reuse).
