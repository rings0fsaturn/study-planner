# State - synthetic-users-seeding
_Status: active (Phases 2-4 committed as 9f7d08e 2026-10-16; report assembly next) · Updated: 2026-10-16_

## Current state & next
- Post-fix replay 2026-10-19 (after closed-loop-hold-analysis follow-up): **4/4 `suggest_replan` and 4/4 verdict-triggered `RoadmapReplanned` conversions** (was 4/4 `hold`, 0 conversions). Live inputs: `days_span 32`, real posture (behind 13-95 days, pace 0.28-0.43), 16-26 signals; confidence 1.0, sufficiency 0.66-0.77 (jev-1.13). All four replans carry `option: extend-deadline` plus the exact `verdictId`/`verdictDecidedAt` mirror and are synced to cloud (steady 1, crammer 1, struggling 2 incl. 1 scripted, returning 2 incl. 1 scripted). The D-02 proof now exists in the data.
- Replay harness caveats: Playwright clock pinned to 2026-10-14 so the 2026-10-15 deadline roadmap is active; a local-only `OnboardingCompleted` event passed the route gate; no cloud history was rewritten. Capture is one day before deadline with all 5 weeks of evidence, not a week-3 dip window.
- Phase 1 complete + reviewed 2026-10-16 (builder + 5 contract tests + DevSeeder hooks, review APPROVE-WITH-FIXES with 6 fixes applied, post-fix verification green; committed as `913b527`).
- Phase 2 code half done + reviewed 2026-10-16, committed as `9f7d08e` (synthDriver.ts + 23 tests after second review: APPROVE-WITH-FIXES, 4 med + 4 low applied test-first, post-fix 23/23 + src/dev/ 30/30 + typecheck green).
- Dry-run PASS 2026-10-16 (approved spend): all 4 TEST USERs exist (no provisioning); steady sign-in/insert/ingest-ready-1-chunk/generate/submit/grade all green, request-id join verified; caught + fixed missing recipe difficulty (GradeScript.difficulty default 3, 15/15 green).
- Retro follow-ups done 2026-10-16: contract-drift ticket filed as rings0fsaturn/study-planner#82; rule 42 + PLAN.md step-2 sketch now point at `_validate_recipe` as the recipe-shape ground truth.
- Phase 4 DONE 2026-10-16, committed as `9f7d08e`: synthExtract.ts + 22 tests via packages only + traceability gate, review APPROVE-WITH-FIXES (3 med + 8 low applied test-first), post-fix green (synthExtract 22/22, src/dev/ 61/61, typecheck + lint clean); at the time the data was honest holds (4x hold verdicts, 0 conversions, D-02 proof absent) - superseded by the 2026-10-19 post-fix replay above; live artifact emission deferred to report assembly.
- Next: report assembly (full package-based table emission against server reads, then prose drafting as a later task). Pre-fix `plan/evidence/synthetic-users-results.html` is now bannered superseded; `synthetic-users-results-2026-10-19-postfix.json/.html` carry the post-fix facts. Runtime stopped after the replay.

