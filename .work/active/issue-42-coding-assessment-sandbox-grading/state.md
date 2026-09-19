# State – issue-42-coding-assessment-sandbox-grading

_Spec: GitHub [#42](https://github.com/rings0fsaturn/study-planner/issues/42) (copy: specs/phase2-tickets/10-coding-assessment-sandbox-grading.md) · Plan: active/issue-42-coding-assessment-sandbox-grading/plan/PLAN.md · STATUS row: issue-42-coding-assessment-sandbox-grading · Status: active — P4 done, P5 next · Updated: 2026-09-19_

## Current state & next

- P4 done: the client slice (coding taker + advisory + output_prediction + review table + config chip) is in, tested, and live-verified end to end against the real stack (see Done so far).
- Next: P5 — `e2e/coding-assessment-live.spec.ts` (durable live spec: redaction sweep over responses + DOM, hidden-veil assertions, failure drill, window-scoped cleanup), AC sweep on #42, records, wayfinder exit.
- P5 head start: `plan/VERIFICATION.md` "P5 notes" records the seed-row recipe (the LLM picks the subtype, so `output_prediction` needs a seeded row), the `insertText` CodeMirror typing trick, and the Piston demand-start/stop routine.

## Done so far

- 2026-09-16: wayfinder grilling rounds 1 (Q1–Q6) + 2 (Q7–Q11) resolved with the user; three fact surveys (generation gates, grading-pipeline attach, coding-format state) landed and confirmed the plan's citations.
- 2026-09-16: sandbox decision confirmed unchanged — self-host Judge0 CE per #11 (`research/external/code-sandbox-comparison.md`); Piston stays the documented fallback.
- 2026-09-16: P0 — #44 merged into `project/phase-2` via PR #65 (`3844f72`); #42 branch cut; plan committed (`a7f66e2`).
- 2026-09-16: P1 — migration `031` (coding columns + widened subtype CHECK + RPC re-creations + materials code signal + guard extension), openapi coding schemas + fixtures, `userrest` public columns, router admission + honest submit stub; pushed + live-probed (see Current state). Commit `fd3f79c`.
- 2026-09-16: P2 — Judge0 isolate gate failed (cgroup v1 vs v2, recorded) → user-approved Piston fallback; `piston_client.py` (synchronous execute, verdict map, clamps, typed errors, D-11 logs), `coding_grader.py` (hidden pass rate, veiled test table, deterministic templates), worker three-way dispatch + retryable-vs-terminal infra split, `worker_main._build_piston_client`, compose `piston` service (profile `sandbox`), router stub lifted; 46 new grading tests + worker/router test updates; full suite 625/5, contracts 28/28, ruff clean, rule-80 live round-trip green.
- 2026-09-16: P3 — generation coding arm + code signal. `coding_schema` 3-branch union (unsuitable | tests-bearing | output_prediction; the LLM picks the subtype), `CODING_SYSTEM_TEMPLATE` carrying the full authoring contract (stdin→stdout execution model, no markdown fences, numeric-only `acceptedValue`, 2-3 visible / 1-10 hidden tests), `validate_coding` (unsuitable short-circuit → `code_not_derivable`, shared citation gate, `strip_code_fence`), worker three-way dispatch via `_arm`, `_coding_answer_block` whitelist + `_coding_row`, mandatory generation-time self-check (referenceSolution over all authored tests; failure drops with `self_check_failed` warning; retryable sandbox error keeps the assessment `generating`; non-retryable fails closed; `output_prediction` skips the sandbox), ingestion `scan_code_blocks` → `materials.has_code`/`code_languages` (is-not-None semantics), `worker_main` shares one PistonClient between the arms. 52 new tests (45 coding + 7 code signal), full suite 673/5 (same 5 calibration), ruff check clean, rule-80 dry run green: `implement_fn` self-check 5/5 passed, `output_prediction` numeric, `debug` steer judged `code_not_derivable`. Commit `a459774`.
- 2026-09-19: P4 — client slice. `types.ts` (CodingSubtype/CodingAnswer/Question coding fields/TestCaseResult/caps), `attemptFlow` (`codingAnswerProblem`/`defaultCodingConfig`/`codingConfigProblem`/`submitCodingAttempt` + `predictionAnswerProblem`/`submitPredictionAttempt`; `recordGrade` identity fallback when the DB closes mid-poll), `advisoryRunner` (real Pyodide, **sandbox execution model**: whole program + `sys.stdin = io.StringIO(...)` + normalized stdout; lazy import), `CodingTaker` (lazy; CodeMirror composed to the D-06 ceiling - no autocompletion/lint; hidden textarea fallback deleted), `OutputPredictionTaker` (read-only snippet + numeric value input, no editor/Pyodide), `AttemptTaker` third branch (poll grader `judge0`, `objective` for predictions), `ReviewSurface` `CodingFeedback` (submitted source or snippet + prediction + public verdict table), `AssessmentDetail` coding heading + recipe fallback, `AssessmentConfig` Coding chip + no-code note, `PracticeThis` hint repoint, `materials` `hasCode`/`codeLanguages`, `sync-pyodide-assets.mjs` (+ gitignore), package deps (`codemirror` dropped; `@codemirror/commands`/`@codemirror/language` added). Gates: 114 focused tests, app suite 902/904 (2 documented WSL TZ flakes), typecheck/lint/build green, bundle measured (main +5.48 kB; CodeMirror/Pyodide in lazy chunks only). Live pass (seeded rows + real Piston): desktop coding taker/advisory/grading/review, desktop output_prediction, mobile 375 - 3/3, console clean, screenshots in `plan/evidence/`. Vision-pass fixes: advisory execution-model parity, uppercase code blocks, 420px editor cap, "Objective assessment" heading, prediction input width, `basicSetup` scope. See `plan/VERIFICATION.md`.

## Flow trace

1. Generation chain coding: router gate `routers/assessments.py:41` admits `["coding"]` → `assessment_generate` queue → `generation/worker.py` `_recipe_format` picks the coding arm (`_arm` dispatch) → `coding_schema` (3-branch oneOf, chunk-id bound) + `build_coding_messages` → `validate_coding` (unsuitable short-circuit, fence strip, shared citation gate) → `_coding_self_check` (referenceSolution over visible+hidden through Piston; drop on failure) → `_coding_row` → `complete_assessment` (migration 031 columns: `language`/`starter_code`/`visible_tests`; hidden side in `answer_block`).
2. Grading chain: `AttemptTaker` → `attemptFlow` → `POST .../attempts` → submit gate (widened by 031) → `assessment_grade` queue → `grading/worker.py:_process` (`_is_coding` dispatch) → `QuestionGraded` (`grader: 'judge0'`).
3. Contract already allowed coding (`openapi.yaml:141` formats, `:153` grader); P1 closed the gaps — `AttemptRecord.answer` oneOf += `CodingAnswer`, `Question` coding fields, `QuestionGraded.testCases`.
4. Storage: `018:64-65` already allowed `format='coding'`; 031 adds the visible columns, the widened subtype CHECK, and the RPC re-creations.
5. Code signal: `ingestion/worker.py:_handle_extract` scans `content.text` (`ingestion/code_signal.py:scan_code_blocks`) → `set_material_state(has_code, code_languages)` → `materials` row; browser reads it via Supabase `select('*')` (no API change).

## Files affected

- `.work/active/issue-42-coding-assessment-sandbox-grading/plan/PLAN.md` – the plan (new 2026-09-16).
- `.work/active/issue-42-coding-assessment-sandbox-grading/state.md` – this doc.
- `.work/STATUS.md` – one Active row.
- `apps/app/supabase/migrations/031_coding_questions_and_code_signal.sql` – **new** (P1): questions `language/starter_code/visible_tests` + widened `questions_subtype_valid` + public-column grant; `complete_assessment_generation` re-created from the 028 body with the coding columns (`::uuid` cast kept); `submit_assessment_attempt` gate widened; materials `has_code/code_languages` + server-owned guard extended.
- `docker-compose.yml` – **P2**: `piston` service under `profiles: ["sandbox"]` (ghcr.io/engineer-man/piston, privileged, loopback 2000, `PISTON_RUN_*` ceilings, `piston-packages` volume, node healthcheck, `extra_hosts` CDN pin); `ingestion-worker` gains `PISTON_URL` (default `http://piston:2000`). Judge0 services removed after the gate failure.
- `docker/.env.example` – **P2**: sandbox note + `PISTON_URL`.
- `services/intelligence/app/grading/piston_client.py` – **new** (P2; replaces the deleted `judge0_client.py`): synchronous `POST /api/v2/execute`, status map (`TO`→timeout, `RE`/signal/non-zero→runtime, SyntaxError/IndentationError/TabError→compile_error, `XX`→retryable infra), clamps (15 s CPU / +1 s wall / 256 MB), typed `IngestionError`, D-11 verdict log with `trace_id`.
- `services/intelligence/app/grading/coding_grader.py` – **new** (P2): `TestVerdict`, `coding_submission` + `visible_tests`/`hidden_tests` validators (caps 3/10), `grade_coding` (hidden pass rate, `correct @ 0.6`, shared `perSkill`, deterministic templates, `Hidden test N` veil), `GRADER_NAME = "judge0"` (contract label).
- `services/intelligence/app/grading/worker.py` – **P2**: `_is_coding`, `_grade_coding` (output_prediction → `grade_objective`; visible+hidden runs; compile short-circuit + failed padding), `IngestionError` retryable-vs-terminal branch, ungradable labelled `judge0`, composed-outcome info log with `trace_id`.
- `services/intelligence/app/worker_main.py` – **P2**: `_build_piston_client` (`PISTON_*` env), `_build_grading_worker(..., sandbox=)`.
- `services/intelligence/.env.example` – **P2**: `PISTON_*` block (URL, python version, HTTP timeout, CPU/wall/memory ceilings).
- `services/intelligence/app/routers/assessments.py` – **P2**: P1 submit stub lifted; `_coding_answer_failures` (python-only, source ≤100000, config caps) + enqueue; output_prediction `{value}` falls through the generic gate. Caps imported from `coding_grader` (single source of truth).
- `services/intelligence/tests/test_grading_coding.py` – **new** (P2, 46 cases): client verdict map/error normalization/clamps/log redaction, grader math/templates/redaction, worker dispatch/short-circuit/infra split/output_prediction.
- `services/intelligence/tests/{test_worker_main,test_assessments_api}.py` – **P2**: Piston env wiring tests; stub test replaced by 201-admit + 9 reject cases + output_prediction admit.
- `services/intelligence/contracts/phase2/openapi.yaml` – `CodingAnswer` (python-only Day 1), `VisibleTestCase`, `TestCaseResult`, `Question` coding fields + widened subtype enum, `QuestionGraded.testCases`, `AttemptRecord.answer` oneOf += coding; drive-by: regenerate path gained `IdempotencyKey` (pre-existing #44 gap).
- `services/intelligence/contracts/phase2/tests/test_contracts.py` – 8 coding contract tests (28 total).
- `services/intelligence/contracts/phase2/fixtures/{coding-question,coding-attempt-record,coding-attempt-submit}.json` – **new**.
- `services/intelligence/app/userrest.py` – `QUESTION_PUBLIC_COLUMNS` += `language,starter_code,visible_tests`.
- `services/intelligence/app/routers/assessments.py` – `SUPPORTED_FORMATS` += `["coding"]`, `_question` serializes coding columns, submit stub rejects coding-shaped answers with `validation_failed`.
- `services/intelligence/tests/test_assessments_api.py` – coding 202, coding serialization, submit-stub tests; fake-client gate widened.
- `services/intelligence/app/generation/prompts.py` – **P3**: `CODING_PROMPT_TEMPLATE_VERSION = "coding-v1"`, `coding_schema` (3-branch oneOf: unsuitable | tests-bearing | output_prediction; caps from `coding_grader`), `CODING_SYSTEM_TEMPLATE`/`CODING_USER_TEMPLATE`/`build_coding_messages` (full authoring contract: stdin→stdout, no fences, numeric-only acceptedValue, 2-3 visible / 1-10 hidden).
- `services/intelligence/app/generation/validation.py` – **P3**: `strip_code_fence`, `_test_failures`, `coding_format_failures` (subtype-branched), `validate_coding` (unsuitable short-circuit → `code_not_derivable`; shared citation gate).
- `services/intelligence/app/generation/worker.py` – **P3**: `CODING_FORMAT`, `_arm` dispatch map, `_coding_answer_block` (whitelist) + `_coding_row` (031 columns), `_coding_self_check` (reference over all tests; drop `self_check_failed`; retryable keeps generating; non-retryable fails closed), `code_not_derivable` fail path (telemetry outcome `partial`), `GenerationWorker(sandbox=...)`.
- `services/intelligence/app/generation/models.py` – **P3**: docstring only (`question_format` now objective|written|coding).
- `services/intelligence/app/ingestion/code_signal.py` – **P3 new**: `scan_code_blocks(text) -> (has_code, languages)` (GFM 0-3-space fences, first info token, sorted de-duped lowercase).
- `services/intelligence/app/ingestion/worker.py` – **P3**: scan at `_handle_extract`, `has_code`/`code_languages` into `set_material_state`.
- `services/intelligence/app/ingestion/repository.py` – **P3**: `set_material_state` meta `has_code`/`code_languages` (is-not-None so False/[] are written).
- `services/intelligence/app/worker_main.py` – **P3**: one `PistonClient` shared by the generation self-check and grading arms.
- `services/intelligence/tests/test_generation_coding.py` – **P3 new** (45 cases): prompts/validation/worker incl. self-check pass/drop/infra split, answer-block whitelist, unsuitable no-repair, output_prediction skips sandbox.
- `services/intelligence/tests/test_code_signal.py` – **P3 new** (7 cases); `test_ingestion_worker.py` + `test_repository.py` + `ingestion_doubles.py` – wiring/signature updates.
- `apps/app/src/assessments/types.ts` – **P4**: `CodingSubtype`, `CodingAnswer`, `QuestionSubtype`, `Question.starterCode/visibleTests`, `LearnerAnswer` += coding, `TestCaseResult`, `QuestionGradedResult.testCases`, contract caps/defaults.
- `apps/app/src/assessments/attemptFlow.ts` – **P4**: `codingAnswerProblem`/`defaultCodingConfig`/`codingConfigProblem`/`submitCodingAttempt`; `predictionAnswerProblem`/`submitPredictionAttempt`; `recordGrade` identity fallback (no `undefined` when the DB closes mid-poll).
- `apps/app/src/pages/assessments/CodingTaker.tsx` – **P4 new** (lazy): CodeMirror composed to the D-06 ceiling, advisory run + badge, submit; `codingTaker.css` – **P4 new**: Marginalia editor theme, `.coding-snippet`, `.coding-field-group`, `.coding-prediction-input`.
- `apps/app/src/pages/assessments/OutputPredictionTaker.tsx` – **P4 new**: read-only snippet + numeric value input (no editor, no Pyodide).
- `apps/app/src/pages/assessments/advisoryRunner.ts` + `.test.ts` – **P4 new**: lazy Pyodide, whole-program stdin execution + sandbox-normalized stdout comparison; `sync-pyodide-assets.mjs` – **P4 new** (public/pyodide, gitignored).
- `apps/app/src/pages/assessments/AttemptTaker.tsx` – **P4**: coding branch (lazy editor / prediction input), `pollGrade` grader per subtype, sandbox grading copy.
- `apps/app/src/pages/assessments/AssessmentDetail.tsx` – **P4**: coding family heading + recipe fallback.
- `apps/app/src/pages/assessments/review/ReviewSurface.tsx` + `review.css` – **P4**: `CodingFeedback` (source/snippet + prediction + public verdict table), `.ar-code` own styling (no uppercase), answer-value uppercase exemption; `reviewModel.ts` – coding answer guards.
- `apps/app/src/pages/assessments/AssessmentConfig.tsx` – **P4**: Coding chip + honest copy + `hasCode === false` note; `PracticeThis.tsx` – hint repoint to #45 (D-08).
- `apps/app/src/materials/{types,materialClient}.ts` – **P4**: `hasCode`/`codeLanguages`.
- `apps/app/package.json` + `pnpm-lock.yaml` – **P4**: `codemirror` meta dropped; `@codemirror/commands` + `@codemirror/language` added; `pyodide` dep + asset sync.
- `.work/active/issue-42-coding-assessment-sandbox-grading/plan/VERIFICATION.md` + `plan/evidence/*.png` – **P4**: gates, bundle numbers, live pass, defect list, P5 notes.

## Pitfalls & rules

- Must follow rule 35 (new migration, never rewrite 027) and rule 36 (dry-run push, verify live grants) for migration 031.
- Must follow rule 17 (logging contract) per D-11: every new failure path logs with `request_id`/`trace_id`; learner source, hidden tests, and `answer_block` never log. The P2 logs: one `grading.piston` verdict line per executed test (attempt/test/outcome/duration + `trace_id`) and one `grading.worker` composed-outcome line (`score`/`correct` + `trace_id`).
- Must follow rule 22 (centralized fetch normalization) for the sandbox client errors and the coding submit path.
- **Judge0 cannot run on this host** (2026-09-16 gate): Judge0 CE 1.13.1 bundles isolate 1.8.1 which needs cgroup v1 (`/sys/fs/cgroup/memory/...`); Docker Desktop/WSL2 is cgroup v2-only → every submission dies status 13 Internal Error. Upstream judge0#543/#549, no fix in 1.13.1. Do not re-add Judge0 without a cgroup-v2-capable isolate build.
- **Sandbox is Piston** (`docker compose --profile sandbox up -d`, loopback 127.0.0.1:2000). Demand-start it (rule 54 pattern) and stop it after grading work; a stopped sandbox makes coding grades retryable, never silent.
- Piston image has **no curl/wget** (Debian 10, node only) — the compose healthcheck uses node; the Python runtime installs with `curl -X POST http://127.0.0.1:2000/api/v2/packages -H 'Content-Type: application/json' -d '{"language":"python","version":"3.12.0"}'` and persists in the `piston-packages` volume (one-time per volume). A failed package fetch crashes the node server (restart policy recovers it).
- Piston `extra_hosts` pins `release-assets.githubusercontent.com:185.199.108.133`: this network refuses 185.199.109.133 even from the host (rule 52 class). Re-check with `curl -sI https://release-assets.githubusercontent.com/` if installs start failing.
- Piston verdicts are `run.status` metadata, not HTTP status: `TO` timeout, `RE` runtime, `XX` internal (retryable), `OL`/`EL` output/error limit (killed → runtime), clean exit compares normalized stdout. Python has no separate compile stage — SyntaxError/IndentationError/TabError in stderr classify as `compile_error`.
- Enforced per-test ceilings (env-tunable, D-05): 15 s CPU, +1 s wall, 256 MB; the contract allows 30 s / 1024 MB requests, clamped by the client. Piston server-side backstops live in `PISTON_RUN_*` compose env.
- PracticeThis stays disabled until #45 (D-08) — no drive-by enablement in P4.
- WSL staleness (rule 53): restart runtime after edits; demand-start Piston + worker + sidecar for live work, stop after.
- 028 lesson: before `CREATE OR REPLACE`-ing an RPC, grep the whole migrations dir for the function name and copy its most recent body — a stale copy parses fine and dies at runtime (031 built on 028's body, verified live).
- PyYAML flow-mapping plain scalars truncate at `, ` (comma-space) — reworded openapi descriptions; keep new descriptions comma-free or quote them.
- Supabase PAT rotates: `services/intelligence/.env` SUPABASE_ACCESS_TOKEN went stale (401); user refreshed it 2026-09-16. Probe `GET https://api.supabase.com/v1/projects` before trusting it.
- `validation_failed` maps to HTTP 409 via the shared `service_error` map (serialization.py:19), not 400. Coding shape errors use `invalid_request` → 400.
- The provider accepted the `oneOf` coding schema under `strict: True` (P3 dry run 2026-09-16): no flat-schema fallback was needed. If a future provider rejects it, fall back to a flat schema with validator-enforced branch rules (the local validator is the authority either way).
- `code_not_derivable` maps to telemetry outcome `partial` (no contract outcome member exists; groundedness-over-count semantics), job error_code `code_not_derivable`, warning carries the LLM's learner-facing reason verbatim.
- `set_material_state` gates `has_code`/`code_languages` on `is not None` so `False`/`[]` are written for scanned materials; NULL stays reserved for never-scanned (D-10).
- The test double `FakeIngestionRepo.get_material` must pop `has_code`/`code_languages` from the row (server-owned, not in the worker's `Material` view) or the embed stage breaks (`Material(**row)`).
- Pre-existing `UP037` ruff findings in `app/generation/models.py:40,51` (quotes around annotations) exist on HEAD; not touched by P3 (ruff `check` clean on all touched files; `ruff format` is not a repo gate).
- **`.t-mono-sm` is a label style with `text-transform: uppercase`** — never apply it to code or learner-supplied data; it silently rewrites the source on screen. Code surfaces style themselves (`.ar-code`, `.coding-snippet`).
- **The advisory must mirror the sandbox model**: whole program, stdin piped, stdout compared CRLF/trailing-whitespace-normalized. The pre-P4 `solve(...)` harness disagreed with the server on the same submission.
- **Playwright + CodeMirror**: `keyboard.insertText` after `ControlOrMeta+a`; per-key `type()` is mangled by `indentOnInput` (and mobile autocapitalize uppercases the source).
- `./full-app restart full` reloads CSS too: Vite on `/mnt/d` misses `codingTaker.css`/`review.css` edits, so a vision pass after a style change needs a restart or the screenshot shows stale styles.
- The `.field-group` primitive caps at 420px; coding surfaces opt out with `.coding-field-group` (a form field is not an editor).

## Decisions in force

- Decided all four subtypes behind one sandbox harness; `output_prediction` deterministic via `grade_objective` (2026-09-16, D-01). P2 detail: answer `{value}` vs `answer_block {acceptedValue, tolerance?}` (numeric), publishes `grader: "objective"`.
- **D-02 amended (user-approved 2026-09-16): the sandbox is self-hosted Piston, not Judge0 CE** — the isolate gate proved Judge0 cgroup-v1-only on this host. Piston is the plan's recorded fallback; the public grader label stays `judge0` (contract enum). The swap was confined to the client module, exactly as planned.
- Decided Pyodide advisory on visible tests only; no server "Try it" (2026-09-16, D-03).
- Decided hybrid code-bearing gate: ingestion `has_code` flag + in-generation LLM judge with reasoning in `code_not_derivable` warnings (2026-09-16, D-04).
- Decided fail-closed normalization: hidden-rate score, `correct @ 0.6`, infra-only redelivery (2026-09-16, D-05).
- Decided minimal lazy CodeMirror now; Monaco deferred to #46 if ever (2026-09-16, D-06).
- Decided silent judge: deterministic template words, no LLM in grading (2026-09-16, D-07).
- Decided assessments-only; practice enablement belongs to #45 (2026-09-16, D-08).
- Decided `subtype` reuse for coding + new nullable columns (2026-09-16, D-09); NULL `has_code` means unknown (2026-09-16, D-10).
- Decided base = `project/phase-2` after merging #44's PR #65, deferring #44 P5 (user, 2026-09-16).
- Decided sandbox compose placement: root `docker-compose.yml` + `profiles: ["sandbox"]` (demand-start, service DNS for the containerized worker, loopback-only publish) (user, 2026-09-16, P2).
- Decided the P1 coding-submit stub is lifted in P2 with real validation + enqueue (user, 2026-09-16, P2).
- Decided the server executes the visible tests too and reports them in `testCases` (`visible: true`), while `score` stays the hidden-test pass rate (user, 2026-09-16, P2).
- Decided `CodingAnswer.config.stdin` is client-advisory only: the server never feeds learner stdin into authored tests (it would corrupt their expected outputs) (2026-09-16, P2).
- Decided the LLM picks the coding subtype per generation because no recipe or UI field carries one; the schema is a 3-branch union and P5 must seed or retry to force a specific subtype (user, 2026-09-16, P3).
- Decided the generation-time self-check uses the contract-max limits and lets the PistonClient clamp to the `PISTON_*` ceilings (2026-09-16, P3).
- Decided P4's `output_prediction` gets a distinct taker (read-only snippet + numeric value input) rather than reusing the editor branch (user, 2026-09-19, P4).
- Decided the P4 vision pass is a full pass at 1280x720 + 375x812, and main-bundle growth is a gate (user, 2026-09-19, P4). Measured: main +5.48 kB of feature code; CodeMirror/Pyodide strictly lazy (recorded deviation in `plan/VERIFICATION.md`).
- Decided the advisory runner mirrors the sandbox execution model exactly (whole program, stdin piped, normalized stdout) rather than a `solve(...)` harness; an advisory that disagrees with the server is worse than none (2026-09-19, P4).
- Decided the coding surfaces own the card width (`.coding-field-group`) and code blocks never inherit the uppercase label style (2026-09-19, P4 vision pass).

## Open

- P5 unstarted: `e2e/coding-assessment-live.spec.ts` (durable live spec: seeded or generated coding questions, redaction sweep over responses + DOM, hidden-veil assertions, compile-error drill, window-scoped cleanup), AC sweep on #42 (AC4), records, wayfinder exit. Head start in `plan/VERIFICATION.md` "P5 notes".
- P4 plan-text note: all "Judge0" mentions read as "sandbox (Piston)"; the public grader label stays `judge0` (frozen contract).
- P5 plan-text note: because the LLM picks the subtype, the `output_prediction` live scenario needs a seeded question row or generation retries (no subtype steer exists).
- Pre-existing, not P1-P4: 5 `test_v1_integration.py` calibration golden-fixture failures (fail on base tree; progress-package precision drift) — not touched by #42.
