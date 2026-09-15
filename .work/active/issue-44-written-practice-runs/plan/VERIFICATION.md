# Verification – issue-44-written-practice-runs (#44)

_Ticket: #44 · Parent spec #32 · Plan: plan/PLAN.md · Updated: 2026-09-15_

## AC tick-down (all unchecked until proven)

- [x] AC1 — Learners can configure, start, pause, resume, and complete multi-question written runs. — 2026-09-15 live (Phase 4 spec, desktop + phone): a 2-problem written run configured on the frozen ACCA corpus (count set to 2, Written focus, difficulty 3), started, paused and resumed by a full reload mid-run (pause is leave-and-return, D-11: the reload restored the run from its local pointer at problem 2 with problem 1's grade intact), completed via `Finish run` (gated until every problem is graded) and landed on the run summary.
- [x] AC2 — Written Practice uses the same server-authoritative grading and fresh-attempt semantics as Assessments. — 2026-09-15 live: both problems graded by the real `llm_rubric` arm through the shared `AttemptTaker`/`attemptFlow` path; retry is a fresh `clientAttemptId` with preserved history (P2/P3 unit + live verified).
- [ ] AC3 — Valid grades update mastery while paused, abandoned, timed-out, and unsubmitted work creates no observation. — deferred to #43 (D-09): the mastery projection, `/v1/mastery` and `masteryCache` (Dexie v7) do not exist; the graded attempts this run produces are the observations #43 consumes. Annotated on the issue as deferred; not ticked.
- [x] AC4 — The flow works at mobile and desktop widths and survives refresh and reconnect. — 2026-09-15 live: the same scenario at 1280×720 and 375×812; desktop asserts the 280 px review rail, phone asserts the sticky strip and zero horizontal overflow; reload mid-run restored position and grades; the run shell owns the single reconnect drain (D-04, P2).

## Phase gates

- [x] P0 — branch + merge + claim. PR #64 merged as `8f04d0d` (carried #41, #62, #63); branch cut off the refreshed `project/phase-2`; ticket claimed. 2026-09-15.
- [x] P1 — `Start practice run` issues real grounded written generations. 16 focused tests; live 2-problem run issued exactly 2 calls, one `PracticeRunStarted` pointer, no `AssessmentCreated` (D-11); both assessments reached `ready` with written questions and citations. 2026-09-15.
- [x] P2 — run shell. `practiceRunModel` (21 pure cases incl. round-robin attribution), `PracticeRun` (17 cases); live 3-problem run graded by real `llm_rubric` (1 correct / 2 incorrect), reload-resume kept the grade and position, finish gated on all grades, abandon honest. 2026-09-15.
- [x] P3 — summary. Stage A throwaway prototype user-judged (Variant A review rail + inline retry); Stage B `PracticeSummary`; 44/44 focused; live finish lands on the summary, inline retry grades with history preserved, hard-reload re-entry works. 2026-09-15.
- [x] P4 — live spec + AC sweep. `pnpm exec playwright test -c e2e/playwright.config.ts e2e/practice-run-live.spec.ts --project=app --workers=1` → **2 passed in 3.4 min** (2026-09-15; first run 4.2 min with one bounded restart on a partial generation, then the cleanup was hardened and re-run). Scenario timings on 2-problem runs: start→run screen ~3.2–3.3 s; start→first problem answerable 63.3 s (desktop) / 26.1 s (mobile). Full app suite + typecheck + lint held from P1–P3: 864/866 (the 2 documented WSL TZ flakes).

## Live evidence

- `plan/evidence/practice-run-desktop.png` (2026-09-15) — the run summary at 1280×720: navigator rail, "2 of 2 problems graded", the graded problem panel.
- `plan/evidence/practice-run-mobile.png` (2026-09-15) — the same at 375×812: sticky strip navigator, no horizontal overflow.

## Shared-account hygiene

- The spec deletes every assessment created inside its run window via service-role PostgREST. The window (material + `created_at >= test start`) is the cleanup source of truth, not the response log: a transient server failure can insert an assessment row without ever returning the 202 whose `resultId` the client would see — observed live as a stuck `generating` row, deleted, and the spec hardened around the window.
- Verified after the run: zero assessments and zero `question_attempts` created on 2026-09-15 on the shared account. The frozen ACCA material is never deleted. Pre-existing 2026-09-12 rows (assessments + attempts from the #41 live specs) are the account's own history and were left untouched.

## Phase 5 gate (one generation call for N problems)

- Gate per plan: p95 run-start seconds or quota-error rate on a **5-problem** run. Not met by this phase's 2-problem numbers (start→first problem 63.3 s desktop / 26.1 s mobile; start→run screen ~3 s). P5 remains unstarted; revisit when a 5-problem measurement is wanted.