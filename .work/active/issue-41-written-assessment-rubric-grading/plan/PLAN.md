# Written Assessment and Rubric Grading (#41) — Implementation Plan

**Date written:** 2026-09-10 · **Ticket:** [#41](https://github.com/rings0fsaturn/study-planner/issues/41) (claimed `rings0fsaturn`) · **Parent:** spec #32 · map #4 · **Branch:** `phase2/issue-40-41` (already checked out)
**Plan status:** 🟡 In progress — P1 (contract amendment) done 2026-09-10; user scoping locked (1.a extend AttemptTaker, 2.a per-criterion rubric, 3.a full live pass).
**Downstream:** unblocks #42 (coding) + #43 (mastery); #44/#48 need #39+#43.

> Runbook convention inherited from the #38/#39/#40 plans: implement one phase per session, statuses updated in the same commit as the work, STOP on any reality-mismatch.

## TL;DR

Add written `short_answer` + `long_form` questions to the assessment flow end to end. Generation authors a typed visible payload (prompt, subtype, expected-length hint) plus a server-only hidden block (per-criterion rubric + reference answer) stored in `questions.answer_block`. Taking reuses the verified submit→queue→grade→refresh path with a textarea branch in AttemptTaker; the written answer shape `{ text }` rides the owner-scoped rows only. Grading runs an `llm_rubric` arm on the same `assessment_grade` queue: the worker fetches question + attempt, calls the OpenRouter DeepSeek client with rubric + reference + learner text + citations, normalizes the typed response (per-criterion scores → overall score ∈ [0,1], τ≈0.6 per-skill binary, explanation, warnings), and persists the public `QuestionGraded` — rubric and reference never serialize. The #40 review surface keeps its shell and fills its `WrittenFeedback` placeholder with the criterion breakdown table.

## Acceptance criteria → where they are met

| AC | Meaning | Met by |
|---|---|---|
| AC1 | Written generation uses typed visible payloads + server-only rubric content | D-01 + P2: `WRITTEN_SCHEMA` (visible payload + rubric + reference), written prompts, validation, `_accept_question` writes `format:'written'` + rubric-bearing `answer_block`; recipe gate accepts `['written']`; redacted read path unchanged |
| AC2 | Grading returns normalized score, rubric feedback, explanation, citations, warnings, per-skill observations | D-03 + P3: `llm_rubric` grader normalizes the typed provider response; `complete_attempt` persists public grade; `QuestionGraded` already carries score/correct/perSkill/explanation/grader/modelVersion |
| AC3 | Partial, timeout, provider, retry, no-leakage behavior tested | D-05 + P2–P5: repair-once + safe-drop generation; grading retryable-vs-fail-closed split; redaction grep (rubric/reference keys); provider-timeout + partial unit tests |
| AC4 | Results render through the shared review surface | D-04 + P4/P6: fill `WrittenFeedback` placeholder (criterion table + explanation + per-skill + citations), AttemptTaker textarea branch; full live pass at 375×812 + 1280×800 with real LLM grades |

## Context — live stack facts (verified 2026-09-10, trust over older notes)

- Generation is objective-only today: recipe gate `formats==['objective']` + count 1 (`routers/assessments.py:32-48`); worker hardcodes `format:'objective'` + `answer_block:{correctIndex}` (`generation/worker.py:281-292`); prompts + validation are MCQ-only (`prompts.py` MCQ_SCHEMA, `validation.py` format_failures); `_repair_once` reuses MCQ_SCHEMA.
- Contract already reserves the seams: `QuestionGraded.grader` enum includes `llm_rubric`, `explanation` field exists (openapi.yaml:145); `written-grading.json` fixture shows a normalized rubric shape; PIPELINES.md:70 "written grading uses the normalized rubric response and keeps the rubric server-side"; #13 typed-gen: written hidden block = rubric + reference answer.
- Grading pipeline (#39): `grading/grader.py` (deterministic objective) + `grading/worker.py` (third arm, `assessment_grade` queue, `GradingRepo` narrow protocol, fail-closed `_ungradable`); submit RPC `026` rejects non-objective (`v_question.format <> 'objective'` → `only objective questions grade in this slice`); submit route accepts any dict answer so written submits would enqueue then fail closed.
- Client: `AttemptTaker.tsx` (243 lines, objective controls + verified phases), `attemptFlow.ts` (403 lines, `submitObjectiveAttempt` typed `ObjectiveAnswer`), `types.ts` (`AttemptSubmitInput.answer: ObjectiveAnswer`; `ObjectiveAnswer.value` maxLength 500 in contract — too small for long-form); #40 `ReviewSurface.tsx:414` `WrittenFeedback` placeholder renders explanation + per-skill + citations; `reviewModel.ts` display statuses are grade-shape-agnostic (correct/partial≥0.6/incorrect) so no view-model change.
- DB: `questions.format` CHECK already allows `('objective','written','coding')` (018:64); `answer_block` is service_role-only by column grant (018) and the completion RPCs (023/024) pass it through opaquely; the submit RPC `026` needs its format gate widened (migration 027).
- #50 (LLM learner-feedback contract) is OPEN/blocked-by-#35 and NOT blocking: #41 owns grade explanation + rubric feedback (already in contract); #50 owns the roadmap/mastery narrative layer.
- Config UI (`AssessmentConfig.tsx:112-152`) hardcodes `formats:['objective']`, count 1, "One objective question" copy — gains a family picker in P4.
- Baselines: app vitest green, service pytest green + contracts tests (post-#40). WSL rule 53 quirks apply to any live run; ingestion worker must be started for live grading; live mutation specs run `--workers=1`.

## Decisions log

### D-01: Written generation = typed response schema + per-criterion rubric in answer_block
**Decision:** new `WRITTEN_SCHEMA` in `generation/prompts.py`: visible payload (`stem`, `subtype: short_answer|long_form`, `expectedLengthWords?`, `difficulty`, `skillTags`, `citations`) + server-only hidden block (`rubric: [{criterion, weight, maxPoints}]`, `referenceAnswer`, `rubricVersion`). `validation.py` gains a `written_format_failures` gate (stem present; subtype valid; ≥1 weighted rubric criterion with weights summing ≈1; reference non-empty; citation scope rule shared with MCQ). `_accept_question` branches on recipe format: written rows store `format:'written'`, empty `options`, rubric-bearing `answer_block`. Recipe gate accepts `['objective']` or `['written']` (mixed-family generation stays out — one family per assessment, matching the count-1 slice).
**Rationale:** AC1 verbatim; per-criterion (user-confirmed 2.a) is what AC2 and the #40 placeholder promise; weights enable deterministic score composition from provider criterion scores.

### D-02: Written answer shape `{ text }` (new WrittenAnswer, contract + client)
**Decision:** contract gains `WrittenAnswer: { text: string, maxLength 20000 }`; `AttemptRecord.answer` becomes `oneOf [ObjectiveAnswer, WrittenAnswer]` (owner-scoped read only); client adds `WrittenAnswer` + `AttemptSubmitInput.answer: ObjectiveAnswer | WrittenAnswer`; `LocalAttemptRow.answer` widens the same way. Empty/whitespace-only text is rejected client-side (no submit) and server-side (`invalid_request`).
**Rationale:** separates the 20k written budget from the 500-char objective value; keeps the owner-echo posture (#40 D-01) for restore.

### D-03: llm_rubric grading arm on the same queue, fail-closed normalization
**Decision:** `grading/rubric_grader.py`: pure `grade_written(question_row, answer, provider_response) → QuestionGraded-public` — per-criterion scores × weights → overall score; `correct = score ≥ 0.6`; perSkill = per-question skill_tags at the overall score (map #6 τ); public fields = score/correct/perSkill/explanation(+criterion breakdown in `publicFeedback`? no — breakdown rides a new optional `rubricBreakdown` on the grade, see P1)/citations passthrough/warnings. `grading/worker.py` branches on `question.format`: objective → deterministic grader; written → build rubric-grading messages (rubric + reference + learner text + citation quotes), call the shared OpenRouter client, normalize, persist via `complete_attempt`. Provider timeout/quota/malformed → retryable job failure (message redelivered, attempt stays queued/grading); unusable question config (no rubric) or empty answer → fail-closed graded/failed with score 0, never a retry loop. `grader: 'llm_rubric'`, `modelVersion` = model id.
**Rationale:** AC2/AC3; reuses the proven queue/job/result machinery; score composition is deterministic even though criterion judgments are LLM-produced.

### D-04: UI — extend AttemptTaker (1.a), fill WrittenFeedback (no shell changes)
**Decision:** AttemptTaker gains a `question.format === 'written'` branch: textarea (rows 3 short_answer / 8 long_form from `subtype` — needs a client-visible subtype: read from where? `Question` has no subtype field today — P1 adds optional `subtype` to the redacted `Question` schema + `_question` serializer; options stays empty for written), same phases (answering → submitting → queued-offline → grading → graded/failed + identical retry/history blocks). Review `WrittenFeedback` replaces its placeholder with: explanation, criterion breakdown table (criterion, points, feedback line), per-skill, citations. `reviewModel.ts` untouched (grade-shape-agnostic). AssessmentConfig gains a family picker (objective/written) driving `formats`.
**Rationale:** user-confirmed 1.a — one taking component, verified phases; #41 fills its treatment without touching the review shell (D-05 of #40).

### D-05: Failure semantics mirror #38/#39
**Decision:** generation: malformed written output → one repair → else drop with `malformed_output` (assessment failed when count-1 slice drops); safety block → partial/failed + `safety_block` warning; quota/timeout → retryable, assessment stays `generating` with warning. Grading: provider timeout/quota/malformed-response → `mark_job_retryable` (attempt stays in flight, UI shows grading); empty answer / missing rubric → fail-closed. Redaction grep extends the #40 list with rubric/reference keys.
**Rationale:** AC3; the retry/timeout matrix already exists — written plugs into it rather than inventing a new one.

### D-06: No new events, no Dexie bump, one migration (027)
**Decision:** events unchanged (QuestionAttempted/QuestionGraded payloads are format-agnostic; `answerKind` already allows `'written'`). Dexie unchanged (rows store the answer opaquely). Migration `027_written_attempts_format_gate.sql` widens the submit RPC gate to `format IN ('objective','written')` (CREATE OR REPLACE, following the 026 pattern). No new queues.
**Rationale:** written rides the durable record #39 built; the only DB change is the format gate that currently rejects written.

## Files-touched index

| File | Change |
|---|---|
| `services/intelligence/contracts/phase2/openapi.yaml` | P1 — `WrittenAnswer` schema, `AttemptRecord.answer` oneOf, optional `subtype` on Question, optional `rubricBreakdown` on QuestionGraded |
| `services/intelligence/contracts/phase2/fixtures/` + `tests/` | P1 — written question + written grade fixtures, contracts test |
| `apps/app/supabase/migrations/027_written_attempts_format_gate.sql` | P2 — submit RPC accepts written (026 pattern) |
| `services/intelligence/app/generation/prompts.py` | P2 — WRITTEN_SCHEMA + written message builder |
| `services/intelligence/app/generation/validation.py` | P2 — written format gate + shared citation check |
| `services/intelligence/app/generation/worker.py` | P2 — format branch (schema select, accept row shape) |
| `services/intelligence/app/routers/assessments.py` | P2 — recipe gate `['written']`, `_question` subtype |
| `services/intelligence/app/grading/rubric_grader.py` (new) | P3 — pure normalize: criterion scores → public QuestionGraded |
| `services/intelligence/app/grading/worker.py` | P3 — format branch: written → provider call + normalize |
| `services/intelligence/tests/` | P2/P3 — generation + rubric + worker + route tests |
| `apps/app/src/assessments/types.ts` | P4 — WrittenAnswer, widened submit/row types |
| `apps/app/src/assessments/testing/fakeAssessmentClient.ts` | P4 — written script helpers |
| `apps/app/src/pages/assessments/AttemptTaker.tsx` | P4 — written textarea branch (D-04) |
| `apps/app/src/pages/assessments/AssessmentConfig.tsx` | P4 — family picker |
| `apps/app/src/pages/assessments/review/ReviewSurface.tsx` | P4 — fill WrittenFeedback (criterion table) |
| `apps/app/src/pages/assessments/*.test.tsx` | P4 — taking + review + config tests |
| `e2e/assessment-written-41-live.spec.ts` (new) | P5 — live spec mirroring the #40 pattern |

## Phases

### Phase 1 — Contract amendment (schemas + fixtures + contracts test) `✅ Complete — 2026-09-10 (d111ead)`
1. openapi: `WrittenAnswer` (`text`, maxLength 20000); `AttemptRecord.answer` oneOf Objective/Written; `Question.subtype` optional (`short_answer|long_form`); `QuestionGraded.rubricBreakdown` optional (typed criterion lines).
2. Fixtures: written question (visible payload), written grade (per-criterion + normalized); contracts test (round-trip + rubric/reference vocab absent from every client-visible schema).
**Verification:** `uv run pytest services/intelligence/contracts/phase2/tests -q` green.

**Notes (filled in during implementation):**
- TDD cycle honored: the six new/updated assertions were written first and observed failing (6 failed / 14 passed), then the openapi amendment + fixtures turned them green (20 passed).
- Deviations (all additive, none contradicting a decision): (a) the existing `test_attempt_schemas_exclude_hidden_content` asserted `answer` was a plain `$ref` to `ObjectiveAnswer`; it now asserts the `oneOf` branch set, which is exactly what D-02 changes. (b) Three fixtures added rather than two: `written-question.json` (the visible payload), `written-attempt-submit.json` (learner input), `written-attempt-record.json` (the graded record with `rubricBreakdown`) — the plan named "written question" + "written grade", and separating submit from record keeps each fixture validating one contract. (c) `fixtures/README.md` gained an "OpenAPI-validated fixtures" section because these target inline `openapi.yaml` schemas that the JSON-only `manifest.json` loader cannot reference; the section also documents the pre-existing #39 attempt fixtures that were previously unlisted.
- Clarification recorded (no STOP needed, no decision changed, no phase step affected): D-03 lists "citations passthrough / warnings" among the written grader's public fields, but `QuestionGraded` carries neither — and correctly so. Citations ride `Question.citations` and warnings ride `Assessment.warnings`, both already on the read path that #40's review surface renders (`CitationList`, `SummaryBand`). AC2's "citations, warnings" is therefore met by the composed graded-review payload, not by new fields on the grade object. P3 must not add citations/warnings to `QuestionGraded`; P4's written treatment renders the question citations it already receives.
- The rejected YAML alternative is worth remembering: `openapi.yaml` uses flow mappings, so a colon-space inside an unquoted `description` scalar is a parse error; descriptions here use semicolons instead.

### Phase 2 — Written generation (prompts + validation + worker + recipe + migration 027) `☐ Not started`
1. `prompts.py`: WRITTEN_SCHEMA + `build_written_messages` (grounded-stem + rubric-authoring instructions in one typed call); `validation.py`: written gate + shared citation check; `worker.py`: schema/validate/accept branch per recipe format (written accept row: format/subtype/empty options/rubric answer_block); `_repair_once` parameterized by schema.
2. Recipe gate accepts `['written']`; `_question` serializes `subtype`.
3. Migration 027: submit RPC format gate → `IN ('objective','written')`.
**Verification:** service pytest green (new written generation tests: schema/validation/accept/repair-drop + route 400 matrix); migration applies clean on dev Supabase (rule 36; dry-run first per rule 80 if scripted).

### Phase 3 — llm_rubric grading arm (grader + worker branch + tests) `☐ Not started`
1. `rubric_grader.py` pure normalizer (TDD seam): criterion scores × weights → score; τ per-skill; explanation + rubricBreakdown + warnings composition; fail-closed on missing rubric/empty answer.
2. Worker branch: written → grading messages (rubric + reference + learner text + quotes) → shared OpenRouter client → normalize → `complete_attempt`; provider timeout/quota/malformed → retryable; unusable config → fail-closed.
**Verification:** `uv run pytest services/intelligence/tests -q` green (rubric math incl. weight renormalization, threshold edges, timeout/provider/partial matrices, redaction of rubric/reference in results).

### Phase 4 — Client taking + review + config (TDD seam) `☐ Not started`
1. types.ts + fake helpers; AttemptTaker written branch (textarea rows by subtype, non-empty gate, identical phases/retry/history); AssessmentConfig family picker; ReviewSurface WrittenFeedback criterion table.
2. Component tests: written submit/grade/empty-gate, review breakdown render, config recipe, refresh-merge of written answers, redaction DOM.
**Verification:** `pnpm --filter app test` green; typecheck + lint clean; redaction grep clean (rubric/reference/answer_block keys + #40 list).

### Phase 5 — Static sweep + full live pass (user-confirmed 3.a) `☐ Not started`
1. `pnpm typecheck` + `pnpm lint` + `pnpm --filter app test`; `uv run pytest`; contracts tests; redaction grep.
2. Live (rules 10/53, `--workers=1`): restart full-app + ingestion worker; generate written (short_answer + long_form); answer in browser; real LLM grade; review at 1280×800 + 375×812 (criterion table, explanation, citations, no overflow); retry → fresh attempt; restore shows echoed written answer. Evidence to `plan/evidence/`.
3. AC tick-down in VERIFICATION.md; then wayfinder resolution (comment + close #41 + map #4 line).

## Out of scope

- Coding grading (#42 owns `judge0`); mastery/BKT update (#43); guide/reveal; Socratic anything.
- Mixed-family generation in one assessment (one family per assessment in this slice).
- Holistic-only fallback (user chose per-criterion, 2.a).
- Any change to `public.events`, SyncEngine wire protocol, Dexie schema version, or the review shell/navigator/history.
- #50's roadmap/mastery narrative feedback layer.

## Open questions

- None blocking. STOP conditions: provider schema validation rejects the WRITTEN_SCHEMA shape at runtime (surface — may need flattening); `_attempt_record` `select=*` stops returning `answer` for written rows (same D-01 assumption as #40).
