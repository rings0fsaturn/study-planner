# State - closed-loop-hold-analysis
_Plan: .work/active/closed-loop-hold-analysis/plan/PLAN.md (closed-loop-hold-fix) · Status: active (Phase 1 committed `493e1be`; Phase 2 complete 2026-10-19, SHA recorded in docs follow-up) · Updated: 2026-10-19_

## Current state & next
- Phase 1 COMPLETE 2026-10-19, committed `493e1be`: `LOOP_APPROVE_AT = 0.7` shipped, live-verified; review APPROVE-WITH-FIXES, 3 low all applied.
- Phase 2 COMPLETE 2026-10-19: real `days_span` from local graded-attempt dates + explicit postureSource logged per loop call; TDD, reviewed, verified, committed together with PLAN/state/STATUS/scratchpad (SHA in docs follow-up).
- Next: Phase 3 (verdict timestamp + verdict-to-replan join key, B4/B5) not started, depends on Phase 2; start only on a fresh instruction.
- Probe budget: 1 dry-run + 10 confirmation JEV calls used (cap reached); Phase 2 needed no JEV spend. Ask before further spend.

## Done so far
- Phase 2 implemented 2026-10-19 via TDD: `buildLoopInput` grew a 5th `observedDates` arg; `observedSpanDays` (strict `YYYY-MM-DD` round-trip parse, date-only diff, <2 days -> 0); `observedGradeDates(rows, materialIds)` reads server-authored `grade.gradedAt` from local `assessmentAttempts` scoped by `grade.materialId`; `postureSource` threads `RoadmapCalendar` -> section -> hook and logs one info line per fired POST (`[roadmap-feedback] loop decision firing posture=<src> days_span=<n>`). No Dexie change, no server change.
- Phase 2 review 2026-10-19 (OCR delegate preview/rules + two code-reviewer subagents: correctness/spec and thermo-nuclear): APPROVE-WITH-FIXES. Applied: strict date parse (M1: lenient `Date.parse` rolled `2026`/`2026-02-30` and could fabricate a span), tri-state hold (section passes `undefined` until the live query resolves; the hook fires no POST until dates are loaded), memo-hit log suppression pin, two waitFor-safe section tests, log/doc/comment trims, `materialIdList` memo dedupe. Not applied: restoring the `toEqual` `days_span: 0` pins (plan step 3 asks their removal; dedicated span tests cover it).
- Phase 2 verification 2026-10-19: hook 30/30, `src/roadmap/feedback/` 68/68, `src/roadmap` 161/161, full app 1254/1256 (2 known WSL TZ flakes in `seedTestData.test.ts`, green with `--pool=forks`; STATUS gotcha), typecheck + lint clean, no direct console.* in touched source.
- Analysis session closed 2026-10-19: sweeps 1-9 (plan/LEDGER.md B1-B5, H1-H5, T1, N1-N2), suites green, 6 JEV probes, unbiased-review findings addressed, PLAN.md written.
- Phase 1 implemented 2026-10-19 via TDD: RED 4 failing (live dips 0.82/0.83 held under 0.9; `LOOP_APPROVE_AT` missing) -> GREEN 17/17. `LOOP_APPROVE_AT = 0.7` beside `APPROVE_AT` (`questions.py:15-28`); `route_loop_action` uses it (`questions.py:387`); `route_suitability` untouched (`questions.py:108`). Committed as `493e1be` (7 files: code + tests + task folder + STATUS row); sha recorded in a docs follow-up.
- Rule-80 dry-run PASS (rid `hold-probe-dryrun-thin-9000a129`) then 10 confirmation probes through the live endpoint as `synth-steady` (all rids `hold-probe-*`, all 200, all joined in `intelligence.log`); B-dip samples 0.79-0.85, B2 0.94, E 0.83/0.91, F 0.35/0.37, F2 0.64 (choice hold). Spend ~12.3k input tokens, about $0.0005.
- Sweep (N=21: 11 fresh + 6 analysis + 4 synth; table in PLAN Phase 1 Notes): gates 0.5-0.7 = 0.857 agreement, 0.8 = 0.810, 0.9 = 0.476; pick 0.7 (strictest perfect separator). Honest re-pick: first sweep (N=16) tied 0.5-0.8 and picked 0.8, then a live 0.79 B-dip sample routed hold at 0.8 -> 0.8 sat inside the variance band; 0.7 clears the minimum by 0.09. Floor 0.5 re-confirmed (1.000, band 0.4-0.6), unchanged per H1.
- Live E2E after `./full-app restart intelligence`: final B-dip probe (rid `hold-probe-B-dip-4c4e27f1`) -> choice suggest_replan 0.83/0.72 -> verdict suggest_replan; 4-line log join verified.
- Review 2026-10-19 (OCR delegate + code-reviewer subagent, both files, reviewer re-ran the sweep): APPROVE-WITH-FIXES, 3 low, no higher. Applied: 0.9-gate claim corrected, test BUG-pin comment narrowed, brittle relational assert dropped. Post-fix: loop 17/17, loop+jev 35/35, ruff clean.
- 2026-10-19 USER REVIEW: Phase 1 selected for implementation; N1 threshold sign-off and N2 bounded-spend sign-off granted (at most 10 cheap probe calls). Phases 2-4 remain unstarted.

