# State - closed-loop-hold-analysis
_Plan: .work/active/closed-loop-hold-analysis/plan/PLAN.md (closed-loop-hold-fix) · Status: active (Phases 1-4 complete: `493e1be`, `2a15115`, `249f6fa`, `5b1f61a`) · Updated: 2026-10-19_

## Current state & next
- Follow-up COMPLETE 2026-10-19, committed `7863aec`: `days_span` now derives from durable material-scoped `SessionLogged.payload.date` instead of local `assessmentAttempts.grade.gradedAt`, because the 4 synth users were graded in one day (all 45 grades on 2026-10-16) while their sessions span 5 weeks. The synthetic replay then returned 4/4 `suggest_replan` (was 4/4 `hold`) and wrote 4 verdict-linked `RoadmapReplanned` events (option `extend-deadline`, exact `verdictId`/`verdictDecidedAt` mirror, synced to cloud). Evidence and caveats in the replay section below.
- Phase 1 COMPLETE 2026-10-19, committed `493e1be`: `LOOP_APPROVE_AT = 0.7` shipped, live-verified; review APPROVE-WITH-FIXES, 3 low all applied.
- Phase 2 COMPLETE 2026-10-19, committed `2a15115`: real `days_span` from local graded-attempt dates + explicit postureSource logged per loop call; TDD, reviewed, verified.
- Phase 3 COMPLETE 2026-10-19, committed `249f6fa`: verdict identity (hash + settle time) -> `/replan` nav handoff -> `RoadmapReplanned` mirror -> extraction exact-pair join with verdict-before-replan, real `option`, legacy rows read as not-converted. Suites green (full app 1278/1278 forks), review APPROVE-WITH-FIXES fully applied (2 high + 2 med + 5 low) and re-verified.
- Phase 4 COMPLETE (test files only) 2026-10-19, committed `5b1f61a`: backend gate brace + live-band pins in `test_loop_decision.py` (18/18), frontend live B-dip input pin in `useLoopDecision.test.ts` (33/33), full app 1279/1279 forks, typecheck + lint + ruff clean. Review APPROVE-WITH-FIXES (2 medium + 4 low) all applied + re-verified.
- All four plan phases complete; no further phase work in this plan. Next: user direction (task wrap vs follow-on report work); the SHA of Phase 4 is recorded by the docs follow-up.
- Probe budget: 1 dry-run + 10 confirmation JEV calls used (cap reached); Phase 3 needed no JEV spend. Ask before further spend.

## Synthetic replay 2026-10-19 (post-fix, live)

- Harness: Playwright, one fresh context per synth user, clock pinned to 2026-10-14 (roadmap deadline 2026-10-15, so the plan is active and posture is real). A local-only `OnboardingCompleted` event was injected to pass `RequireOnboarding`; nothing else was faked. Cloud histories were restored through the normal sync path.
- Inputs now real: `days_span = 32` for all four; posture real (steady behind 13 / pace 0.43, crammer 73 / 0.28, struggling 95 / 0.37, returning 56 / 0.42; `days_left 1`, capacity 6.5 h/week); 16-26 signals.
- Verdicts: all 4 `suggest_replan` (confidence 1.0, sufficiency 0.66-0.77, jev-1.13). Pre-fix they were 4x `hold` at 0.18-0.34 under span0/neutral, so the input fixes (not just the 0.7 gate) opened these states; confidence 1.0 would also clear the old 0.9.
- D-02 join: all four then completed a verdict-triggered replan through the real UI (`/replan`, +1 week, Apply changes). Each `RoadmapReplanned` carries `option: extend-deadline` and the exact mirror pair; `createdAt` is after `decidedAt`, so `verdictTable` converts them. Cloud REST confirms the new events: steady 1, crammer 1, struggling 2 (1 scripted + 1 verdict), returning 2 (1 scripted + 1 verdict).
- Request ids joined: `b6499e4b-f22b-43a9-8bc5-968982579b68`, `c345c8ad-94ed-4f5c-a7e2-f9e5581117bf`, `23674e1b-7ef2-402b-8f60-85ef2255e0ea`, `74a0d053-6216-4343-89bb-725527d2efa5`; all appear in `intelligence.log` (loop decision + request lines).
- Caveats: capture is one day before the deadline with the full 5 weeks of evidence (not a week-3 dip window); the clock pin is a harness device, and the injected onboarding marker is local-only. Verdicts are still rebound-era, not dip-timed.
- Separately observed (pre-existing, not caused by this change): a cold browser restore produced local event duplicates (e.g. struggling local 132 events vs 51 in cloud; material/session/replan rows repeated) while cloud counts stay clean. Extraction should read cloud or dedupe by event identity.

