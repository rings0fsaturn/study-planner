# Scratchpad - 2026-07-18-projection-inconsistency

_Plan: `.work/plans/active/2026-07-18-projection-inconsistency/PLAN.md` · Log: `VERIFICATION.md` · Updated: 2026-07-18T23:49+05:30_

## Now

Isolate why the reproduced GP finish says early while the inactivity-aware analytic pace says late.
No source, test, or configuration edits are authorized in this planning and review turn.

## Alignment

The task matches the user's request to reproduce, trace, and plan a faithful fix.
`.work/STATUS.md` already contains a detailed diagnosis row, but its linked canonical task files were absent when the investigation began.
Treat that row as an unverified lead until runtime and source evidence independently corroborate it.

## Open

- Whether the GP needs a Today plateau observation, a conservative analytic guard, or both to represent missed study days faithfully.
- Whether historical `SessionLogged` events outside the active roadmap leak into active-roadmap progress.
- Whether the GP estimate, analytic estimate, or a conservative combination is the product contract for the displayed finish date.

## Blockers

- The `.agents/rules/README.agents.md` router index named by the local `project-rules` skill is absent.
  Select applicable rules from the live `.agents/rules/` filenames and record the missing index as an environment discrepancy, not an app blocker.

## Deferrals

- Implementation is deferred to a coding-agent phase after diagnosis, plan review, and the required Step 0 planning-doc commit.

## Checklist

- [x] Read `.work/README.md` and `.work/STATUS.md`.
- [x] Detect the dangling projection-inconsistency status row and preserve it.
- [x] Read the named `work-journal` and `scratchpad` skills.
- [x] Read the triggered `debug-session`, `project-rules`, and `write-implementation-plan` skills.
- [x] Inspect applicable project rules and live working-tree state.
- [x] Reproduce the three-surface contradiction in the browser.
- [x] Capture the exact persisted events and active-roadmap inputs used by the repro.
- [ ] Trace each displayed value from UI to projection and progress primitives.
- [ ] Prove or reject each root-cause hypothesis with focused executable checks.
- [ ] Write `DIAGNOSIS.md`, `PLAN.md`, and prefilled `VERIFICATION.md`.
- [ ] Reconcile `.work/STATUS.md` against the canonical task files.

## In-flight edits

- This `SCRATCHPAD.md` is the only task artifact created so far.
- The pre-existing `.work/STATUS.md` projection row remains unchanged by this investigation.
- `/private/tmp/study-planner-projection-diagnostic.mjs` is a temporary, out-of-repository browser probe that reads the provided test credentials, visits the three routes, and reads IndexedDB events without writing app data.

## Decisions in force

- Reproduce before proposing a fix.
- Use the live checkout and running app as source of truth.
- Keep diagnostic tests outside source and test files during this planning-only turn.
- Record confirmed facts separately from hypotheses.
- Prefer one authoritative projection contract across Week, Roadmap, and Replan.
- Do not treat reserved study capacity and material work remaining as interchangeable totals.

## Resolved (recent)

- The active-task location is `.work/plans/active/2026-07-18-projection-inconsistency/` and the running-log filename is `VERIFICATION.md`.
- The missing root `MASTER_TRACKER.md` is not a blocker because `.work/README.md` says it was consolidated into `.work/STATUS.md` and `.work/master-tracker-detail.md`.
- Browser authentication succeeded after the local Supabase endpoint became reachable and the diagnostic context ignored its local certificate.
- Live reproduction is exact and console-clean: Week shows `-23h 03m` with `Aug 3-Aug 8`; Roadmap calls the same GP result `2 days early`; Replan says current pace finishes `Aug 22`, 14 days late, while its default capacity result says `Aug 3`, 5 days early.
- The active roadmap has 2,400 material minutes, 1,077 logged minutes, 875 ledger minutes remaining, 2,460 capacity minutes scheduled through 2026-07-18, and 3,630 capacity minutes scheduled through the deadline.
