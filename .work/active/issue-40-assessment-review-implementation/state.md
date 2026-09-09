# State – issue-40-assessment-review-implementation
_Spec: specs/phase2-tickets/08-assessment-review-implementation.md (ticket #40, parent #32, map #4) · Plan: active/issue-40-assessment-review-implementation/plan/ · STATUS row: issue-40-assessment-review-implementation · Status: active · Updated: 2026-09-09_

## Current state & next
- P3 done 2026-09-09: review module port (ReviewSurface/SummaryBand/QuestionNavigator/QuestionPanel + treatments + history/timeline + reviewModel + review.css; view-model five states) — 22/22 vitest passed; typecheck + lint green.
- P4 done 2026-09-09: AssessmentDetail ready state wired to ReviewSurface with per-question answer slot + retry (fresh attempts, append-only history, whole-assessment rounds collapse prior timeline); AssessmentDetail suite 12/12 passed; app tsc clean.
- P5 done 2026-09-09: static sweep re-confirmed green; new live spec `e2e/assessment-review-40-live.spec.ts` 4/4 passed (desktop + mobile graded review, per-question + whole-assessment retry, redaction DOM asserts); evidence screenshots in `plan/evidence/`; AC1–AC4 ticked in VERIFICATION.md. **Ingestion worker started for the pass** (full profile does not run it; needed for live grading) — left running.
- Next: wayfinder resolution (comment + close #40 + map #4 line + STATUS refresh) on user go-ahead; nothing blocking — #41 is the next ticket.

## Done so far
- OPEN 2026-09-09: created `active/issue-40-assessment-review-implementation/{plan,prompts,research}/`, claimed #40, refreshed STATUS (`_Last reconciled_` → 2026-09-09, phase2-wayfinder frontier now #40 claimed + #41).
- Planning 2026-09-09: context gathered first-hand (rules 10/14/16/22/30/53, contracts, attemptFlow/AttemptTaker/AssessmentDetail, prototype module, #39 plan shape); user scoping resolved (retry fan-out, answer echo A, placeholders); PLAN.md + VERIFICATION.md + research/context-40.md written.
- P1 2026-09-09: openapi AttemptRecord.answer ($ref ObjectiveAnswer, optional), answer-bearing fixtures, `_attempt_record` echo + docstring, contracts test (shape + $ref + legacy-absent round-trip) + route test (echo present, answer_block/correctIndex absent); 32 passed.
- P2 2026-09-09: `AttemptRecord.answer?: ObjectiveAnswer`, refreshAttempts adopts echoed answer on new rows (local answers untouched), `attemptRecord()` fake helper, refresh echo + legacy-absent tests; `pnpm --filter app test src/assessments` 26 passed.
- P3 2026-09-09: production review module ported from the #34 Split-pane B prototype — `review/{ReviewSurface, reviewModel, review.css, ReviewSurface.test.tsx, reviewModel.test.tsx}`; view-model builder (D-02 five states), QuestionPanel honest states, AttemptHistoryBlock oldest→latest latest-expanded, AttemptTimeline collapsed-prior, family treatments w/ written/coding placeholders (D-05); 22/22 passed + redaction grep clean + typecheck/lint green.
- P4 2026-09-09: AssessmentDetail ready state renders ReviewSurface (summary + navigator + panels). Data layer: flow from injected transport; hydrate once per ready assessment (refreshAttempts restores server rows w/ echoed answer → listLocalAttempts); 3 s refresh while any row in flight. Per-question answer slot (AttemptTaker + citations) shown for never-attempted questions and re-shown on "Retry question"; submit = fresh clientAttemptId (append-only); whole-assessment "Retry assessment" appends a timeline round via `roundEntry` (prior round collapses into `<details>`) and returns every question to taking mode; 0-question retry = generation retry. Review module extended with optional `panelSlot` on QuestionPanel/ReviewSurface (fallback states untouched). Tests: old ready-state assertions moved to the review layout; 4 integration tests via EventStoreProvider + Dexie + scripted transport (restore + your-pick, per-question retry, whole-assessment round, queued-hides-retry) — AssessmentDetail suite 12/12; app tsc clean.
- P5 2026-09-09: static sweep re-confirmed (app 744/746 TZ-flake, typecheck 0, lint clean, service pytest 32, redaction grep clean); `e2e/assessment-review-40-live.spec.ts` written + run green 4/4 (ready graded review desktop rail + mobile strip incl. no-overflow check, server-restore your-pick, per-question retry +1 row, whole-assessment retry round-append + collapsed-prior, redaction DOM asserts; `--workers=1` required — mutation suite on the shared account); screenshots `plan/evidence/review-40-*.png`; AC1–AC4 ticked.
- (Records note: the 2026-09-09 implementation session ended right after P3 without writing its session-end record — this resume session verified P3 on disk (22/22, typecheck/lint green) and reconciled records before starting P4.)

## Flow trace
1. Ticket #40 = Assessment Review Implementation (`wayfinder:phase2`, `ready-for-agent`, OPEN): implement the approved review surface from the prototype — summary-led results, responsive question navigation, citations, warnings, preserved attempt history, per-question or whole-assessment retry.
2. AC1: review works for completed, partial, processing, failed, retried assessments. AC2: includes approved objective, written, coding feedback extension points. AC3: retry creates fresh observations, never overwrites. AC4: mobile + desktop verified against the approved prototype.
3. Builds on the #39 chain: submit → 025/026 RPC → grading worker → GET attempts → attemptFlow (local row + QUESTION_ATTEMPTED/GRADED events, Dexie v6 `assessmentAttempts` + `assessmentContentCache`) → AttemptTaker UI in AssessmentDetail ready state.
4. Builds on the #34 prototype: Split-pane B (280px navigator rail ≥1024px, sticky strip below), SummaryBand verdict logic, QuestionReviewCard per-family treatments, AttemptTimeline + queued-retry model; full interaction notes in `archive/issue-34-assessment-review-prototype/research/decisions-34.md`.
5. #41 (written) AC4 renders through this review surface — #40's written extension point constrains #41's rendering. Sequenced #40 first per user 2026-09-09.

## Files affected
- `.work/STATUS.md` – issue-40 Active row; phase2-wayfinder frontier; `_Last reconciled_`.
- GitHub `rings0fsaturn/study-planner` issue #40 – assigned to `rings0fsaturn` (claimed).
- Code (P1): `services/intelligence/contracts/phase2/openapi.yaml` (AttemptRecord.answer) + fixtures + `contracts/phase2/tests/test_contracts.py`; `services/intelligence/app/routers/assessments.py` (`_attempt_record` echo) + `services/intelligence/tests/test_assessments_api.py`.
- Code (P2): `apps/app/src/assessments/types.ts` (AttemptRecord.answer?) + `attemptFlow.ts` (refresh merge) + `testing/fakeAssessmentClient.ts` (attemptRecord()) + `attemptFlow.test.ts`.
- Code (P3): `apps/app/src/pages/assessments/review/` new module (ReviewSurface, reviewModel, review.css + tests).
- Code (P4): `apps/app/src/pages/assessments/AssessmentDetail.tsx` (review wire-up: data hook, answer slot, timeline rounds, retry handlers) + `AssessmentDetail.test.tsx` (layout updates + 4 integration tests) + review module `panelSlot` extension + `.ar-answer-slot` css.
- Code (P5): `e2e/assessment-review-40-live.spec.ts` (new live spec, 4 scenarios) + `plan/evidence/review-40-*.png` (4 screenshots) + VERIFICATION AC tick-down.

## Pitfalls & rules
- Must honor map #4 capstone principle: feature-rich and complete, no MVP deferral.
- AC4 redaction is a hard gate (from #34): review must never render hidden answers, rubrics, reference solutions, hidden tests; `answer_block` stays service_role-only (only `repo.get_question` reads it).
- Consumers must inject `client.transport`, not the bare client (burned #39 P5: `transport.submitAttempt is not a function`).
- The app flat eslint config loads NO react-hooks plugin — no `react-hooks/*` eslint-disables (also no exhaustive-deps enforcement).
- Retry = fresh observation (map #10): new clientAttemptId row, append-only history, never overwrite.
- WSL: restart the managed runtime before browser verification; run app vitest under the default threads pool (not `--pool=forks --singleFork`).
- Live E2E needs env-gated credentials + managed runtime, mutates the shared dev account (rule 16).
- Live grading needs the ingestion worker — the `full` app profile does NOT run it; start `bash scripts/run-detached-ingestion-worker.sh` (rule 53 detached pattern) or new submits stay ungraded and the review reads "0 of N graded · scores pending" forever.
- Live mutation specs on the shared account must run `--workers=1` (Playwright `fullyParallel` defeats describe-serial across workers; observed two suites submitting concurrently and leaving rows mid-grade).
- Review attempt labels are CSS-uppercased: `innerText` returns "ATTEMPT #1 · CORRECT" — assert via role/accessible names (`getByRole('button', { name: /Attempt #\d+/ })`) or case-insensitive regex.
- TS control-flow narrowing does not carry into hoisted nested functions inside effects — re-guard `flow`/`assessment` inside async closures (AssessmentDetail hydrate/in-flight effects).

## Decisions in force
- Review surface = Split-pane B per HITL grill 2026-09-03 (persistent navigator rail on desktop; identical mobile either way; AttemptCard oldest→latest, latest expanded; retry controls per decisions-34.md).
- Sequencing: #40 first, #41 after (user 2026-09-09); wayfinder one-ticket-per-session rule honored.
- Taking stays in AttemptTaker (D-04): review surface composes an answer slot per question instead of re-implementing answer controls; no changes to attemptFlow or the taker's flow.

## Open
- P5 complete; AC1–AC4 ticked in VERIFICATION.md. Remaining: wayfinder resolution (comment + close #40 + map #4 line + STATUS row → closed) — needs user go-ahead; nothing else blocking.
- #41 untouched: OPEN, unclaimed, no task folder.
