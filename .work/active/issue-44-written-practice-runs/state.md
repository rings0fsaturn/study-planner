# State – issue-44-written-practice-runs

_Spec: GitHub [#44](https://github.com/rings0fsaturn/study-planner/issues/44) (copy: specs/phase2-tickets/12-written-practice-runs.md) · Plan: active/issue-44-written-practice-runs/plan/PLAN.md · STATUS row: issue-44-written-practice-runs · Status: active (plan amended, no code) · Updated: 2026-09-14_

## Current state & next

- **Plan amended 2026-09-14** (`plan/PLAN.md`): all six must-fix review items folded in; D-01…D-11 locked unless a reality-mismatch reopens them.
- Ticket **#44 open and unclaimed**; branch `phase2/issue-44-written-practice-runs` does not exist yet.
- **P0 is the user's step 0:** push `phase2/issue-62-scoped-question-generation` → PR into `project/phase-2` → cut the new branch. Phase-0 SHAs recorded 2026-09-13 are stale (branch has P4/P8 commits on top) and must be re-verified at session start.
- Next: run P0 (steps in `plan/PLAN.md`), claim #44, commit the amended plan + STATUS row as the first commit on the new branch.

## Done so far

- 2026-09-13: explored the route, the prototype, the contract pack and the live service; wrote `plan/PLAN.md` (AC map, live-tree context with `file:line`, D-01–D-09, P0–P4 + P5, open questions) and this state doc; added the STATUS row.
- 2026-09-14: amended `plan/PLAN.md` to all-encompassing state — single-material P1 (D-10), deferred questionIds + local-only append + sync limit (D-02), primitives-level review reuse + drain owner (D-04), no AssessmentCreated + pause-is-leave-and-return (D-11), Written/3 defaults, corrected grade-route table, rule-10/11/13/14/16 authoring detail in P2–P4, numeric P5 gate, answered open questions, Phase-0 SHA staleness warning. No code, no tests (plan-only change).
- Reusable findings from that exploration (all in the plan's Context section): the practice prototype IS #12's Variant-C guide; the server accepts `formats: ['objective'|'written']` and `questionCount == 1` only (`routers/assessments.py:38-43`); `AttemptSubmit` needs no run id and `practiceRunId` is absent from the whole contract pack; Dexie v6 already has `assessmentAttempts`/`assessmentContentCache` and `masteryCache` is not in it (#43 owns v7).

## Flow trace

1. Route: `App.tsx:202` → `pages/materials/PracticeThis.tsx` (config only; `Start practice run` sets a fake banner at `:180-203`).
2. Generation precedent: `pages/assessments/AssessmentConfig.tsx:190-223` (`generateAssessment` → `AssessmentCreated` pointer → navigate); polling + attempt hydration live in `pages/assessments/AssessmentDetail.tsx:104-158/:205-242`.
3. Attempts: `assessments/attemptFlow.ts` (local row keyed by `clientAttemptId` in Dexie v6 `assessmentAttempts`, answer-free durable `QuestionAttempted`, `QuestionGraded` carries the grade); UI `pages/assessments/AttemptTaker.tsx`; review `pages/assessments/review/{ReviewSurface,reviewModel}.tsx`.
4. Service: routers `assessments, calibration, jobs, materials, progress, retrieval, roadmap, serialization` — no practice router, no guide router; migrations stop at 030 with no `practice_runs` table.
5. Contract pack: `/v1/practice-runs*`, `/v1/guide/{stream,reveal}` and `/v1/mastery` are specified but unimplemented; `GuideRequest.tier` is `nudge|concept|strategy|worked_step` (not the prototype's labels).
6. Server requires exactly one `materialId` per generation: `len(material_ids) != 1` returns `invalid_request` — services/intelligence/app/routers/assessments.py:140-143.
7. `ReviewSurface` takes one `Assessment` plus a single timeline; a run is N assessments of 1 question each, so only the primitives (`QuestionReviewCard` + `QuestionNavigator` + `reviewModel`) are reusable — apps/app/src/pages/assessments/review/ReviewSurface.tsx.
8. `questionIds` do not exist at Start: `generateAssessment` returns a job and questions land after `getAssessment` polling while `generating` — apps/app/src/pages/assessments/AssessmentDetail.tsx:104-158.
9. No standalone grade trigger route exists on disk; submit enqueues grading and the client observes the grade by polling `GET .../attempts` — apps/app/src/pages/assessments/AssessmentDetail.tsx:233-260.

## Files affected

- `.work/active/issue-44-written-practice-runs/plan/PLAN.md` – the plan (new 2026-09-13, amended 2026-09-14 with D-10/D-11 and all review fixes).
- `.work/active/issue-44-written-practice-runs/state.md` – this doc (new, distilled 2026-09-14).
- `.work/active/issue-44-written-practice-runs/SCRATCHPAD.md` – session ledger (reset after distill).
- `.work/STATUS.md` – one Active row added (new).
- No source files touched yet.

## Pitfalls & rules

- The practice config's Focus/Difficulty chips are **not** the wire vocabulary: `recipe.formats` is one `AssessmentFormat`, and `Adaptive` is a #43 client-mastery concept, not a generation input.
- The server takes exactly one `materialId` per generation call: never send primary + extras (400s) — P1 is single-material with the picker disabled (D-10).
- The rendered defaults (`Mixed`/`Adaptive`) offer a run the service cannot produce: Phase 1 must flip them to `Written`/`3`.
- `questionCount` is capped at 1 server-side, so an N-problem run is N generation calls today (D-06) — honour `quota_exhausted`/`retryAfterSeconds` and report partial generation honestly.
- Coding generation does not exist (`formats` gate); `Coding` / `Mixed` must stay disabled or the config offers a run the service cannot produce.
- Guide tier names on the wire are the contract's (`nudge|concept|strategy|worked_step`); the prototype's `hint/targeted/reveal` are display copy only (#46).
- No editor dependency is installed (`apps/app/package.json` has no monaco/codemirror/ace) — Variant C's popover needs only the active line, so a textarea stands (D-05).
- Practice generations must not append `AssessmentCreated`, and pause is leave-and-return with no event or timer (D-11).
- Local-only `eventStore.append` (not `SyncEngine.logEvent`) means same-device refresh/reconnect only; cross-device run resume is out of slice (D-02).
- `PracticeRun` owns the N-assessment loop and the single reconnect drain; individual takers never drain (D-04).
- Phase-1 tests need `AssessmentProvider` + `useEventStore`/`useNavigate` mocks (`AssessmentConfig.test.tsx:12-21`); the current spec renders `MaterialsProvider` only.
- Phase-0 SHAs from 2026-09-13 are stale: re-run `git log`, `merge-base`, and `merge-tree` before merging.
- WSL/drvfs staleness (rule 53): restart the app and hard-reload before judging frontend changes.
- Vitest: use `pnpm --filter app test <path>` — an extra `--run` makes vitest treat the path as a name filter.

## Decisions in force

- Decided this slice reuses the assessment generation + attempt + grading path and does **not** build `/v1/practice-runs` or a `practice_runs` table (2026-09-13, D-01 — recorded deviation from the contract pack, revisited when a server-side run is genuinely needed).
- Decided the run rides thin local pointer events with a client-minted `runId` in the URL, `questionIds` deliberately absent and resolved lazily, local-only append with a documented same-device limit (2026-09-14, D-02).
- Decided the run route is `/materials/:materialId/practice/:runId` under the protected shell with no `/study` prefix (2026-09-13, D-03).
- Decided the run shell reuses `AttemptTaker` plus the review primitives (`QuestionReviewCard` + `QuestionNavigator` + `reviewModel`), never `ReviewSurface` (2026-09-14, D-04).
- Decided written answers stay on the existing `textarea`; no editor dependency (2026-09-13, D-05).
- Decided a run is N single-material `generateAssessment` calls bounded 2 at a time, composed by assessment ids (2026-09-14, D-06).
- Decided `Coding`/`Mixed` stay disabled until #42/#45 and `Adaptive` stays disabled until #43 (2026-09-13, D-07/D-08).
- Decided Phase 1 is single-material only with the picker disabled, not wired (2026-09-14, D-10).
- Decided practice skips `AssessmentCreated` and pause is leave-and-return with no event or timer (2026-09-14, D-11).
- Decided the Socratic guide (#46), coding practice (#45) and mastery/adaptive difficulty (#43) are out of this slice; AC3 is deferred to #43 (2026-09-13, D-09).

## Open

- P0's merge lands unfinished tickets: #62 P7 (streaming, R4) + wayfinder exit, and #63 P5 (material-detail usage) are still open — unblock path: recommendation is finish those tails first (plan Open Q1, answered 2026-09-14), or confirm landing partial work.
- Open questions 1–6 answered 2026-09-14 in the plan; locked unless a reality-mismatch reopens them.
- AC3 (mastery on valid grades) · on #43 Mastery and Adaptive Difficulty · unblocks when #43 lands `/v1/mastery` + the `masteryCache` Dexie v7 table.