## Done so far
- Follow-up 2026-10-19: replaced `observedGradeDates` with `observedSessionDates` (material-scoped `SessionLogged.payload.date`, strict day parsing unchanged) and added `currentSessionDates` to stop a stale live-query result from a previous roadmap feeding the next POST; section now reads the `kind` index instead of the whole events table. Tests updated (hook 37/37 file, feedback folder 77/77, typecheck + lint clean; full app green at commit time). Review found 1 high (stale-key leak) + 1 perf + 3 comment/test-name issues; all applied.
- Phase 4 implemented 2026-10-19 (test files only, no production change) with mutation-proven pins: `test_loop_decision.py` `test_low_live_confidences_still_hold` gained the live synth sample `("reprioritize", 0.30)` and new `test_gate_floor_bracket_holds_below_the_picked_value` pins `reprioritize 0.6 -> hold` (fails if the gate drops to 0.6); `useLoopDecision.test.ts` gained the live B-dip input pin (4 skills n=2/3/2/3 thin density, three grade dates spanning 21 days, real posture behind_days 3 / pace 0.5) asserting the exact `evidence_summary`, per-signal skill/mastery/observations/trend mapping, posture object, and a single call (fails when span is zeroed, posture is neutered, or trend is dropped).
- Phase 4 review 2026-10-19 (OCR delegate preview/rules scoped to the two files + code-reviewer subagent): APPROVE-WITH-FIXES, 2 medium + 4 low, all applied. The gate-floor brace exists because the boundary test follows `LOOP_APPROVE_AT` itself and cannot catch a silent re-pick.
- Phase 3 implemented 2026-10-19 via TDD (4 slices), reviewed twice, verified. `sync/types.ts` `RoadmapReplannedPayload` + optional `verdictId`/`verdictDecidedAt`; `commitReplan` real `option` (trim-scope > extend-deadline > increase-hours > edit; decreases/restores -> edit) + verdict mirror written only when supplied (stale mirror from the payload spread deleted); `synthExtract` `verdictTable` sorts by `decidedAt` (legacy last) and converts only on the exact mirror pair + `createdAt >= decidedAt`, legacy reads `converted: false`; `useLoopDecision` returns `DecidedLoopVerdict` (verdictId = input hash, decidedAt = settle time, stable across memo hits) and logs one settled line with both keys; section hands the verdict to `/replan` only on `suggest_replan`; Replan validates nav state and forwards it.
- Phase 3 verification 2026-10-19: synthExtract 27/27, commitReplan 15/15, hook 32/32, section 16/16, Replan 16/16, `src/dev/ + src/roadmap/` 244/244 (`--pool=forks`; 2 known `seedTestData` TZ flakes on the default pool), full app 1278/1278 forks, typecheck + lint clean, no direct `console.*`, no em dashes added. Flake chase: the late-verdict section test resolved its manual promise before the hook called (fixed by waiting for the call), stable 6/6 file runs.
- Phase 3 review 2026-10-19 (OCR delegate preview/rules + code-reviewer rounds; one subagent turn degenerated, re-run fresh): round 1 REQUEST_CHANGES (2 high: stale verdict link inherited by a later manual replan; `option` compared the stored onboarding `weeklyHours` chip total against the recalculated schedule; 2 med: unchanged overrides read as trim-scope, `verdictDecidedAt` write-only; 5 low). All applied test-first; fix-verification round confirmed all resolved with no new issues.
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
- Loop path: buildLoopInput + buildLoopPosture (client) -> POST /v1/loop/decision (owner-scoped, fail-closed) -> `route_loop_action` (questions.py:387, `LOOP_APPROVE_AT`) -> verdict stamped with `verdictId`/`decidedAt` (hook) -> feedback copy + preselect -> section hands the pair to `/replan` only on `suggest_replan` -> `commitReplan` mirrors it onto `RoadmapReplanned` with the real `option` -> `verdictTable` orders by `decidedAt` and converts only on the exact mirror pair before the replan.
- Loop input path after Phase 2: local `assessmentAttempts` rows (graded) -> `observedGradeDates` (scope by `grade.materialId` in the roadmap's materials) -> `buildLoopInput` `days_span` (strict date-only span); the hook holds the call while the live query is unresolved (`observedDates === undefined`). `postureSource` is derived in `RoadmapCalendar` (`'real'` iff `projectedFinish`) and logged per fired POST in `useLoopDecision`.
- Gate history: `APPROVE_AT = 0.9` (questions.py:15) was locked for slice-1 suitability and reused by the loop; live loop confidences are 0.18-0.94 with real dips at 0.79-0.85.
- Four synth verdict request_ids (pilot-verdict-6b688c99, p3-crammer-verdict-14055d40, p3-struggling-verdict-a14e0e8f, p3-returning-verdict-067f06ee) captured at the week-5 rebound; they stay `hold` under any gate (confidence 0.18-0.34) - the Phase 2/3 input fixes own those.
- Probe transport: direct `JevClient` calls never reach `intelligence.log`; Phase 1 probes ran through the live endpoint so every request_id joins (rule 17).

## Files affected
- .work/active/closed-loop-hold-analysis/state.md (new, maintained) - task state.
- .work/active/closed-loop-hold-analysis/SCRATCHPAD.md (new, maintained) - session ledger.
- .work/active/closed-loop-hold-analysis/plan/LEDGER.md (new) - bug ledger, unbiased-reviewed.
- .work/active/closed-loop-hold-analysis/plan/PLAN.md (Phase 1-4 Status/Notes updated) - fix plan.
- .work/STATUS.md (row updated per phase).
- apps/app/src/sync/types.ts - `RoadmapReplannedPayload` optional `verdictId`/`verdictDecidedAt` mirrors (Phase 3).
- apps/app/src/roadmap/replan/commitReplan.ts - real `option` derivation + verdict mirror write with stale-mirror delete (`ReplanVerdictLink`) (Phase 3).
- apps/app/src/roadmap/replan/commitReplan.test.ts - option/mirror/stale-link/override tests (Phase 3).
- apps/app/src/dev/synthExtract.ts - `VerdictEntry`/`VerdictRow` `decidedAt`, sort + exact-pair join (Phase 3).
- apps/app/src/dev/synthExtract.test.ts - ordering/join/legacy pins (Phase 3).
- apps/app/src/roadmap/feedback/useLoopDecision.ts - `DecidedLoopVerdict` identity (hash + settle time) + settled log (Phase 3); `observedDates` + `postureSource` (Phase 2); `observedSessionDates` + `currentSessionDates` replace grade-date sourcing (follow-up).
- apps/app/src/roadmap/feedback/useLoopDecision.test.ts - identity/log/recency pins (Phase 3) + span/posture tests (Phase 2) + live B-dip input pin (Phase 4).
- apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx - verdict nav handoff on `suggest_replan` (Phase 3); live grade-date query + posture wiring (Phase 2).
- apps/app/src/roadmap/feedback/RoadmapFeedbackSection.test.tsx - handoff/manual/Keep tests + deflakes (Phase 2/3).
- apps/app/src/pages/Replan.tsx - `readVerdictLink` nav-state reader + `verdict` pass-through (Phase 3).
- apps/app/src/roadmap/replan/Replan.test.tsx - handoff + malformed/manual cases (Phase 3).
- apps/app/src/roadmap/RoadmapCalendar.tsx - `loopPostureSource` from `projectedFinish`, passed to the section (Phase 2).
- apps/app/src/roadmap/RoadmapCalendar.test.tsx - posture source tests (Phase 2).
- services/intelligence/app/jev/questions.py - `LOOP_APPROVE_AT = 0.7` + evidence comment; `route_loop_action` uses it (Phase 1).
- services/intelligence/tests/test_loop_decision.py - dip pass-through, crammer, low-confidence holds, boundary inclusive, suitability isolation (Phase 1) + live-band 0.30 sample and 0.6 gate-floor brace (Phase 4).
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
- `commitReplan` spreads `entry.payload`, which can carry a prior replan's verdict mirror; the else branch deletes `verdictId`/`verdictDecidedAt` so a manual replan never re-emits a stale link.
- The stored onboarding `weeklyHours` is the chip total, not per-day times days; option derivation must recompute current weekly hours via `computeWeeklyHours`.
- The verdict join is an exact pair (`verdictId` + `verdictDecidedAt`) plus `createdAt >= decidedAt`; a verdict merely sharing the input hash with an earlier settlement must not borrow its replan. Legacy entries read with `converted: false`.
- The late-verdict section test must wait for `client.getLoopDecision` to have been called before resolving its manual promise, or the resolution is lost (flake).
- Full app suite on this host has 2 known WSL TZ flakes in `src/dev/seedTestData.test.ts`; rerun that file with `--pool=forks` before calling a red run real (STATUS gotcha).
- The backend boundary test follows `LOOP_APPROVE_AT` itself, so it cannot catch a silent re-pick; the 0.6 hold brace plus the 0.79 dip pin bracket the gate to (0.6, 0.79] and are the drift guard (Phase 4).
- OCR `delegate preview` default-excludes test files (`exclude_reason: default_path`) and includes unrelated dirty files; for test-only phases resolve rules with `ocr delegate rule <paths>` and scope the diff manually (AGENTS.md gotcha).

## Decisions in force
- D-01 (PLAN): loop gets its own confidence constant; suitability keeps `APPROVE_AT = 0.9`. Shipped as `LOOP_APPROVE_AT = 0.7`.
- LOOP_APPROVE_AT = 0.7 chosen 2026-10-19 by the sweep's strictest-perfect-separator rule over N=21 labeled states (gates 0.5-0.7 tie at 0.857); 0.8 rejected because the observed dip minimum is 0.79.
- D-05 (PLAN): BUG-pin tests first, suite stays green throughout.
- Floor `LOOP_EVIDENCE_SUFFICIENT_MIN = 0.5` stays (H1 re-confirmed, perfect band 0.4-0.6).
- D-02 source (user, 2026-10-19): `days_span` comes from local `assessmentAttempts` grade rows scoped by `grade.materialId` to the roadmap's materials, using server-authored `grade.gradedAt`; no Dexie/schema/server change.
- D-03 interpretation (user, 2026-10-19): capture stays on `updated`-entry with the page's real posture; `postureSource` is `'real'` iff a projected finish exists, else `'neutral'`, and is logged per fired POST. No dip-detection heuristic; dip capture timing stays operational.
- D-04 implementation (Phase 3): `verdictId` = canonical loop-input hash, `decidedAt` = settle time, stamped once per memoized promise; the handoff is gated on `suggest_replan`; `option` precedence trim-scope > extend-deadline > increase-hours > edit; conversion requires the exact mirror pair and verdict-before-replan. The runtime chain (hook -> section -> Replan -> commitReplan) is a documented deviation from the plan's Files index (the key must travel at runtime).
- User selected Phase 1, 2, and 3 (2026-10-19), then Phase 4 on a fresh instruction (2026-10-19, this session).

## Open
- All four plan phases complete and committed; the follow-up is committed as `7863aec` (hook 37/37, feedback 77/77, typecheck + lint clean; review APPROVE).
- Local cold-restore duplication observed during the replay (events 2-3x locally; cloud clean). Decision: document as caveat and extract from cloud only (no sync-bug filing this session).
- Live probe budget exhausted; ask before more JEV spend.