## Flow trace
- Entry: STATUS row closed-loop-hold-analysis -> state.md (this file) -> plan/LEDGER.md (findings) -> plan/PLAN.md (fix runbook).
- Loop path: buildLoopInput + buildLoopPosture (client) -> POST /v1/loop/decision (owner-scoped, fail-closed) -> `route_loop_action` (questions.py:387, `LOOP_APPROVE_AT`) -> verdict folded into feedback copy -> commitReplan.
- Loop input path after Phase 2: local `assessmentAttempts` rows (graded) -> `observedGradeDates` (scope by `grade.materialId` in the roadmap's materials) -> `buildLoopInput` `days_span` (strict date-only span); the hook holds the call while the live query is unresolved (`observedDates === undefined`). `postureSource` is derived in `RoadmapCalendar` (`'real'` iff `projectedFinish`) and logged per fired POST in `useLoopDecision`.
- Gate history: `APPROVE_AT = 0.9` (questions.py:15) was locked for slice-1 suitability and reused by the loop; live loop confidences are 0.18-0.94 with real dips at 0.79-0.85.
- Four synth verdict request_ids (pilot-verdict-6b688c99, p3-crammer-verdict-14055d40, p3-struggling-verdict-a14e0e8f, p3-returning-verdict-067f06ee) captured at the week-5 rebound; they stay `hold` under any gate (confidence 0.18-0.34) - the Phase 2/3 input fixes own those.
- Probe transport: direct `JevClient` calls never reach `intelligence.log`; Phase 1 probes ran through the live endpoint so every request_id joins (rule 17).

## Files affected
- .work/active/closed-loop-hold-analysis/state.md (new, maintained) - task state.
- .work/active/closed-loop-hold-analysis/SCRATCHPAD.md (new, maintained) - session ledger.
- .work/active/closed-loop-hold-analysis/plan/LEDGER.md (new) - bug ledger, unbiased-reviewed.
- .work/active/closed-loop-hold-analysis/plan/PLAN.md (Phase 1 + Phase 2 Status/Notes updated) - fix plan.
- .work/STATUS.md (row updated per phase).
- apps/app/src/roadmap/feedback/useLoopDecision.ts - `observedDates` arg + `observedGradeDates` + strict `observedSpanDays`; `postureSource` log per fired POST (Phase 2).
- apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx - read-only live query over `assessmentAttempts`, tri-state `observedDates`, `postureSource` prop, `materialIdList` memo (Phase 2).
- apps/app/src/roadmap/RoadmapCalendar.tsx - `loopPostureSource` from `projectedFinish`, passed to the section (Phase 2).
- apps/app/src/roadmap/feedback/useLoopDecision.test.ts + RoadmapFeedbackSection.test.tsx + RoadmapCalendar.test.tsx - span/posture/race tests and waitFor fixes (Phase 2).
- services/intelligence/app/jev/questions.py - `LOOP_APPROVE_AT = 0.7` + evidence comment; `route_loop_action` uses it (uncommitted).
- services/intelligence/tests/test_loop_decision.py - 5 new tests: dip pass-through 0.79/0.82/0.85, crammer 0.83, low-confidence holds, boundary inclusive, suitability isolation (uncommitted).
- /tmp/opencode/loop_phase1_probes.py + loop_phase1_sweep.py + results JSONs (outside repo, print no secrets).

## Pitfalls & rules
- Never print, commit, or copy test credentials or service keys.
- No Dexie migrations; no seed/backdoor endpoints (ADR-0001 stands); no BKT re-tune.
- Rule 80: one dry-run JEV call first; probe budget reached (1 + 10). Stop and ask before more spend (N2).
- JEV probabilities move about 0.08 run to run: never pick a gate that sits inside an observed variance band (the 0.8 pick was falsified by a 0.79 live sample).
- TDD per fix: failing dip-shape test first; keep the suite green (BUG-pin current behavior until the constant lands).
- No em dashes in files.
- Log every request_id and join it to intelligence logs (rule 17); direct-client probes do NOT appear in `intelligence.log`, so probe through the endpoint.
- Probes need the managed runtime (`./full-app start full`); stop it when done (rule 10) and keep the sidecar demand-stopped (rule 54).
- Run loop tests from `services/intelligence/` with `uv run pytest tests/test_loop_decision.py -q`.
- `Date.parse` is lenient: `2026` parses as Jan 1 and `2026-02-30` rolls to Mar 2. Any date taken from rows/events must pass the strict `YYYY-MM-DD` round-trip before it may shape `days_span`.
- The `observedDates` tri-state is load-bearing: `undefined` = local rows not loaded, so the hook must not fire; `[]` = loaded with nothing graded (span 0). Do not coerce `undefined` to `[]` in the section.
- The section's new live query resolves after the mastery fetch can settle; section tests that read a verdict must `waitFor`, not read once.
- Full app suite on this host has 2 known WSL TZ flakes in `src/dev/seedTestData.test.ts`; rerun that file with `--pool=forks` before calling a red run real (STATUS gotcha).

## Decisions in force
- D-01 (PLAN): loop gets its own confidence constant; suitability keeps `APPROVE_AT = 0.9`. Shipped as `LOOP_APPROVE_AT = 0.7`.
- LOOP_APPROVE_AT = 0.7 chosen 2026-10-19 by the sweep's strictest-perfect-separator rule over N=21 labeled states (gates 0.5-0.7 tie at 0.857); 0.8 rejected because the observed dip minimum is 0.79.
- D-05 (PLAN): BUG-pin tests first, suite stays green throughout.
- Floor `LOOP_EVIDENCE_SUFFICIENT_MIN = 0.5` stays (H1 re-confirmed, perfect band 0.4-0.6).
- D-02 source (user, 2026-10-19): `days_span` comes from local `assessmentAttempts` grade rows scoped by `grade.materialId` to the roadmap's materials, using server-authored `grade.gradedAt`; no Dexie/schema/server change.
- D-03 interpretation (user, 2026-10-19): capture stays on `updated`-entry with the page's real posture; `postureSource` is `'real'` iff a projected finish exists, else `'neutral'`, and is logged per fired POST. No dip-detection heuristic; dip capture timing stays operational and the timestamp/join work is Phase 3.
- User selected Phase 1 (2026-10-19) and then Phase 2 (2026-10-19); do not start Phases 3-4 without a fresh instruction.

## Open
- Phase 2 commit SHA pending the docs follow-up commit (this session).
- Phases 3-4 not started (Phase 3 depends on Phase 2, now complete).
- Live probe budget exhausted; ask before more JEV spend.
