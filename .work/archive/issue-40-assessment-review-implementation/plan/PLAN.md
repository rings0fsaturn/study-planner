# Assessment Review Implementation (#40) — Implementation Plan

**Date written:** 2026-09-09 · **Ticket:** [#40](https://github.com/rings0fsaturn/study-planner/issues/40) (claimed `rings0fsaturn`) · **Parent:** spec #32 · map #4 · **Branch:** `phase2/issue-40-41` (already checked out)
**Plan status:** 🟡 Draft — awaiting user go-ahead on scope decisions (recorded below), then implement phase by phase.
**Downstream:** #41 (written) renders through this surface; #42 (coding) same; #43 (mastery) consumes the same grade shape.

> Runbook convention inherited from the #38/#39 plans: implement one phase per session, statuses updated in the same commit as the work, STOP on any reality-mismatch.

## TL;DR

Turn the approved #34 Split-pane prototype into the production review surface on `AssessmentDetail`. The learner sees a summary band (verdict, family chips, warnings, attempt timeline), a responsive question navigator (rail on desktop, strip on mobile), and per-question review cards with family feedback treatments — all driven by the existing `GET /v1/assessments/{id}` + `GET /v1/assessments/{id}/attempts` read path plus local Dexie rows. Per-question and whole-assessment retry mint fresh attempts through the existing `attemptFlow` (append-only history). The read route gains one field — the learner's own `answer` — so "your pick" marking works on any device (decision A, user-confirmed 2026-09-09). Written/coding render the shared grade shape with family placeholders; #41/#42 fill in their treatments without touching the shell.

## Acceptance criteria → where they are met

| AC | Meaning | Met by |
|---|---|---|
| AC1 | Review works for completed, partial, processing, failed, retried assessments | D-02 + P3: five-state view model from assessment status × attempt rows; skeletons/empty states per prototype |
| AC2 | Approved objective, written, coding feedback extension points | D-05 + P3: `QuestionReviewCard(question, attempt)` with family switch; written/coding render shared shape + placeholders |
| AC3 | Retry creates fresh observations, never overwrites | D-06 + P4: retry reuses `submitObjectiveAttempt` (fresh clientAttemptId); whole-assessment retry fans out per question |
| AC4 | Mobile + desktop verified against the approved prototype | P5: browser matrix at 375×812 + 1280×800 vs prototype states; redaction grep + DOM test |

## Context — live stack facts (verified 2026-09-09, trust over older notes)

- No contract gap for the review read path: `GET assessment` (envelope + visible questions) and `GET attempts` (AttemptRecord[] with public QuestionGraded) both exist and are live-verified (#39 P6). QuestionGraded = score/correct/perSkill/explanation/grader/modelVersion/gradedAt; grader enum already includes `llm_rubric`/`judge0` with no producer yet.
- The one gap is the learner's own answer: `_attempt_record` (`routers/assessments.py:184`) strips `row.answer` before serializing, while `list_attempts` (`userrest.py:164`) does `select=*` — the row (with answer) reaches the service, and only the serializer drops it. So decision A is a serializer + contract change, not a migration or RPC change.
- Client: `attemptFlow.ts` (403 lines) owns submit/poll/drain/refresh/cache/list; `AttemptTaker.tsx` owns taking + honest phases; `AssessmentDetail.tsx` (237 lines) owns generating/failed/ready shells and per-question prompt + AttemptTaker + citations. No review surface exists yet.
- Prototype (`apps/app/src/prototype/assessment-review/`, throwaway, dev-only, 908-line tsx + 640-line fixtures + css): SummaryBand (verdict logic 157-174, family chips, grounding_stale banner, warnings role=status with jump), QuestionNavigator (role=tablist, aria-current, arrow keys, rail/strip), QuestionReviewCard (family switch 637-646), Objective/Written/Coding treatments (393-522), AttemptCard + history block (525-630), RetryQuestionButton, QuestionPanelShell (honest processing/pending states), AttemptTimeline (collapsed prior timeline). Full port source with HITL interaction notes in `archive/issue-34-assessment-review-prototype/research/decisions-34.md`.
- Tests mirror via `FakeAssessmentClient` (transport view + scriptListAttempts already exists); `AssessmentDetail.test.tsx` pattern established.

## Decisions log

### D-01: Echo the learner's own answer on the owner-scoped attempts read route (user decision A, 2026-09-09)
**Decision:** `_attempt_record` includes `answer: row.answer` (the learner's own submitted ObjectiveAnswer); `AttemptRecord` contract gains optional `answer` (ObjectiveAnswer schema, owner-scoped read only). Nothing else changes: `answer_block`/rubrics/reference solutions stay service_role-only; submit path untouched; no migration.
**Rationale:** the answer is the learner's own input, already owner-RLS at rest; the review surface is meaningless for objective questions without "your pick" marking on every device; the strip was #39 redaction posture, never a storage decision. Local Dexie rows remain the offline source; server answer is the restore path.

### D-02: Five-state review view model derived from assessment status × attempt rows
**Decision:** `ready` (all questions graded) / `partial` (some graded, some in flight) / `processing` (none graded yet) / `failed` (assessment failed, warnings drive the empty card) / `retried` (emergent — >1 attempt on any question renders history + timeline). Derived client-side from `Assessment.status` + per-question attempt lists; no new server state.
**Rationale:** matches the prototype's five mock states 1:1, so AC1 verification is a direct comparison.

### D-03: Port the prototype vocabulary, Split-pane B, into production components
**Decision:** new `apps/app/src/pages/assessments/review/` module: `ReviewSurface` (shell), `SummaryBand`, `QuestionNavigator`, `QuestionReviewCard`, family treatments, `AttemptHistory`, `review.css` (ar-* classes ported, renamed only where they collide with production styles). Desktop ≥1024px: 280px navigator rail + summary/panel pane; below: single column + sticky horizontal strip. Navigator keeps `role="tablist"` + `aria-current` + arrow keys; warnings keep `role="status"` + jump-to-question.
**Rationale:** HITL locked Split-pane B 2026-09-03; porting (not rewriting) keeps the AC4 prototype comparison honest.

### D-04: Taking UI stays where it is; review renders above/beside it
**Decision:** `AttemptTaker` keeps owning answer controls + submit + honest in-flight phases per question. The review card for a question renders its graded attempts (history); while the latest attempt is queued/grading, the panel shows the skeleton + queued copy and hides the retry control. No changes to attemptFlow or the taking flow.
**Rationale:** taking and review share the Dexie/server data layer but own different moments (answering vs graded); avoids re-litigating #39's verified flow.

### D-05: Family extension points render the shared grade shape now, family extras later
**Decision:** `QuestionReviewCard(question, attempt)` switches on `question.format`: objective = options + your-pick marker + per-skill + citations (full, live); written = grade line + explanation + per-skill + citations + rubric placeholder ("Detailed rubric breakdown arrives with written grading"); coding = grade line + per-skill + citations + execution placeholder. #41/#42 replace only their treatment's placeholder with real content; the shell, navigator, history, and retry never change.
**Rationale:** user-confirmed 2026-09-09; AC2 "extension points" without front-running #41/#42's grading contracts.

### D-06: Retry semantics — fresh observation everywhere
**Decision:** per-question retry calls the existing `submitObjectiveAttempt` (fresh clientAttemptId, append-only row, queued skeleton, "New attempt queued — previous attempt kept" copy). Whole-assessment retry fans out one fresh attempt per question (user decision, 2026-09-09: fresh attempt for every question) and appends an attempt-timeline entry with the prior timeline collapsed into `<details>`. Failed assessments retry from the empty card the same way.
**Rationale:** map #10 retry=fresh-observation, verbatim; reuses the verified idempotent submit path.

### D-07: No new events, no Dexie bump, no new routes
**Decision:** review reads existing stores (`assessmentAttempts`, `assessmentContentCache`) and the existing attempts read route; retry appends through existing events. The only contract edit is the optional `answer` field on AttemptRecord (D-01).
**Rationale:** review is a read surface over #39's durable record; nothing about the persistence or event model changes.

## Files-touched index

| File | Change |
|---|---|
| `services/intelligence/contracts/phase2/openapi.yaml` | P1 — optional `answer` (ObjectiveAnswer) on AttemptRecord |
| `services/intelligence/contracts/phase2/fixtures/attempt-record-*.json` | P1 — answer-bearing fixtures |
| `services/intelligence/contracts/phase2/tests/test_contracts.py` | P1 — answer round-trip + absence-of-key regression |
| `services/intelligence/app/routers/assessments.py` | P1 — `_attempt_record` echoes `row.answer` |
| `services/intelligence/tests/test_assessments_api.py` | P1 — read-route answer echo + redaction (no answer_block) |
| `apps/app/src/assessments/types.ts` | P2 — `AttemptRecord.answer?: ObjectiveAnswer` |
| `apps/app/src/assessments/testing/fakeAssessmentClient.ts` | P2 — answer-bearing attempt script helper |
| `apps/app/src/pages/assessments/review/*` (new: ReviewSurface, SummaryBand, QuestionNavigator, QuestionReviewCard, treatments, AttemptHistory, review.css) | P3 — production review module (D-03/D-05) |
| `apps/app/src/pages/assessments/AssessmentDetail.tsx` | P4 — wire review surface into the ready state (D-04) |
| `apps/app/src/pages/assessments/review/*.test.tsx`, `AssessmentDetail.test.tsx` | P4 — component matrix (five states, history, retry, redaction DOM) |
| `e2e/assessment-review-40-live.spec.ts` (new) | P5 — live spec mirroring the #39 live-spec pattern |

## Phases

### Phase 1 — Read-route answer echo (contract + serializer + tests) `☐ Not started`
1. openapi: optional `answer` on AttemptRecord ($ref ObjectiveAnswer); fixtures updated; contracts test (echo present, key vocab absent).
2. `_attempt_record` includes `row.answer`; route test: owner sees own answer, `answer_block`/correctIndex never serialized.
**Verification:** `uv run pytest services/intelligence/contracts/phase2/tests services/intelligence/tests/test_assessments_api.py -q` green.

### Phase 2 — Client types + fake (TDD seam) `☐ Not started`
1. `AttemptRecord.answer?: ObjectiveAnswer` in types.ts; fake script helper for answer-bearing attempts.
2. Refresh/merge path already carries grade through; confirm answer flows into local rows on refresh without touching local answers (existing test pattern).
**Verification:** `pnpm --filter app test src/assessments` green.

### Phase 3 — Review module (port from prototype) `☐ Not started`
1. New `review/` module per D-03/D-05: shell + summary + navigator + review card + three treatments (objective full; written/coding shared-shape + placeholders) + history + timeline + review.css.
2. View-model builder: assessment + questions + attempts-by-question → five states (D-02); display status from latest attempt (correct / score≥0.6 partial / incorrect / processing / pending).
**Verification:** new vitest suites (view-model matrix, five states, history oldest→latest + latest-expanded, placeholders present); typecheck/lint green; redaction grep clean.

### Phase 4 — Wire into AssessmentDetail + retry (TDD seam) `☐ Not started`
1. Ready state renders ReviewSurface (summary + navigator + panels) with AttemptTaker retained per question for answering/retry (D-04/D-06); generating/failed shells untouched.
2. Per-question retry → submitObjectiveAttempt + queued skeleton; whole-assessment retry → fan-out + timeline entry; retry hidden while latest is in flight.
**Verification:** AssessmentDetail + review component tests green (retry mints fresh clientAttemptId, history append-only, prior timeline collapsed-but-present); typecheck/lint green.

### Phase 5 — Static sweep + live browser pass `☐ Not started`
1. `pnpm typecheck` + `pnpm lint` + `pnpm --filter app test`; `uv run pytest`; contracts tests; redaction grep (no answerBlock/answer_block/correctIndex/correct_index/referenceSolution/hiddenTest in `apps/app/src/`).
2. Live (rules 10/53): restart full-app, review a graded assessment at 375×812 + 1280×800 against the prototype states (ready/partial/processing/failed/retried), exercise per-question + whole-assessment retry in-browser, fresh-device restore shows server answers. Evidence to `plan/evidence/`.
3. AC tick-down in VERIFICATION.md; then wayfinder resolution (comment + close #40 + map #4 line).

## Out of scope
- Written/coding grading producers (#41/#42 own `llm_rubric`/`judge0`); their treatments' placeholder content.
- Mastery/BKT update (#43), guide/reveal, Socratic anything.
- Any change to `public.events`, SyncEngine wire protocol, Dexie schema version, or the submit path.
- Practice reuse of QuestionReviewCard (#16 names it; port keeps the `(question, attempt)` signature so reuse stays possible).

## Open questions
- None blocking. If `select=*` on list_attempts ever stops returning `answer` (column-select tightening), STOP and surface — D-01 assumes the row arrives intact.
