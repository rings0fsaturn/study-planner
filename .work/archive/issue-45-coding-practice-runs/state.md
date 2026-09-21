# State - issue-45-coding-practice-runs
_Spec: GitHub [#45](https://github.com/rings0fsaturn/study-planner/issues/45) (copy: specs/phase2-tickets/13-coding-practice-runs.md) · Plan: archive/issue-45-coding-practice-runs/plan/ · STATUS row: issue-45-coding-practice-runs · Status: done - P0-P5 complete, AC1-AC4 met, live 2/2 twice · Updated: 2026-09-21_

## Current state & next
- Done 2026-09-21: #45 coding practice runs. P0-P5 complete, AC1-AC4 met, live spec green twice (2 passed / 3.4m and 4.6m), all gates green.
- Three defects found and fixed in scope: the concurrent same-material generation race (migration 032), a duplicate citation React key, and a dead retry control on a failed problem.
- Next: the wayfinder exit run for #45 (resolution comment, close, map #4 Decisions-so-far line), then the WRAP (archive the task folder, flip the STATUS row).
- Remaining on the map: #35 (prototype, claimed), #48 (generation quality harness), #46, #47, #49, #50, #57.

## Done so far
- 2026-09-21 P0: claimed #45, opened the task folder, cut `phase2/issue-45-coding-practice-runs` from `project/phase-2`, wrote `plan/PLAN.md` (D-01..D-09, P0-P5, AC map).
- 2026-09-21 P1: `PracticeRunStartedPayload.mode` widened to `PracticeRunMode` + optional per-problem `families`; `PracticeThis` gained real Focus state with per-call single-family recipes (mixed alternates), the `hasCode === false` note, and family-aware copy. `PracticeThis.test.tsx` 22/22.
- 2026-09-21 P2: `PracticeRunProblem.family` with a legacy fallback; the run's pending placeholder now labels the problem from the run's own record (was a hardcoded `written`, a visible mislabel in the navigator), the panel carries a family tag, and a failed problem offers `Start a new run`. `practiceRunModel.test.ts` 29/29, `PracticeRun.test.tsx` 22/22.
- 2026-09-21 P3: the summary labels each problem's family; coding verdicts already flowed through `ProblemBody` -> `QuestionReviewCard` -> `CodingFeedback`. `PracticeSummary.test.tsx` 11/11.
- 2026-09-21 P4: full suite 934/936 (2 documented WSL TZ flakes), typecheck/lint/build green, main bundle +1.31 kB with CodeMirror/Pyodide still lazy, backend 682/689 (same 7 documented pre-existing failures), contracts 31/31.
- 2026-09-21 P5: `e2e/coding-practice-run-live.spec.ts` authored and green twice on the real stack; impeccable detector clean, desktop + phone surfaces inspected. Evidence: `plan/evidence/coding-run-desktop.png`, `plan/evidence/coding-run-phone.png`.

## Flow trace
1. Routes: `App.tsx:204-208` - `/materials/new`, `/materials/:materialId/practice` (`PracticeThis`), `/materials/:materialId/practice/:runId` (`PracticeRun`). `basename="/study"`; app paths carry no `/study`.
2. Config/start: `PracticeThis.tsx` `startRun()` runs N single-material `generateAssessment` calls (concurrency 2, `questionCount: 1`), then appends `PRACTICE_RUN_STARTED{runId, materialIds, mode, assessmentIds, count, families}` and navigates. `familyForProblem(mode, index)` returns the one family per call; `mixed` alternates `written`/`coding` by planned index.
3. Server gate: `services/intelligence/app/routers/assessments.py:41` admits exactly one `formats` entry and `questionCount == 1`, so an N-problem run is N calls (D-06) - and a mixed run must alternate rather than send two families in one recipe.
4. Pointer/derivation: `sync/types.ts` `PracticeRunStartedPayload`; `practiceRunModel.ts` `plannedFamily(mode, families, index)` = `families?.[index] ?? (mode === 'coding' ? 'coding' : 'written')`, so a pre-#45 pointer still reads. The loaded question's own `format` wins wherever a group exists.
5. Run shell: `PracticeRun.tsx` loads each single-question assessment (3 s poll while generating), hydrates local attempt rows, owns the one reconnect drain (D-04), reuses `AnswerSlot`, auto-advances on grade, and finishes/abandons.
6. Taking: `AttemptTaker.tsx:143-184` dispatches coding (`CodingTaker` lazy editor; `OutputPredictionTaker` for the prediction subtype). `CodingTaker` runs Pyodide over `visibleTests` only; the server `judge0` grade is the only grade.
7. Grading: `grading/worker.py` runs visible + hidden tests through Piston; `grade_coding` reduces to `score` (hidden pass rate) + `perSkill`, fail-closed at 0.
8. Mastery: `PracticeRun.tsx` counts graded local rows and refreshes `/v1/mastery` into Dexie v7 `masteryCache`; `PracticeSummary` renders the advisory next-run band from the shared `masteryBands` reader. Coding grades are ordinary `question_attempts` rows, so no parallel model exists.
9. Job enqueue: `enqueue_assessment_generation` allocates `attempt = max(attempt) + 1` under a transaction-scoped advisory lock (migration 032) so concurrent same-material generations cannot collide on `UNIQUE (kind, material_id, attempt)`.

## Files affected
- `.work/archive/issue-45-coding-practice-runs/` - state.md + plan/ (PLAN.md, VERIFICATION.md, evidence/ with the 2 live screenshots). Wrapped 2026-09-21; the scratchpad was removed at wrap.
- `.work/STATUS.md` - one Active row (flips to Done at wrap).
- `apps/app/src/sync/types.ts` - `PracticeRunMode`, widened `mode`, optional `families`.
- `apps/app/src/pages/materials/PracticeThis.tsx` (+ test) - Focus state, `familyForProblem`, `families` on the pointer, `hasCode` note, family-aware copy.
- `apps/app/src/pages/practice/practiceRunModel.ts` (+ test) - `PracticeRunProblem.family` + `plannedFamily` fallback.
- `apps/app/src/pages/practice/PracticeRun.tsx` (+ test) - honest placeholder family, panel family tag, `Start a new run` for a failed problem.
- `apps/app/src/pages/practice/PracticeSummary.tsx` (+ test) - family tag in the summary panel meta.
- `apps/app/src/pages/assessments/AssessmentDetail.tsx` - citation key includes the index.
- `apps/app/src/pages/assessments/review/ReviewSurface.tsx` - citation key includes the index.
- `apps/app/supabase/migrations/032_assessment_enqueue_attempt_lock.sql` - **new**: advisory lock in `enqueue_assessment_generation`.
- `e2e/coding-practice-run-live.spec.ts` - **new**: the durable live spec (2 scenarios).

## Pitfalls & rules
- Must read rules 10, 11, 12, 13, 16, 17, 22, 30, 32, 33, 41, 53, 54 before editing these areas.
- **One family per generation call**: the server admits a single `formats` entry and `questionCount == 1`, so a mixed run alternates recipes and an N-problem run is N calls (D-06).
- **Playwright actions have no default timeout in this repo's config** (`actionTimeout` is unset), so an `await locator.fill()` on a control that never appears hangs until the test timeout. Always wait for a control with an explicit timeout before acting on it, and set `actionTimeout` per spec (this spec uses 30 s).
- **`isVisible()` is instantaneous, not auto-waiting.** It is wrong for a lazy chunk (`CodingTaker`) or right after `page.goto` (React has not painted); use `waitFor`/`expect(...).toBeVisible()` with a timeout instead.
- **A `failed` assessment is terminal by contract** (#42 D-04): `regenerate` answers `conflict` for anything not `generating`, and the worker's re-entry guard drops such messages. Never offer a retry control for a failed problem; the honest recovery is a fresh run.
- **Generation job uniqueness is `UNIQUE (kind, material_id, attempt)`**; concurrent same-material generations race the attempt allocation. Fixed by migration 032's advisory lock, keyed by material id.
- **`code_not_derivable` is a legitimate outcome** for a material the provider cannot ground a coding question in. A worksheet that states the input/output contract and leaves the body unimplemented is accepted; bare study notes and worksheets with complete solutions are both refused ("no gap, bug, or prediction to test").
- Coding grading runs visible + hidden; the public table names visible rows and veils hidden ones as `Hidden test N`. Authored hidden content must never reach the DOM.
- `.t-mono-sm` is an uppercase label style: never apply it to code or learner source.
- Playwright + CodeMirror: `keyboard.insertText` after `ControlOrMeta+a`; per-key `type()` is mangled by `indentOnInput`.
- Vite on `/mnt/d` does not reliably watch source: restart the managed runtime before judging frontend changes (rule 53). Live runs need `./full-app start full` plus Piston and the sidecar.
- **This distro has no `docker` on PATH.** Docker Desktop is reachable via `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe`; published ports (`127.0.0.1:2000` Piston, `127.0.0.1:8200` sidecar) are reachable from WSL. The sidecar came up on `device: cpu` (`cuda_available: false`) - the rule 54 DXG symptom; fine for small embedding volume, stop it after use.
- Live specs clean by material id / window, never by response log; the frozen ACCA material is never deleted.

## Decisions in force
- 2026-09-21 (user): Coding and Mixed ship together; mixed distributes round-robin and multi-material synthesis stays out (#44 D-12).
- 2026-09-21 (user): the full live E2E run was approved (Piston + sidecar demand-started + window cleanup) and executed.
- 2026-09-21 (user): impeccable work is Operate refinement plus one bounded pass, not a redesign.
- 2026-09-21 (D-01): `focus: written | coding | mixed`; every call carries one family; mixed alternates by planned index.
- 2026-09-21 (D-02): the pointer widens `mode` and adds optional `families`; readers fall back to `mode` so pre-#45 pointers keep working with no Dexie migration (events are rows).
- 2026-09-21 (D-05 amended during P5): a problem that failed generation offers `Start a new run`, not a retry - a `failed` assessment is terminal by contract. The spec's recovery is therefore a fresh run, bounded, not a re-enqueue.
- 2026-09-21 (D-06/D-07 unchanged): the advisory stays browser-only on visible tests, and coding grades remain ordinary observations behind the shared `/v1/mastery` projection.
- 2026-09-21: generation suitability is NOT tuned here - that is #48's charter; the observed decline rate is recorded in `plan/VERIFICATION.md` as a finding, not as an unmet AC.

## Open
- none
