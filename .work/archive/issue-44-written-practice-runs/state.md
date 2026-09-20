# State - issue-44-written-practice-runs

_Spec: GitHub [#44](https://github.com/rings0fsaturn/study-planner/issues/44) (copy: specs/phase2-tickets/12-written-practice-runs.md) · Plan: active/issue-44-written-practice-runs/plan/PLAN.md · STATUS row: issue-44-written-practice-runs · Status: done - P0-P6 complete, AC1-AC4 all ticked; #44 closed and archived 2026-09-20 · Updated: 2026-09-20_

## Current state & next

- **P0-P4 done 2026-09-15** (`88fefe9` tip; PR #65 merged into `project/phase-2` as `3844f72`, 2026-09-16).
- **P6 done 2026-09-20** - AC3 closed after #43 landed: mastery refresh on every new grade, summary advisory, shared band reader. `e2e/practice-mastery-live.spec.ts` 4/4, `practice-run-live.spec.ts` 2/2, focused 80/80, full suite 918/920 (2 documented WSL TZ flakes), typecheck/lint clean.
- **P5 done 2026-09-20** - 5-problem measurement recorded (two samples: first problem 15.8 s / 40.2 s, 0 quota errors); gate not breached, N single-material calls stay.
- **Worker robustness fix 2026-09-20** (surfaced by the live run): terminal queue messages are archived instead of redelivered forever, in both generation and grading arms.
- 2026-09-20: wayfinder exit done - AC3 ticked on #44, resolution comment posted (issuecomment-5748414255), #44 closed, map #4 line appended, STATUS row flipped to Done, folder archived.

## Done so far

- 2026-09-13/14: plan drafted and amended (D-01-D-12, P0-P5, AC map, open questions answered).
- 2026-09-15: **P0** PR #64 merged (`8f04d0d`, carried #41/#62/#63 - mandatory, #44 was unbuildable without the #41 commits); branch cut; ticket claimed. **P1** real grounded generation + run pointer (16 tests). **P2** multi-material round-robin (`a9ce527`) + run shell (`7aa209d`, `40607d1`): `practiceRunModel`, `PracticeRun`, nested route, `AnswerSlot` reuse. **P3** prototype judged → Variant A review rail + inline retry; `PracticeSummary`; retry-mode hydrate fix. **P4** `e2e/practice-run-live.spec.ts` 2/2 (3.4 min), AC1/AC2/AC4 ticked, AC3 deferred to #43, cleanup hardened to window-scoped service-role delete. Commits `ed28491` + `e0274f8`.
- 2026-09-16: PR #65 merged into `project/phase-2`.
- 2026-09-20: **P6** AC3 delivery - `masteryBands.ts` shared reader (+6 tests), `PracticeThis` refactor onto it, `PracticeRun` refresh effect, `PracticeSummary` `AdaptiveAdvisory`, `practice.css`, fake-client cold-start default. **P5** measurement. **Worker fix** in `generation/worker.py` + `grading/worker.py` (+2/+2 tests). Live: `practice-mastery-live.spec.ts` 4/4 (desktop 90→92, phone 90→91 observations; abandoned zero rows/unmoved mastery; P5), no-regression 2/2; account verified clean; sidecar stopped.

## Flow trace

1. Routes: `App.tsx` → `pages/materials/PracticeThis.tsx` (config + generation + pointer); `App.tsx` → `pages/practice/PracticeRun.tsx` (the run); `PracticeSummary.tsx` (completion view).
2. Generation precedent: `pages/assessments/AssessmentConfig.tsx` (`generateAssessment` → pointer → navigate); polling + hydration in `pages/assessments/AssessmentDetail.tsx`.
3. Attempts: `assessments/attemptFlow.ts` (local row keyed by `clientAttemptId`, answer-free `QuestionAttempted`, `QuestionGraded` carries the grade); UI `AttemptTaker.tsx`; review `review/ReviewSurface.tsx`.
4. Server: `len(material_ids) != 1` and `questionCount != 1` gates in `services/intelligence/app/routers/assessments.py`; `/v1/mastery` rebuilt statelessly from `question_attempts.grade.perSkill[]` (`routers/mastery.py`).
5. **Mastery refresh (new):** `PracticeRun.tsx` counts graded local rows; when the count changes it calls `getMastery()` → `saveMasteryProjections` (Dexie v7 `masteryCache`) → `mastery` state → `PracticeSummary` advisory. The band reader is `assessments/masteryBands.ts` (`bandGuidanceByMaterial`), shared with `PracticeThis`; `recommendBand` lives in `packages/progress`.
6. **Queue failure classification (new):** `generation/worker.py` `run_once` and `grading/worker.py` `run_once` archive a message on a non-retryable `IngestionError` or `read_ct >= max_deliveries` (3); retryable storage faults redeliver. The ingestion worker's `_drain` is the original precedent.
7. No `questionIds` at Start (D-02): resolved lazily from the loaded assessments; per-problem material attribution is `materialIds[i % M]` overridden by the server's `question.materialId`.

## Files affected

- `.work/active/issue-44-written-practice-runs/` - plan, VERIFICATION, state, scratchpad, evidence.
- `apps/app/src/sync/types.ts` - run pointer payloads (P1).
- `apps/app/src/events/EventStore.ts` - `PRACTICE_RUN_STARTED` / `PRACTICE_RUN_FINISHED`.
- `apps/app/src/pages/materials/PracticeThis.tsx` (+ test) - generation, round-robin, band reader.
- `apps/app/src/pages/practice/` - `practiceRunModel.ts`, `PracticeRun.tsx`, `PracticeSummary.tsx`, `practice.css` (+ tests).
- `apps/app/src/prototype/practice-summary/` - throwaway prototype (dev-gated).
- `apps/app/src/pages/assessments/AssessmentDetail.tsx` - `AnswerSlot` export.
- `apps/app/src/pages/assessments/review/ReviewSurface.tsx` - primitive reuse (no fork).
- **New 2026-09-20:** `apps/app/src/assessments/masteryBands.ts` (+ test).
- **New 2026-09-20:** `e2e/practice-mastery-live.spec.ts`.
- **Fixed 2026-09-20:** `services/intelligence/app/generation/worker.py`, `services/intelligence/app/grading/worker.py`, `services/intelligence/tests/test_generation_worker.py`, `services/intelligence/tests/test_grading_worker.py`.
- `e2e/practice-run-live.spec.ts` - durable Phase 4 spec.

## Pitfalls & rules

- The practice config's Focus/Difficulty chips are display vocabulary: `recipe.formats` takes one format; `Adaptive` is a client mastery concept, not a generation input.
- One material per generation call (server gate); round-robin across the run's N calls is fine and shipped (D-10).
- `questionCount` is capped at 1 server-side, so an N-problem run is N calls (D-06) - P5 measured this and left it alone.
- Coding/Mixed stay disabled until #45; no `AssessmentCreated` for practice generations (D-11).
- `useEventStore` throws on first render under `EventStoreProvider` - use `useEventStoreContext` and guard (the `AssessmentDetail` seam).
- Reuse `AnswerSlot` for a one-question surface; never mount `AttemptTaker` bare.
- Live generation needs the detached worker (now in `./full-app` `full`) **and** the GPU sidecar on `:8200` (demand-started, rule 54).
- **A queue message whose target row is deleted must be archived, never retried** - `pgmq.set_vt(..., 0)` on a terminal error loops forever and, with `max_in_flight=1`, head-of-line blocks the whole arm (observed: `read_ct` 276, phone scenario stalled 300 s).
- The mastery advisory never re-runs BKT client-side and never touches pinned roadmap decisions (map #4 #15); it is absent, not wrong, when the mastery fetch fails.
- Live specs clean by **window** (`material_id` + `created_at >= test start`), not the response log; the window can delete an in-flight generation, which is exactly what exercised the worker fix.
- Vitest: `pnpm --filter app test <path>`; an extra `--run` makes vitest treat the path as a name filter. The 2 `seedTestData` failures are the WSL TZ flake and pass under `--pool=forks`.
- WSL/drvfs staleness (rule 53): restart the app and hard-reload before judging frontend changes.

## Decisions in force

- 2026-09-15 (P3, user-judged): the run summary is **Variant A - the review rail** with **inline retry**; abandoned runs get no summary.
- 2026-09-15: the summary lists only problems with a terminal outcome (`problemStatus`, `isSummaryEligible`).
- 2026-09-13 (D-01): this slice does not build `/v1/practice-runs` or a `practice_runs` table; it reuses the assessment generation + attempt + grading path.
- 2026-09-14 (D-02): thin local pointer events with a client-minted `runId`; `questionIds` absent; same-device resume only.
- 2026-09-13 (D-03): route `/materials/:materialId/practice/:runId`, no `/study` prefix.
- 2026-09-14 (D-04): reuse the review primitives, never `ReviewSurface`; one reconnect drain in the shell.
- 2026-09-14 (D-06): a run is N single-material `generateAssessment` calls bounded 2 at a time. P5 re-affirmed 2026-09-20 after the measurement.
- 2026-09-15 (D-10 amend): multi-material **distribution** ships as round-robin; (D-12) multi-material **synthesis** is out of scope.
- 2026-09-14 (D-11): practice skips `AssessmentCreated`; pause is leave-and-return; neither finish nor abandon invents an observation.
- 2026-09-20 (user): **full adaptive wiring** - the run refreshes mastery on every grade and the summary advises the next-run band; the band reader is shared and advisory-only.
- 2026-09-20: **P5 stays unbuilt** - the 5-problem gate is not breached (recorded in VERIFICATION.md).
- 2026-09-20: **terminal queue messages are archived** after a non-retryable error or the delivery cap (generation + grading), matching the ingestion worker's precedent.

## Open

- **7 pre-existing intelligence-test failures, verified on a clean service tree 2026-09-20 (not caused by this task):** 5 `/v1/calibration` golden mismatches (the TS/Python parity drift #43 recorded, magnitudes ~1e-3) and 2 `test_retrieval_probe.py` `ModuleNotFoundError: services` (those tests import `services.intelligence...`, which only resolves from the repo root, where `uv run pytest` cannot run because `packages/py-progress` and `packages/py-roadmap-engine` both register `tests/conftest`). A dedicated parity-repair pass owns the first; the test-layout collision needs a pytest rootdir decision.
- **#62 P7 (streaming) and #63 P5 (material-detail usage) tails** remain open on their branches; both were approved onto `project/phase-2` incomplete during P0's merge (2026-09-15).
- **#43's live spec `e2e/mastery-live.spec.ts` was left untracked by the #43 wrap**; it is #43's durable artifact and rides this task's e2e commit.
- **`e2e/tmp-viewer-timings.spec.ts` is an untracked tmp scratch file** from the #62 viewer work; not touched (someone's WIP).
- Pre-existing 2026-09-12 ACCA assessments/attempts on the shared account are the account's own history and stay; clean only by window.
- The P2 live pass once removed 38 pre-existing local `QuestionAttempted`/`QuestionGraded` events (local-only residue; server rows were zero). Do not repeat the over-broad local cleanup on an account whose attempt history matters.
