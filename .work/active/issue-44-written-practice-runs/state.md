# State – issue-44-written-practice-runs

_Spec: GitHub [#44](https://github.com/rings0fsaturn/study-planner/issues/44) (copy: specs/phase2-tickets/12-written-practice-runs.md) · Plan: active/issue-44-written-practice-runs/plan/PLAN.md · STATUS row: issue-44-written-practice-runs · Status: active — P0–P4 complete; AC1/AC2/AC4 ticked, AC3 deferred to #43; P5 optional (gated, unstarted) · Updated: 2026-09-15_

## Current state & next

- **P0 done** (`8f04d0d`, PR #64) — the merge carried #41, which the plan had not accounted for.
- **P1 done 2026-09-15** — `Start practice run` issues real grounded written generations; live-verified.
- **P2 done 2026-09-15** — step 0 (multi-material round-robin) in `a9ce527`, the run shell (steps 1–5) in `7aa209d`, sha correction in `40607d1`. Full Notes in the plan.
- **P3 done 2026-09-15** — Stage A: throwaway summary UX prototype at `/study/practice-summary-prototype` (DEV-only), user-judged → **Variant A (review rail) + inline retry**. Stage B: `PracticeSummary.tsx` (navigator + active panel, practice copy, honest failed state, inline retry slot) + `PracticeRun` wiring (`showSummary` landing/re-entry, round-trip, `AnswerSlot` inline retry, hydrate clears retry mode on the fresh grade). `problemStatus`/`isSummaryEligible` added to `practiceRunModel`. 44/44 focused, typecheck/lint clean, full suite 864/866 (2 WSL TZ flakes), build green, redaction clean. **Live-verified on the real stack**: finish lands on the summary, inline retry grades through the real `llm_rubric` arm with history preserved, round-trip + hard-reload re-entry work, 375×812 clean. Scoped cleanup done.
- **P4 done 2026-09-15** — `e2e/practice-run-live.spec.ts` green: **2 passed in 3.4 min** (`--project=app --workers=1`), one scenario per viewport (1280×720 + 375×812), each grading a full 2-problem run (`Finish run` is gated on every grade), reload-mid-run resume, summary, redaction + evidence screenshots. Cleanup hardened to a **window-scoped** service-role delete after run 1 left a stuck `generating` row (500-after-insert, no 202); verified zero today-created assessments/attempts. **AC sweep done**: #44 body ticked AC1/AC2/AC4, AC3 annotated as deferred to #43 (D-09), verification comment posted. Timings (2-problem runs): start→run screen ~3.2 s; start→first problem 63.3 s desktop / 26.1 s mobile — recorded in `plan/VERIFICATION.md`; **P5's 5-problem p95 gate stays unmet**.
- Next: wrap decision (PR into `project/phase-2` / archive) or a 5-problem timed measurement if P5 is wanted. AC3 stays on #43.

## Done so far

- 2026-09-13: explored the route, the prototype, the contract pack and the live service; wrote `plan/PLAN.md` (AC map, live-tree context with `file:line`, D-01–D-09, P0–P4 + P5, open questions) and this state doc; added the STATUS row.
- 2026-09-14: amended `plan/PLAN.md` to all-encompassing state — single-material P1 (D-10, later reversed), deferred questionIds + local-only append + sync limit (D-02), primitives-level review reuse + drain owner (D-04), no AssessmentCreated + pause-is-leave-and-return (D-11), Written/3 defaults, corrected grade-route table, rule-10/11/13/14/16 authoring detail in P2–P4, numeric P5 gate, answered open questions, Phase-0 SHA staleness warning. No code, no tests (plan-only change).
- 2026-09-15: P0 executed — the PR #64 merge was **mandatory, not optional**: `origin/project/phase-2` had a tree byte-identical to the #40 wrap, so #41's nine commits had never travelled into the integration branch and #44 was unbuildable without them.
- 2026-09-15: P1 — `PracticeThis.tsx` wired to real generation (N single-material written calls, bounded 2, `PracticeRunStarted` pointer with no `questionIds`, no `AssessmentCreated`); 16 focused tests.
- 2026-09-15: P2 step 0 — **D-10 reversed**: the server's `len(material_ids) != 1` gate is per *call*, and an N-problem run is already N calls, so round-robin crosses no gate. D-12 records that cross-material *synthesis* is what the gate actually protects and stays out of scope.
- 2026-09-15: P2 steps 1–5 — the run shell. New `src/pages/practice/`: `practiceRunModel.ts` (17 pure cases) + `PracticeRun.tsx` (13 cases) + `practice.css`; `App.tsx` nested route; `AnswerSlot` exported from `AssessmentDetail` for reuse.
- 2026-09-15: P4 — `e2e/practice-run-live.spec.ts` green (2 passed, 3.4 min; desktop 1280×720 + phone 375×812, each grading a 2-problem run, reload-resume, finish, summary, redaction, evidence); AC1/AC2/AC4 ticked on #44 with AC3 annotated as deferred to #43; cleanup hardened to window-scoped service-role delete (run 1 left a stuck `generating` row from a 500-after-insert; run 2 verified zero today-created rows); `plan/VERIFICATION.md` written.

## Reusable findings (live, 2026-09-15)

- Practice reuses the assessment generation + attempt + grading path; the prototype IS #12's Variant-C guide; `AttemptSubmit` needs no run id and `practiceRunId` is absent from the whole contract pack.
- Server gates: `formats: ['objective'|'written']`, `questionCount == 1`, and exactly one `materialId` **per call** (`routers/assessments.py:38-43,140-143`).
- Dexie v6 already has `assessmentAttempts`/`assessmentContentCache`; `masteryCache` is not in it (#43 owns v7). No schema change was needed for P1 or P2.
- `useEventStore` **throws** on the first render under `EventStoreProvider` (the store attaches in an effect). Use `useEventStoreContext` and guard, as `AssessmentDetail` and `PracticeRun` both do.
- `AnswerSlot` (in `AssessmentDetail.tsx`) is `AttemptTaker` + the grounded citations block — reuse it for any one-question taking surface rather than mounting `AttemptTaker` bare.
- **A live generation run needs the worker + GPU sidecar for steer-based work**; the worker is now part of `./full-app` (`full` = intelligence + app + worker, fixed 2026-09-15 by `practice-generation-recovery`), so generations no longer sit at `generating` forever. The GPU sidecar on `:8200` is still demand-started (rule 54): steer-based retrieval and ingestion embedding need it; a practice-run generation without `skillTags`/`scope` does not (`_spread_context`). Start the sidecar before steer/embedding work, stop it after (rule 54).
- The `MaterialPicker`'s checkboxes are `className="sr-only"`: a live spec must click the label row (`page.locator('label.checkbox-row', { hasText })`), not the checkbox.
- A live spec's server cleanup must be **window-scoped** (`material_id` + `created_at >= test start`), not response-log-scoped: a transient failure can insert an assessment row without returning the 202 whose `resultId` the client sees (observed live 2026-09-15 — a stuck `generating` row).
- The frozen ACCA material carries pre-existing 2026-09-12 `ready` assessments + `question_attempts` (leftover #41 live-spec evidence). They are the account's history; clean only your own window.
- The practice live spec needs `--project=app --workers=1` and no `--` separator; without `--project=app` it also runs under the `marketing` project and fails at sign-in.

## Flow trace

1. Routes: `App.tsx:203` → `pages/materials/PracticeThis.tsx` (config + real generation + run pointer + navigate); `App.tsx:204` → `pages/practice/PracticeRun.tsx` (the run, new).
2. Generation precedent: `pages/assessments/AssessmentConfig.tsx:190-223` (`generateAssessment` → `AssessmentCreated` pointer → navigate); polling + attempt hydration live in `pages/assessments/AssessmentDetail.tsx:104-158/:205-242`.
3. Attempts: `assessments/attemptFlow.ts` (local row keyed by `clientAttemptId` in Dexie v6 `assessmentAttempts`, answer-free durable `QuestionAttempted`, `QuestionGraded` carries the grade); UI `pages/assessments/AttemptTaker.tsx`; review `pages/assessments/review/{ReviewSurface,reviewModel}.tsx`.
4. Service: routers `assessments, calibration, jobs, materials, progress, retrieval, roadmap, serialization` — no practice router, no guide router; migrations stop at 030 with no `practice_runs` table.
5. Contract pack: `/v1/practice-runs*`, `/v1/guide/{stream,reveal}` and `/v1/mastery` are specified but unimplemented; `GuideRequest.tier` is `nudge|concept|strategy|worked_step` (not the prototype's labels).
6. Server requires exactly one `materialId` per generation: `len(material_ids) != 1` returns `invalid_request` — services/intelligence/app/routers/assessments.py:140-143.
7. `ReviewSurface` takes one `Assessment` plus a single timeline; a run is N assessments of 1 question each, so only the primitives (`QuestionReviewCard` + `QuestionNavigator` + `AttemptHistoryBlock` + `RetryQuestionButton` + `reviewModel`) are reusable — all named exports of `apps/app/src/pages/assessments/review/ReviewSurface.tsx`.
8. `questionIds` do not exist at Start: `generateAssessment` returns a job and questions land after `getAssessment` polling while `generating` — apps/app/src/pages/assessments/AssessmentDetail.tsx:104-158.
9. No standalone grade trigger route exists on disk; submit enqueues grading and the client observes the grade by polling `GET .../attempts` — apps/app/src/pages/assessments/AssessmentDetail.tsx:233-260.
10. The run's own state derives from three inputs only: the pointer event, the loaded assessment envelopes, and the local attempt rows — `pages/practice/practiceRunModel.ts`. Per-problem material attribution is `materialIds[i % M]` from the pointer, overridden by `question.materialId` once the assessment loads (D-10/D-02).

## Files affected

- `.work/active/issue-44-written-practice-runs/plan/PLAN.md` – the plan (new 2026-09-13; amended 2026-09-14; D-10 reversed and D-12 added 2026-09-15; P0/P1/P2 Notes blocks filled).
- `.work/active/issue-44-written-practice-runs/state.md` – this doc.
- `.work/active/issue-44-written-practice-runs/SCRATCHPAD.md` – session ledger (reset after distill).
- `.work/STATUS.md` – one Active row.
- `apps/app/src/sync/types.ts` – `PracticeRunStartedPayload`, `PracticeRunFinishedPayload` (P1).
- `apps/app/src/events/EventStore.ts` – `PRACTICE_RUN_STARTED` / `PRACTICE_RUN_FINISHED` (P1).
- `apps/app/src/pages/materials/PracticeThis.tsx` (+ `.test.tsx`) – real generation, run pointer, multi-material round-robin (P1 + P2 step 0).
- `apps/app/src/pages/practice/` – **new**: `practiceRunModel.ts` (+ `.test.ts`), `PracticeRun.tsx` (+ `.test.tsx`), `practice.css` (P2 steps 1–5), `PracticeSummary.tsx` (+ `.test.tsx`) (P3).
- `apps/app/src/App.tsx` – the nested run route (P2 step 5); the DEV-only prototype route (P3 Stage A).
- `apps/app/src/prototype/practice-summary/` – **new, throwaway** (P3 Stage A): fixtures through the real `practiceRunModel`, 3 variant components, `PrototypeTaker`, shared helpers, host, css.
- `apps/app/src/pages/assessments/AssessmentDetail.tsx` – `AnswerSlot` exported for reuse (one line).
- `e2e/practice-run-live.spec.ts` – **new** (P4): one scenario per viewport (1280×720 + 375×812), full 2-problem run + reload-resume + finish + summary, window-scoped service-role cleanup, evidence screenshots.
- `.work/active/issue-44-written-practice-runs/plan/VERIFICATION.md` + `plan/evidence/practice-run-{desktop,mobile}.png` – **new** (P4).

## Pitfalls & rules

- The practice config's Focus/Difficulty chips are **not** the wire vocabulary: `recipe.formats` is one `AssessmentFormat`, and `Adaptive` is a #43 client-mastery concept, not a generation input.
- The server takes exactly one `materialId` **per call**: never send primary + extras in one request (400s). Round-robin across a run's N calls is fine and shipped (D-10).
- `questionCount` is capped at 1 server-side, so an N-problem run is N generation calls today (D-06) — honour `quota_exhausted`/`retryAfterSeconds` and report partial generation honestly.
- Coding generation does not exist (`formats` gate); `Coding` / `Mixed` must stay disabled or the config offers a run the service cannot produce.
- Guide tier names on the wire are the contract's (`nudge|concept|strategy|worked_step`); the prototype's `hint/targeted/reveal` are display copy only (#46).
- No editor dependency is installed (`apps/app/package.json` has no monaco/codemirror/ace) — Variant C's popover needs only the active line, so a textarea stands (D-05).
- Practice generations must not append `AssessmentCreated`, and pause is leave-and-return with no event or timer (D-11).
- Local-only `eventStore.append` (not `SyncEngine.logEvent`) means same-device refresh/reconnect only; cross-device run resume is out of slice (D-02).
- `PracticeRun` owns the N-assessment loop and the single reconnect drain; individual takers never drain (D-04).
- `useEventStore` throws on the first render under `EventStoreProvider` — use `useEventStoreContext` and guard the null store.
- Reuse `AnswerSlot` for a one-question taking surface; do not mount `AttemptTaker` bare and re-implement the citations block.
- The shared `QuestionNavigator` keeps its own aria contract ("Question N, status"). Practice vocabulary belongs in the panel and header, not in a fork of the primitive.
- Live generation verification needs the detached worker **and** the GPU sidecar, not just `./full-app start full`.
- WSL/drvfs staleness (rule 53): restart the app and hard-reload before judging frontend changes.
- Vitest: use `pnpm --filter app test <path>` — an extra `--run` makes vitest treat the path as a name filter.

## Decisions in force

- Decided (2026-09-15, P3 Stage A, user-judged) the run summary is **Variant A — the review rail** (`QuestionNavigator` + active panel over the run's terminal problems) with **inline retry** (the `AnswerSlot` taker replaces the card in the summary; a fresh attempt, history preserved). D-04 holds unamended; the prototype (B stacked report, C scoreboard) stays dev-gated in-tree as the primary source.
- Decided the summary lists only problems with a terminal outcome (`problemStatus` `graded | failed | open` in `practiceRunModel`); ungradable attempts show honest copy + retry (the review model would call them `processing`); the header reports graded/failed/missing counts.

- Decided this slice reuses the assessment generation + attempt + grading path and does **not** build `/v1/practice-runs` or a `practice_runs` table (2026-09-13, D-01 — recorded deviation from the contract pack, revisited when a server-side run is genuinely needed).
- Decided the run rides thin local pointer events with a client-minted `runId` in the URL, `questionIds` deliberately absent and resolved lazily, local-only append with a documented same-device limit (2026-09-14, D-02).
- Decided the run route is `/materials/:materialId/practice/:runId` under the protected shell with no `/study` prefix (2026-09-13, D-03).
- Decided the run shell reuses `AttemptTaker` plus the review primitives (`QuestionReviewCard` + `QuestionNavigator` + `reviewModel`), never `ReviewSurface` (2026-09-14, D-04).
- Decided written answers stay on the existing `textarea`; no editor dependency (2026-09-13, D-05).
- Decided a run is N single-material `generateAssessment` calls bounded 2 at a time, composed by assessment ids (2026-09-14, D-06).
- Decided `Coding`/`Mixed` stay disabled until #42/#45 and `Adaptive` stays disabled until #43 (2026-09-13, D-07/D-08).
- Decided (2026-09-15, **reversing** the 2026-09-14 D-10 lock) that multi-material **distribution** ships as round-robin across the run's per-problem calls — `materials[i % M]`, one material per call, no server change — because the single-material gate is per call and D-06 already makes N problems N calls. The original lock is preserved in the plan's collapsed `<details>`.
- Decided (2026-09-15, D-12) that multi-material **synthesis** — one question grounded in several materials — is out of scope: it needs the RPC, the assessment row, the job payload, the context builder and citation binding all changed, and it is the feature the gate actually protects.
- Decided practice skips `AssessmentCreated` and pause is leave-and-return with no event or timer (2026-09-14, D-11).
- Decided the Socratic guide (#46), coding practice (#45) and mastery/adaptive difficulty (#43) are out of this slice; AC3 is deferred to #43 (2026-09-13, D-09).

## Open

- **#44 is not ready to close.** AC3 stays deferred to #43 (D-09) — recorded on the issue; the ticket's AC1/AC2/AC4 boxes are ticked (2026-09-15), the verification comment is posted.
- **P5 (one generation call for N problems) stays gated and unstarted** — its gate is p95 run-start on a 5-problem run; Phase 4 measured 2-problem runs (63.3 s / 26.1 s start→first problem). A timed 5-problem run is the only way to settle it.
- **Wrap decision pending**: the branch `phase2/issue-44-written-practice-runs` has no PR into `project/phase-2` yet; archive/wrap is the work-journal step after records.
- **#62 P7 (streaming, R4) and #63 P5 (material-detail usage)** landed incomplete on `project/phase-2` via the P0 merge, approved by the user on 2026-09-15. Both branches survive on origin.
- Open questions 1–6 answered 2026-09-14 in the plan; locked unless a reality-mismatch reopens them.
- AC3 (mastery on valid grades) · on #43 Mastery and Adaptive Difficulty · unblocks when #43 lands `/v1/mastery` + the `masteryCache` Dexie v7 table.
- Recorded, not fixed: the local IndexedDB cleanup during P2's live pass removed 38 pre-existing `QuestionAttempted`/`QuestionGraded` events from earlier sessions on this dev account. Local-only residue — the server never held them (133 events, zero `Question*` rows). No action needed, but the same over-broad cleanup must not be repeated on an account whose attempt history matters.
