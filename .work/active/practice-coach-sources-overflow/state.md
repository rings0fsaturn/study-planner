# State - practice-coach-sources-overflow

_Spec: specs/issues/practice-coach-sources-overflow.md · Plan: active/practice-coach-sources-overflow/plan/PLAN.md · STATUS row: practice-coach-sources-overflow · Status: active · Updated: 2026-10-07_

## Current state & next

- Work journal opened 2026-10-07 with spec, plan, and STATUS row in place.
- Root cause located in code: uncapped `.coach` card and citations list (`practiceCoach.css:6-19,102-150`, disclosure at `PracticeCoach.tsx:103-116`).
- Fresh-session open of the reporter's URL redirects to sign-in as expected (run is per-user Dexie state).
- Next: execute plan Phase 0 (authenticated reproduce and measure with `playwright-cli`).

## Done so far

- Read STATUS, runtime/E2E/selector/basename/playwright-cli/generation rules, and the live coach plus practice-run code.
- Confirmed managed runtime healthy (`intelligence`, `app`, `worker`, `sidecar`, `piston`).
- Wrote bug contract, phased plan with per-phase skills and fan-out reviews, and this state doc.

## Flow trace

1. `I'm stuck` calls `guide.ask` (`PracticeRun.tsx:504-513`).
2. Accept streams the hint tier via `usePracticeGuide` (`usePracticeGuide.ts:237-243`).
3. Citations render in native `<details class="coach-citations">` (`PracticeCoach.tsx:103-116`).
4. Card and list grow unbounded (`practiceCoach.css:6-19,102-150`), pushing controls out of reach.

## Files affected

- .work/specs/issues/practice-coach-sources-overflow.md - created - stable bug contract.
- .work/active/practice-coach-sources-overflow/plan/PLAN.md - created - phased plan with skills and fan-out reviews.
- None of the product files touched yet.

## Pitfalls & rules

- Must reproduce with a fresh run on the dev account because the reported runId is per-device Dexie state (rule 30).
- Must keep native `<details>` collapse and not add a component or dependency (ponytail ladder).
- Must not change generation, grading, gate, or pointer contracts (rule 42).
- Must restart the managed runtime after CSS edits before browser proof (rule 53).

## Decisions in force

- Decided task-id `practice-coach-sources-overflow` because it matches the kebab style already in `active/` (2026-10-07).
- Decided fan-out of three parallel `code-reviewer` agents (delegate lens, thermo-nuclear lens, impeccable plus a11y lens) after every coding phase because the user explicitly required fanned-out review gates (2026-10-07).
- Decided `impeccable` runs in Operate refinement mode because the Marginalia card identity must be preserved (2026-10-07).

## Open

- Authenticated Phase 0 reproduction with measurements and screenshots.
- R1, R2, R3 fan-out reviews pending their phases.
