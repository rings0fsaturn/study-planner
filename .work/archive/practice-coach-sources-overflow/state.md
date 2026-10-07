# State - practice-coach-sources-overflow

_Spec: specs/issues/practice-coach-sources-overflow.md · Plan: active/practice-coach-sources-overflow/plan/PLAN.md · STATUS row: practice-coach-sources-overflow · Status: done · Updated: 2026-10-07_

## Current state & next

- Done 2026-10-07: coach sources overflow fixed (CSS-only), verified at 1280 and 375 with AC1-AC5 ticked, R1/R2/R3 all PASS.
- Code lives on branch `project/phase-2` (5 commits); merge or PR was not requested in this task.
- Next: none for this task; re-run `e2e/practice-coach-overflow.spec.ts` on the next coach or guide touch (one unclassified desktop transient on record).

## Done so far

- Phase 0 (2026-10-07): deterministic five-quote browser reproduction with the real stylesheet; card exceeded the viewport at both widths with Dismiss off-screen; `plan/evidence/measurements.md` plus 3 screenshots.
- Phase 1 (2026-10-07): red unit test plus live-gated 1280/375 Playwright check (mocked 5-quote SSE, real one-problem run); R1 PASS after fixing all findings in-phase (Got it reachability, try/finally, container queries, attempts cascade, scoped trigger, four-edge containment, Tab/Enter/Space toggle, phone toggle plus 44px, concrete px cap, viewport shots).
- Phase 2 (2026-10-07): CSS-only fix (card `min(70vh, 560px)` flex-column hidden, body scroll region, ul 180px scroll, phone `100dvh-120px` guard); honest red-green proven by stashing the fix; guide suite 34/34; R2 PASS (three APPROVEs).
- Phase 3 (2026-10-07): runtime restarted, post-fix browser pass green both widths, unit/typecheck/lint green, live spec 2/2 green with zero console errors, `plan/VERIFICATION.md` written; R3 PASS (thermo clean APPROVE plus two waived-minor APPROVEs).
- Reversed: unit test first read the stylesheet via `?raw` import, which vitest leaves empty, so the red ran against unstyled DOM; now reads the file via `node:fs` dirname plus join (Vite rewrites `new URL(..., import.meta.url)` asset syntax).

## Flow trace

1. `I'm stuck` calls `guide.ask` (`PracticeRun.tsx:504-513`).
2. Accept streams the hint tier via `usePracticeGuide` (`usePracticeGuide.ts:237-243`); citations arrive on SSE `citation` frames (`types.ts:22-43`).
3. Citations render in native `<details class="coach-citations">` (`PracticeCoach.tsx:103-116`, untouched).
4. The fix caps the card and both scroll regions in `practiceCoach.css:6-25,108-118,146-155,191-201` with no markup or logic change.
5. Regression pins: `PracticeCoach.test.tsx` (computed containment plus native toggle) and `e2e/practice-coach-overflow.spec.ts` (viewport geometry plus internal scroll plus pointer/keyboard toggle plus in-viewport actions plus service-role cleanup).

## Files affected

- `apps/app/src/guide/practiceCoach.css` - the fix: card cap plus flex containment, body scroll region, 180px citations cap, phone dvh guard.
- `apps/app/src/guide/PracticeCoach.test.tsx` - red-to-green regression test with disk-read stylesheet helper.
- `e2e/practice-coach-overflow.spec.ts` - new live-gated 1280 plus 375 regression spec with mocked five-quote stream.
- `.work/specs/issues/practice-coach-sources-overflow.md` - stable bug contract (AC1-AC5).
- `.work/active/practice-coach-sources-overflow/plan/` - PLAN.md, REVIEWS.md (R1-R3), VERIFICATION.md, evidence (pre-fix, fixed, e2e screenshots).

## Pitfalls & rules

- Must restart the managed app after CSS edits before browser proof because Vite on `/mnt/d` serves stale modules (rule 53).
- Must keep the native `<details>` collapse and add no component or dependency (ponytail ladder, rule 42 scope).
- Vitest empties `?raw` CSS imports and rewrites `new URL(..., import.meta.url)`; read test stylesheets via `node:fs` plus `import.meta.dirname`.
- `<summary>` exposes no button role in Chromium; scope the disclosure locator to the card's visible label (rule 11 documented fallback).
- jsdom toggles native `<details>` on summary click and echoes `min()` tokens raw in computed styles, so both behaviors are unit-pinnable.
- Live runs mutate the shared dev account: the spec deletes its windowed assessments and asserts the attempts cascade (rule 16).

## Decisions in force

- Decided deterministic five-quote inputs (synthetic DOM plus mocked SSE) because they prove the layout with no hint-provider cost and no shared-account residue (2026-10-07).
- Decided CSS-only fix with exact plan values because containment is a styling defect, not a component defect (2026-10-07).
- Decided three-agent fan-out (delegate, thermo-nuclear, impeccable plus a11y) after every coding phase because the task requires fanned-out review gates (2026-10-07).
- Decided `impeccable` Operate refinement because the Marginalia card identity must be preserved (2026-10-07).

## Open

- Merge or PR of branch `project/phase-2` awaits user direction; not requested in this task.
- Re-run `e2e/practice-coach-overflow.spec.ts` on the next coach or guide touch (unclassified transient on record).
