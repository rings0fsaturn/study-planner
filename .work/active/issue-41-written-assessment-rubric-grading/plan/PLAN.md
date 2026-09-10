# Written Assessment and Rubric Grading (#41) — Implementation Plan

**Date written:** 2026-09-10 · **Ticket:** [#41](https://github.com/rings0fsaturn/study-planner/issues/41) (claimed `rings0fsaturn`) · **Parent:** spec #32 · map #4 · **Branch:** `phase2/issue-40-41` (already checked out)
**Plan status:** 🟡 In progress — P1 (contract amendment) done 2026-09-10 (d111ead); P2 (written generation + migrations 027/028) done 2026-09-10 (tree uncommitted); P3 (`llm_rubric` grading arm) done 2026-09-10 (tree uncommitted); user scoping locked (1.a extend AttemptTaker, 2.a per-criterion rubric, 3.a full live pass).
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
| `services/intelligence/app/grading/rubric_grader.py` (new) | P3 — schema, message builder, pure normalizer (`grade_written`), failure classifier |
| `services/intelligence/app/grading/worker.py` | P3 — family branch: written → provider call + normalize; retryable vs fail-closed |
| `services/intelligence/app/grading/grader.py` | P3 — `_per_skill` → public `per_skill_observations`, shared by both arms |
| `services/intelligence/app/generation/openrouter_client.py` | P3 — `schema_name` constructor parameter (default `grounded_mcq`) |
| `services/intelligence/app/worker_main.py` | P3 — `_build_openrouter_adapter(prefix, schema)`, grading arm wired to the rubric schema |
| `services/intelligence/tests/` | P2/P3 — generation, written grading, worker, route: `test_generation_*`, `test_assessments_api`, `test_rubric_grader` (new), `test_grading_worker`, `test_worker_main` |
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

### Phase 2 — Written generation (prompts + validation + worker + recipe + migration 027) `✅ Complete — 2026-09-10`
1. `prompts.py`: WRITTEN_SCHEMA + `build_written_messages` (grounded-stem + rubric-authoring instructions in one typed call); `validation.py`: written gate + shared citation check; `worker.py`: schema/validate/accept branch per recipe format (written accept row: format/subtype/empty options/rubric answer_block); `_repair_once` parameterized by schema.
2. Recipe gate accepts `['written']`; `_question` serializes `subtype`.
3. Migration 027: submit RPC format gate → `IN ('objective','written')`.
**Verification:** service pytest green (new written generation tests: schema/validation/accept/repair-drop + route 400 matrix); migration applies clean on dev Supabase (rule 36; dry-run first per rule 80 if scripted).

**Notes (filled in during implementation):**
- TDD honored: the written prompt/schema/gate/worker/route assertions were written first and observed RED (import errors), then the implementation turned them green. Focused set (prompts + validation + models + worker + assessments API) 119 passed.
- Gate: `uv run pytest services/intelligence/tests -q` → 471 passed, 7 failed; the 7 are exactly the pre-existing clean-tree failures recorded in `state.md` (`test_retrieval_probe` 2 + `test_v1_integration` calibration goldens 5), re-confirmed by running those two files alone. Contracts stay 20 passed. `ruff check` clean on every changed file (the tree's pre-existing ruff noise — 3 x I001 in #39 test files + 1 x E501 at `routers/assessments.py:168` present in HEAD — was left alone).
- Deviation (a), scope: 027 does more than the plan's "submit RPC format gate" because `questions` had no `subtype` column, 023's `complete_assessment_generation` enumerates the accepted question columns (`023:36-43`), and the authenticated read path is a *column* grant (018/022). 027 therefore adds the column + CHECK, extends the grant, and re-creates both RPCs. Renamed to `027_written_question_subtype_and_attempt_gate.sql` to match its actual content.
- Deviation (b), a real regression caught live: 027 re-created the completion RPC from the **023** text, silently dropping **024**'s `(p_question->>'user_id')::uuid` cast. plpgsql bodies are parsed at first execution, so 027 applied clean and every live accept (objective *and* written) would have failed with `42804 column "user_id" is of type uuid but expression is of type text`. The P2 live probe caught it; `028_completion_rpc_uuid_cast_restore.sql` restores the cast on top of 027's subtype column, and 027 was left as pushed per rule 35 (never rewrite an applied migration). Pitfall: before `CREATE OR REPLACE`-ing a function, grep the whole migrations directory for that name and copy its most recent body.
- Deviation (c): `expectedLengthWords` stays an optional property of `WRITTEN_SCHEMA` but is not persisted — P1's `Question` has `additionalProperties: false` and no such field, 018 has no column, and D-04 sizes the textarea from `subtype`. Recorded instead of added because persisting it needs a contract change outside P2's slice.
- Deviation (d): `GenerationBlueprint` gained `question_format` (default `objective`) and the worker now labels telemetry per family via `blueprint.prompt_template_version` (`written-v1` for written) so the research record distinguishes the two prompts; objective rows keep `v1`, so every pre-existing assertion is untouched.
- Deviation (e): the submit route gained the server half of D-02's answer gate (missing/blank/non-string text, or text over the contract's 20000, → 400 `invalid_request`) in the same change that admits written attempts; the client half stays P4. Objective answers carry no `text` key, so the gate cannot touch them.
- Deviation (f), authorship model kept literal: the model chooses `short_answer` vs `long_form` (D-01 lists `subtype` in the authored visible payload and D-04 scopes the config picker to `formats` only), so nothing in the recipe selects the subtype. Consequence for P5: the live pass must re-roll to exercise both subtypes — recorded in `state.md` Open rather than inventing a config control this plan did not scope.
- Deviation (g), schema vs gate: `WRITTEN_SCHEMA` requires 2..6 rubric criteria (a one-criterion rubric is holistic grading in disguise, and the user chose per-criterion 2.a) while the hard gate accepts >= 1 so an otherwise usable rubric grades instead of dropping the assessment; weights must sum to 1 within 0.02, and only `criterion`/`weight`/`maxPoints` are copied into `answer_block` so an unexpected provider key cannot ride into the hidden block.
- Live verification (dev Supabase, project `kabpmbhlvfbrhtbxjaua`): dry-run listed exactly the pending files, then `db push` applied 027 and 028. A `BEGIN; … ROLLBACK;` probe against the real project proved: the completion RPC accepts a written row (format `written`, subtype `long_form`, `answer_block` carrying the rubric criterion + reference answer), the assessment flips to `ready`, an objective row carrying a `subtype` is rejected by `questions_subtype_valid`, and `information_schema.column_privileges` still lists `subtype` while excluding `answer_block` for `authenticated` (no table-level privilege either, so 022's revoke holds). Probe left no residue (0 rows matching `probe-41%`).

### Phase 3 — llm_rubric grading arm (grader + worker branch + tests) `✅ Complete — 2026-09-10`
1. `rubric_grader.py` pure normalizer (TDD seam): criterion scores × weights → score; τ per-skill; explanation + rubricBreakdown + warnings composition; fail-closed on missing rubric/empty answer.
2. Worker branch: written → grading messages (rubric + reference + learner text + quotes) → shared OpenRouter client → normalize → `complete_attempt`; provider timeout/quota/malformed → retryable; unusable config → fail-closed.
**Verification:** `uv run pytest services/intelligence/tests -q` green (rubric math incl. weight renormalization, threshold edges, timeout/provider/partial matrices, redaction of rubric/reference in results).

**Notes (filled in during implementation):**
- TDD honored: `tests/test_rubric_grader.py` (new) + the written cases in `tests/test_grading_worker.py` were written first and observed RED (`ModuleNotFoundError: app.grading.rubric_grader`), then the implementation turned them green.
- Gate: focused set (rubric grader + grading worker + grading grader + worker main + assessments API) 76 passed; contracts 20 passed; `uv run pytest services/intelligence/tests -q` → 501 passed, 7 failed — exactly the pre-existing clean-tree set (`test_retrieval_probe` 2 + `test_v1_integration` calibration goldens 5). `ruff check` clean on every changed file (the tree's pre-existing noise, 3 x I001 in #39 test files + E501 at `routers/assessments.py:168`, was left alone; the I001s introduced in the two files this phase edited were fixed).
- Live dry run (one real OpenRouter call, per rule 80; 565 tokens, 10.9 s, outcome `ok`): the provider accepts `RUBRIC_GRADING_SCHEMA` under strict mode (3 criterion judgments returned, 171 completion tokens); a deliberately two-of-three-criteria answer composed to `score 0.70 / correct true` with `met = [true, true, false]`; the persisted grade carried no `referenceAnswer`, `rubricVersion`, or `maxPoints`. Script kept outside the repo (`/tmp/grade41_smoke.py`).
- Deviation (a), signature: D-03 sketched `grade_written(question_row, answer, provider_response)`; the implementation takes keyword arguments (`question_id`/`material_id`/`skill_tags`/`answer_block`/`answer`/`provider_payload`/`graded_at`/`attempt_id`/`model_version`) mirroring `grade_objective`, so both arms of one worker read the same way.
- Deviation (b), a policy D-03 did not name: provider failures that are *not* retryable (`safety_block`, `provider_credentials`, `unsupported_request`, generic `provider_error`) fail the attempt **closed** — status `failed` with a score-0 ungradable grade and a non-retryable job failure — rather than re-queueing forever or leaving the learner on an endless "grading" state. The retryable set is exactly D-03's timeout/quota/malformed plus `provider_unavailable` (PIPELINES matrix), and those redeliver with the attempt left in flight.
- Deviation (c): `_ungradable` gained a `grader` parameter so a written fail-closed grade reports `llm_rubric` instead of claiming `objective`; the objective path's output is unchanged.
- Deviation (d): `grader.py`'s private `_per_skill` became public `per_skill_observations` and is now shared by both arms, so a written and an objective observation mean the same thing at the τ≈0.6 threshold. No behavior change (objective output byte-identical; its tests untouched and green).
- Deviation (e): `OpenRouterGenerationClient` gained a `schema_name` constructor parameter (default `grounded_mcq`) because the adapter hardcoded the generation schema name into the `response_format` request; written grading passes `written_rubric`. Generation construction and payload are unchanged.
- Deviation (f): `worker_main` gained `_build_openrouter_adapter(prefix, schema_name)` and `_build_grading_worker(repo, queue, adapter)`; the grading arm reads `GRADING_MODEL` (default = the DeepSeek id) and reuses `GENERATION_BASE_URL` as the shared provider endpoint. Generation env names and defaults are unchanged (its two `worker_main` tests still pass verbatim).
- Deviation (g), budget guard: the worker validates the learner answer *and* the rubric before the provider call, so an empty submission or a rubric-less question costs no provider budget (both asserted with a fake adapter that fails if called).
- Deviation (h), success-shape: a *graded* written result deliberately omits `publicFeedback` so the #40 review surface renders the rubric `explanation` (`reviewModel.ts:199` prefers `publicFeedback`), matching the P1 `written-attempt-record.json` fixture; fail-closed written grades keep the objective arm's `publicFeedback` posture so the reason is visible. `grader: llm_rubric` + `modelVersion` + `rubricBreakdown` are the written-only additions, all inside the P1 contract.
- Not in scope, deliberately: no grading telemetry record (the objective arm emits none either) and no change to `questions`/`answer_block` access. Rubric/reference text appears only as provider prompt input.

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
- Retired 2026-09-10 (P3): the provider-accepts-our-schema risk. The rubric grading schema was exercised against the real OpenRouter DeepSeek endpoint under strict mode in P3's dry run (outcome `ok`, three criterion judgments, one call, 565 tokens), so the nested-object shape survives provider-side schema validation. P5 still exercises the generation-side written schema end to end.
