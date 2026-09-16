# State – issue-42-coding-assessment-sandbox-grading

_Spec: GitHub [#42](https://github.com/rings0fsaturn/study-planner/issues/42) (copy: specs/phase2-tickets/10-coding-assessment-sandbox-grading.md) · Plan: active/issue-42-coding-assessment-sandbox-grading/plan/PLAN.md · STATUS row: issue-42-coding-assessment-sandbox-grading · Status: active — P2 done, P3 next · Updated: 2026-09-16_

## Current state & next

- P0 done: PR #65 merged #44 (P1–P4) into `project/phase-2` (`3844f72`, #44 P5 deferred per user); branch `phase2/issue-42-coding-sandbox-grading` cut off it; plan + STATUS row committed (`a7f66e2`).
- P1 done and verified: migration 031 pushed to the dev project; contracts 28/28, router tests 45/45, backend 594/5 (the 5 = pre-existing calibration golden-fixture drift, fails on base tree too); ruff clean on touched files. Commit `fd3f79c`.
- P1 live probe green: service-role coding-row insert; authenticated read shows `language/starter_code/visible_tests`; `answer_block` 403; `has_code` server-owned guard 403; RPC bodies verified live (`::uuid` cast kept, submit gate `IN ('objective','written','coding')`).
- P2 done: **Judge0 was rejected at the isolate gate** (bundled isolate 1.8.1 is cgroup-v1-only; this Docker Desktop/WSL2 host is cgroup-v2-only → status 13 on every submission) and the user approved the plan's recorded D-02 fallback to **self-hosted Piston** (MIT, single container, cgroup v2). The sandbox client, coding grader, worker three-way dispatch, Piston compose service (profile `sandbox`), and the P1 submit-stub lift all landed. Backend suite 625 passed / 5 pre-existing failures; contracts 28/28; ruff clean on all touched files; rule-80 live client round-trip green against the real sandbox (passed/timeout/compile/failed).
- Next: P3 — generation coding arm (`coding_schema`/`build_coding_messages`/`validate_coding`/worker dispatch/`_coding_answer_block` + generation-time sandbox self-check + ingestion `has_code`/`code_languages` scan).

## Done so far

- 2026-09-16: wayfinder grilling rounds 1 (Q1–Q6) + 2 (Q7–Q11) resolved with the user; three fact surveys (generation gates, grading-pipeline attach, coding-format state) landed and confirmed the plan's citations.
- 2026-09-16: sandbox decision confirmed unchanged — self-host Judge0 CE per #11 (`research/external/code-sandbox-comparison.md`); Piston stays the documented fallback.
- 2026-09-16: P0 — #44 merged into `project/phase-2` via PR #65 (`3844f72`); #42 branch cut; plan committed (`a7f66e2`).
- 2026-09-16: P1 — migration `031` (coding columns + widened subtype CHECK + RPC re-creations + materials code signal + guard extension), openapi coding schemas + fixtures, `userrest` public columns, router admission + honest submit stub; pushed + live-probed (see Current state). Commit `fd3f79c`.
- 2026-09-16: P2 — Judge0 isolate gate failed (cgroup v1 vs v2, recorded) → user-approved Piston fallback; `piston_client.py` (synchronous execute, verdict map, clamps, typed errors, D-11 logs), `coding_grader.py` (hidden pass rate, veiled test table, deterministic templates), worker three-way dispatch + retryable-vs-terminal infra split, `worker_main._build_piston_client`, compose `piston` service (profile `sandbox`), router stub lifted; 46 new grading tests + worker/router test updates; full suite 625/5, contracts 28/28, ruff clean, rule-80 live round-trip green.

## Flow trace

1. Generation chain coding must join: router gate `routers/assessments.py:31,36-57` → `assessment_generate` queue → `generation/worker.py` family dispatch (`:59-68,250-252,392-461`) → `questions` row (service-role-only `answer_block`).
2. Grading chain coding must join: `AttemptTaker` → `attemptFlow` → `POST .../attempts` → migration `027` submit gate (`:123-126`, widened by 031) → `assessment_grade` queue → `grading/worker.py:_process` (`:142-237`) → `QuestionGraded` (`grader: 'judge0'` already in all three contract sites).
3. Contract already allowed coding (`openapi.yaml:141` formats, `:153` grader, `:146` practice mode); P1 closed the gaps — `AttemptRecord.answer` oneOf += `CodingAnswer`, `Question` coding fields, `QuestionGraded.testCases`.
4. Storage: `018:64-65` already allowed `format='coding'`; 031 adds the visible columns (`language`, `starter_code`, `visible_tests`), the widened subtype CHECK, and the RPC re-creations.
5. P1 stub path: a coding-shaped submit answer (`source` key present) 400s at the router with `validation_failed("coding grading lands in P2")` — never reaches the queue before P2.

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

## Open

- P3 unstarted: generation coding arm (`coding_schema`/`build_coding_messages`/`validate_coding`, worker dispatch + `_coding_answer_block`, generation-time sandbox self-check, ingestion `has_code`/`code_languages` scan).
- P3 plan-text note: the self-check runs `referenceSolution` against the authored tests through the P2 client, now `PistonClient` (synchronous, one `execute` per test).
- P4/P5 plan-text note: all "Judge0" mentions read as "sandbox (Piston)"; the public grader label and the AC3 wording stay `judge0` because the contract enum is frozen.
- Pre-existing, not P1/P2: 5 `test_v1_integration.py` calibration golden-fixture failures (fail on base tree; progress-package precision drift) — not touched by #42.
