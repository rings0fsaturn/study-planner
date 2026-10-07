# Scratchpad - practice-coach-sources-overflow · session 2026-10-07

_state.md: active/practice-coach-sources-overflow/state.md · Updated: 2026-10-07T02:17_

## Now / Next

- Doing: Phase 1 red done; running R1 fan-out review of the test diff.
- Next: Collect three reviewer verdicts into plan/REVIEWS.md; fix findings in Phase 1; then Phase 2.
- Blocked: none.

## Session log

- 01:55 FOUND  coach sources disclosure is native details at PracticeCoach.tsx:103-116 with uncapped list styling at practiceCoach.css:137-143.
- 01:56 FOUND  fresh playwright-cli open of the reporter URL redirects to /study/sign-in because the run pointer is per-user Dexie state (PracticeRun.tsx:87-90).
- 01:57 DECIDED task-id practice-coach-sources-overflow because it matches the kebab style in active/.
- 01:58 DECIDED three-agent fan-out (delegate, thermo-nuclear, impeccable plus a11y) after every coding phase because the user explicitly required it.
- 01:59 EDIT   .work/specs/issues/practice-coach-sources-overflow.md - created bug contract - UNVERIFIED.
- 01:59 EDIT   .work/active/practice-coach-sources-overflow/plan/PLAN.md - created phased plan - UNVERIFIED.
- 02:00 NEXT   Run Phase 0 authenticated reproduction and record measurements in plan/evidence/.
- 02:12 FOUND  all five managed deps healthy (intelligence, app, sidecar :8200, piston :2000, worker) plus sign-in page renders at 1280.
- 02:13 DECIDED deterministic five-quote injection with the real practiceCoach.css from disk instead of a live run because it proves the same uncapped layout with no provider cost and no shared-account cleanup.
- 02:14 FOUND  1280x720 open: coach top -117 bottom 632 height 749 (max-height none, overflow visible), ul 560px with overflow-y visible and scrollHeight == clientHeight, dismiss x off-viewport.
- 02:14 FOUND  375x812 open: coach top -151 height 888 (viewport 812), ul 669px uncapped, dismiss x off-viewport.
- 02:15 FOUND  1280 collapsed contrast: coach height 181 fully in viewport, so the open disclosure alone causes the overflow.
- 02:16 EDIT   plan/evidence/measurements.md plus coach-open-1280.png, coach-open-375.png, coach-collapsed-1280.png - created - VERIFIED (Phase 0 exit gate passes).
- 02:17 DONE   Phase 0 reproduce and measure at both viewports with screenshots.
- 02:17 NEXT   Phase 1 failing assertions in PracticeCoach.test.tsx plus Playwright regression check.
- 02:21 EDIT   apps/app/src/guide/PracticeCoach.test.tsx - one red test (five long quotes, real ?raw stylesheet, computed containment plus pointer toggle) - UNVERIFIED.
- 02:21 FOUND  jsdom toggles native details on summary click and resolves author-stylesheet computed styles, so the red test is honest: fails on overflowY visible, want auto.
- 02:30 EDIT   e2e/practice-coach-overflow.spec.ts - live-gated 1280 plus 375 regression check (mocked 5-quote SSE, real run page) - UNVERIFIED.
- 02:31 FOUND  summary exposes no button role in Chromium a11y, so the spec uses the scoped user-visible label getByText 5 sources instead (rule 11: role first, documented fallback).
- 02:33 FOUND  desktop check RED for the right reason: card top escapes the viewport with five quotes open (expectContainedCard box.y).
- 02:33 DONE   Phase 1 red assertions (unit overflowY plus e2e viewport containment).
- 02:33 NEXT   R1 fan-out review of the Phase 1 test diff; no Phase 2 until APPROVE.
