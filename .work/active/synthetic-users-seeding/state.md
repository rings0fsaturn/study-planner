# State - synthetic-users-seeding
_Spec: .work/active/synthetic-users-seeding/plan/DECISIONS.md · Plan: .work/active/synthetic-users-seeding/plan/PLAN.md · STATUS row: synthetic-users-seeding · Status: active · Updated: 2026-10-16_

## Current state & next
- Phase 1 complete + reviewed 2026-10-16 (builder + 5 contract tests + DevSeeder hooks, review APPROVE-WITH-FIXES with 6 fixes applied, post-fix verification green; committed as `913b527`).
- Next: Phase 2 steady live pilot - needs SYNTH_STEADY_* env, generation/grading budget sign-off, rule-80 dry-run first.

## Done so far
- Grill 2026-10-16 locked 8 decisions (claims, loop + proof, 4 archetypes, 5x4 matrix N>=160, live-USER boundary, shared React set, accounts, hygiene); see plan/DECISIONS.md.
- Correction logged in planning: materials are owner-scoped, so the shared set ingests x4 (PLAN.md D-06).
- Sanity sweep resolved 5 live gaps (scripted submits, steady pilot, Logged-only sessions, SYNTH_* env, task-dir plan location).
- PLAN.md written with verbatim preamble, 4 vertical slices, decisions D-01..D-10, 0 open questions.
- ADR-0001 recorded for the no-backdoor boundary.
- Credential hygiene repaired: .gitignore forward-slash pattern, cred file untracked, working-tree secrets preserved (staged, uncommitted).
- Phase 1 done 2026-10-16: apps/app/src/dev/synthSeed.ts (pure ARCHETYPES builder, 20 bookings, Logged-only sessions, 1 run-pair/week, zero graded) + synthSeed.test.ts (plan-verbatim 3 contract tests, red-then-green) + DevSeeder.tsx __seedSynth/__wipeSynth hooks; DONE verification green (synthSeed 3/3, src/dev/ 5/5, typecheck clean, no console.*), pre-review.
- Phase 1 review 2026-10-16 (code-reviewer subagent via open-code-review-delegate): verdict APPROVE-WITH-FIXES, 3/3 files covered, payload shapes + rules 17/30/31 clean; 6 fixes applied (entry guards + walk cap, DevSeeder try/catch + logger.error, D-07 zero-graded/run-count test pins, explicit material-miss throw, determinism comment, past-gated run emission); post-fix green (synthSeed 5/5, src/dev/ 7/7, typecheck clean, no console.*); committed as `913b527`.
- Provisioning script kept at /tmp/opencode/provision_synth_users.py (outside repo, prints no secrets).

## Flow trace
1. Entry path: STATUS.md row synthetic-users-seeding -> state.md (this file) -> plan/DECISIONS.md -> plan/PLAN.md -> docs/adr/0001.
2. Phase 1 implements plan/PLAN.md Phase 1 only; later phases assume earlier ones complete.
3. Seeding seam to extend: apps/app/src/dev/seedTestData.ts (pure builder pattern) + DevSeeder.tsx (test-only window hooks).
4. synthSeed builder trace: ARCHETYPES params -> MaterialAdded x3 (anchor/foundation/practice) -> RoadmapCreated no-slot -> 20 SessionBooked (Mon/Wed/Fri/Sat walk) -> SessionLogged for past non-gap bookings per pace/skip (source active, bookingId linked) -> PracticeRunStarted/Finished per non-gap week (rotating written/coding/mixed) -> sorted by createdAt; observed counts (2026-08-10 start): steady 19/5, crammer 10/5, struggling 10/5, returning 11/3 logged/runs, 0 graded.
5. Review via `ocr delegate preview|rule` + code-reviewer subagent; `preview` default-excludes *.test.* (default_path), so pass test files to `rule` and the reviewer explicitly for TDD phases.

## Files affected
- .work/active/synthetic-users-seeding/plan/DECISIONS.md - grill contract (staged).
- .work/active/synthetic-users-seeding/plan/PLAN.md - 4-phase runbook (staged).
- .work/active/synthetic-users-seeding/docs/adr/0001-live-test-user-emulation-boundary.md - boundary ADR (staged).
- .gitignore - cred-file pattern fix (staged).
- /tmp/opencode/provision_synth_users.py - provisioning script, prints no secrets (outside repo).
- apps/app/src/dev/synthSeed.ts - Phase 1 pure history builder (new, committed with Phase 1).
- apps/app/src/dev/synthSeed.test.ts - Phase 1 contract tests, 3 plan-verbatim + 2 review pins (new, committed with Phase 1).
- apps/app/src/dev/DevSeeder.tsx - added test-only __seedSynth/__wipeSynth with error logging (modified, committed with Phase 1).

## Pitfalls & rules
- Must never print, commit, or copy test credentials or service keys (AGENTS.md env rules).
- Must use logger, never console.*, in apps/app/src (rule 17); mint X-Request-ID per logical call.
- Must keep product behavior unchanged; a parallel loop-quality lane works in the same checkout (unexplained index reset observed 2026-10-16).
- Must reuse existing event kinds only; no Dexie migration (rule 31).
- Must run a rule-80 dry-run before any full ingest/generation spend; stop the sidecar when idle (rule 54).
- Run synthSeed tests with --pool=forks if TZ flakes, same as seedTestData.test.ts (default pool failed live 2026-10-16, forks green).

## Decisions in force
- All load-bearing choices live in plan/DECISIONS.md D1..D9 + plan/PLAN.md D-01..D-10 (2026-10-16).
- Pilot-first sequencing: steady live pilot (Phase 2) gates the other three archetypes (2026-10-16).

## Open
- New session needs SYNTH_* env vars for the 4 TEST USERs (passwords stay out of git).
- Steady pilot needs generation/grading budget sign-off at run time (dry-run first per rule 80).
- Phase 3 must reconcile the D-04 N>=160 gate: study-half sums to ~50 logged with locked skip params (see plan/PLAN.md Phase 3 Notes); do not re-plan silently, surface the decision.
- Rotate the first-two account passwords when convenient (bytes once sat in a tracked file).
