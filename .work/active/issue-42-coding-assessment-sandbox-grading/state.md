# State – issue-42-coding-assessment-sandbox-grading

_Spec: GitHub [#42](https://github.com/rings0fsaturn/study-planner/issues/42) (copy: specs/phase2-tickets/10-coding-assessment-sandbox-grading.md) · Plan: active/issue-42-coding-assessment-sandbox-grading/plan/PLAN.md · STATUS row: issue-42-coding-assessment-sandbox-grading · Status: active — P1 done, P2 next · Updated: 2026-09-16_

## Current state & next

- P0 done: PR #65 merged #44 (P1–P4) into `project/phase-2` (`3844f72`, #44 P5 deferred per user); branch `phase2/issue-42-coding-sandbox-grading` cut off it; plan + STATUS row committed (`a7f66e2`).
- P1 done and verified: migration 031 pushed to the dev project; contracts 28/28, router tests 45/45, backend 594/5 (the 5 = pre-existing calibration golden-fixture drift, fails on base tree too); ruff check clean on touched files.
- P1 live probe green: service-role coding-row insert; authenticated read shows `language/starter_code/visible_tests`; `answer_block` 403; `has_code` server-owned guard 403; RPC bodies verified live (`::uuid` cast kept, submit gate `IN ('objective','written','coding')`).
- Next: P2 — Judge0 compose (isolate smoke test first, Piston fallback if it fails), `grading/judge0_client.py`, `grading/coding_grader.py`, worker three-way dispatch, `JUDGE0_*` env.

## Done so far

- 2026-09-16: wayfinder grilling rounds 1 (Q1–Q6) + 2 (Q7–Q11) resolved with the user; three fact surveys (generation gates, grading-pipeline attach, coding-format state) landed and confirmed the plan's citations.
- 2026-09-16: sandbox decision confirmed unchanged — self-host Judge0 CE per #11 (`research/external/code-sandbox-comparison.md`); Piston stays the documented fallback.
- 2026-09-16: P0 — #44 merged into `project/phase-2` via PR #65 (`3844f72`); #42 branch cut; plan committed (`a7f66e2`).
- 2026-09-16: P1 — migration `031` (coding columns + widened subtype CHECK + RPC re-creations + materials code signal + guard extension), openapi coding schemas + fixtures, `userrest` public columns, router admission + honest submit stub; pushed + live-probed (see Current state).

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
- `services/intelligence/contracts/phase2/openapi.yaml` – `CodingAnswer` (python-only Day 1), `VisibleTestCase`, `TestCaseResult`, `Question` coding fields + widened subtype enum, `QuestionGraded.testCases`, `AttemptRecord.answer` oneOf += coding; drive-by: regenerate path gained `IdempotencyKey` (pre-existing #44 gap).
- `services/intelligence/contracts/phase2/tests/test_contracts.py` – 8 coding contract tests (28 total).
- `services/intelligence/contracts/phase2/fixtures/{coding-question,coding-attempt-record,coding-attempt-submit}.json` – **new**.
- `services/intelligence/app/userrest.py` – `QUESTION_PUBLIC_COLUMNS` += `language,starter_code,visible_tests`.
- `services/intelligence/app/routers/assessments.py` – `SUPPORTED_FORMATS` += `["coding"]`, `_question` serializes coding columns, submit stub rejects coding-shaped answers with `validation_failed`.
- `services/intelligence/tests/test_assessments_api.py` – coding 202, coding serialization, submit-stub tests; fake-client gate widened.

## Pitfalls & rules

- Must follow rule 35 (new migration, never rewrite 027) and rule 36 (dry-run push, verify live grants) for migration 031.
- Must follow rule 17 (logging contract) per D-11: every new failure path logs with `request_id`/`trace_id`; learner source, hidden tests, and `answer_block` never log.
- Must follow rule 22 (centralized fetch normalization) for the Judge0 client errors and the new coding submit path.
- Judge0 is GPL-3.0: over-the-wire only, never embedded (comparison doc §Final Recommendation).
- `PracticeThis` stays disabled until #45 (D-08) — no drive-by enablement in P4.
- WSL staleness (rule 53): restart runtime after edits; demand-start Judge0 + worker + sidecar for live work, stop after.
- 028 lesson: before `CREATE OR REPLACE`-ing an RPC, grep the whole migrations dir for the function name and copy its most recent body — a stale copy parses fine and dies at runtime (031 built on 028's body, verified live).
- PyYAML flow-mapping plain scalars truncate at `, ` (comma-space) — reworded openapi descriptions; keep new descriptions comma-free or quote them.
- Supabase PAT rotates: `services/intelligence/.env` SUPABASE_ACCESS_TOKEN went stale (401); user refreshed it 2026-09-16. Probe `GET https://api.supabase.com/v1/projects` before trusting it.
- `validation_failed` maps to HTTP 409 via the shared `service_error` map (serialization.py:19), not 400.

## Decisions in force

- Decided all four subtypes behind one Judge0 harness; `output_prediction` deterministic via `grade_objective` (2026-09-16, D-01).
- Decided Judge0 CE compose service, loopback-only, Python-only Day 1; Piston fallback recorded (2026-09-16, D-02).
- Decided Pyodide advisory on visible tests only; no server "Try it" (2026-09-16, D-03).
- Decided hybrid code-bearing gate: ingestion `has_code` flag + in-generation LLM judge with reasoning in `code_not_derivable` warnings (2026-09-16, D-04).
- Decided fail-closed normalization: hidden-rate score, `correct @ 0.6`, infra-only redelivery (2026-09-16, D-05).
- Decided minimal lazy CodeMirror now; Monaco deferred to #46 if ever (2026-09-16, D-06).
- Decided silent judge: deterministic template words, no LLM in grading (2026-09-16, D-07).
- Decided assessments-only; practice enablement belongs to #45 (2026-09-16, D-08).
- Decided `subtype` reuse for coding + new nullable columns (2026-09-16, D-09); NULL `has_code` means unknown (2026-09-16, D-10).
- Decided base = `project/phase-2` after merging #44's PR #65, deferring #44 P5 (user, 2026-09-16).

## Open

- P2 unstarted: Judge0 compose + grading arm (isolate smoke test is P2 step 1; Piston fallback recorded).
- Live unknowns (P2 steps, not decisions): `isolate` under this Docker backend; Judge0 Python language id.
- Pre-existing, not P1: 5 `test_v1_integration.py` calibration golden-fixture failures (fail on base tree; progress-package precision drift) — not touched by #42.