## Done so far
- Grill 2026-10-16 locked 8 decisions (claims, loop + proof, 4 archetypes, 5x4 matrix N>=160, live-USER boundary, shared React set, accounts, hygiene); see plan/DECISIONS.md.
- Correction logged in planning: materials are owner-scoped, so the shared set ingests x4 (PLAN.md D-06).
- Sanity sweep resolved 5 live gaps (scripted submits, steady pilot, Logged-only sessions, SYNTH_* env, task-dir plan location).
- PLAN.md written with verbatim preamble, 4 vertical slices, decisions D-01..D-10, 0 open questions.
- ADR-0001 recorded for the no-backdoor boundary.
- Credential hygiene repaired: .gitignore forward-slash pattern, cred file untracked, working-tree secrets preserved (staged, uncommitted).
- Phase 1 done 2026-10-16: apps/app/src/dev/synthSeed.ts (pure ARCHETYPES builder, 20 bookings, Logged-only sessions, 1 run-pair/week, zero graded) + synthSeed.test.ts (plan-verbatim 3 contract tests, red-then-green) + DevSeeder.tsx __seedSynth/__wipeSynth hooks; DONE verification green (synthSeed 3/3, src/dev/ 5/5, typecheck clean, no console.*), pre-review.
- Phase 1 review 2026-10-16 (code-reviewer subagent via open-code-review-delegate): verdict APPROVE-WITH-FIXES, 3/3 files covered, payload shapes + rules 17/30/31 clean; 6 fixes applied (entry guards + walk cap, DevSeeder try/catch + logger.error, D-07 zero-graded/run-count test pins, explicit material-miss throw, determinism comment, past-gated run emission); post-fix green (synthSeed 5/5, src/dev/ 7/7, typecheck clean, no console.*); committed as `913b527`.
- Phase 2 code half done 2026-10-16 via TDD slices (objective tracer -> written/coding routing -> mixed-week lock-in -> ingestSharedSet -> failure lock-ins): apps/app/src/dev/synthDriver.ts (ingestSharedSet + runGradedWeek, DI-only, sequential one-family calls, answerFor override seam) + synthDriver.test.ts (14 tests on reused FakeAssessmentClient/FakeMaterialClient, zero live calls).
- Phase 2 review 2026-10-16 (code-reviewer subagent, ocr delegate): verdict APPROVE-WITH-FIXES; 9 fixes applied (failure-path log lines, answerFor override, server warning reason, corrected sequential comment, generating-exhaustion timeout, partial-week warn, per-material requestId, validate-file-before-create, submit pass-through test); post-fix green (synthDriver 14/14, src/dev/ 21/21 under forks, typecheck clean, no console.*); uncommitted.
- Pilot PASS 2026-10-16 (approved spend, secret-safe /tmp scripts): ingest x3 ready (book 422 / talk 167 / article 15 chunks); study-half LOCAL 53 events (19 logged, 5 runs, 1 roadmap), CLOUD 0 (sync-gap discovery); 5 weekly runs attempted 12 graded 12 (coding self-check 3/5 honest terminals w1-3, judge0 grades w4-5); mastery 10/8/9 rows; loop verdict hold (jev-1.13, log join verified); full app suite 1213 green; Phase 2 code 23/23 + typecheck green, all uncommitted.
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
- apps/app/src/dev/synthDriver.ts - Phase 2 live driver, ingestSharedSet + runGradedWeek (new, committed 9f7d08e).
- apps/app/src/dev/synthDriver.test.ts - Phase 2 driver tests, 23 fake-client tests (new, committed 9f7d08e).
- apps/app/src/dev/synthSeed.ts - Phase 3 replan param + RoadmapReplanned emission (modified, committed 9f7d08e).
- apps/app/src/dev/synthSeed.test.ts - Phase 3 replan tests, 11 total (modified, committed 9f7d08e).
- apps/app/src/dev/DevSeeder.tsx - Phase 3 sync-gap fix: logEvent loop + fallback + wipe drain (modified, committed 9f7d08e).
- apps/app/src/dev/DevSeeder.test.tsx - Phase 3 provider tests, 4 tests (new, committed 9f7d08e).
- apps/app/src/sync/SyncProvider.tsx - useOptionalSyncContext export (modified, committed 9f7d08e).
- apps/app/src/App.tsx - DevSeeder moved inside SyncRouter (modified, committed 9f7d08e).
- .work/active/synthetic-users-seeding/plan/PLAN.md - Phase 2 + Phase 3 + Phase 4 Status + Notes recorded (modified, committed 9f7d08e).
- apps/app/src/dev/synthExtract.ts - Phase 4 table/figure extraction through packages only + traceability gate (new, committed 9f7d08e).
- apps/app/src/dev/synthExtract.test.ts - Phase 4 tests, 22 (new, committed 9f7d08e).

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
- Report assembly follow-up: full `plan/evidence/` table emission via Phase 4 functions still runs at report assembly against live reads (needs runtime + server attempt records); the post-fix facts are already recorded in `synthetic-users-results-2026-10-19-postfix.json/.html`. Report prose drafting is a later task. The replay added new cloud `RoadmapReplanned` events and `SessionBooked` rows (25 per user after replan), so the extraction snapshot must be taken after 2026-10-19.
- Observed during replay (pre-existing, not this task): a cold browser restore duplicated local events (struggling local 132 vs 51 cloud) while cloud counts stayed clean. Decision: document as caveat and extract from cloud only (no sync-bug filing this session).
- Pre-existing backend failure (observed 2026-10-16, not this task): tests/test_v1_integration.py golden mismatch on compute-calibration globalMultiplier (0.9030 vs golden 0.8993); fails deterministically at file level with varying counts under full-suite load. Frontend-only task diff cannot influence it; needs a backend owner (possible parallel-lane drift).
- Follow-up (found, not changed): EventStore.wipe() clears events but not sync_queue - decide if production wipe should drain the queue or DEV-only drain stands.
- Rotate the first-two account passwords when convenient (bytes once sat in a tracked file).
