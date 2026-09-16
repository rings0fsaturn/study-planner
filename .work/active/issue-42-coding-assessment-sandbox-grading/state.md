# State – issue-42-coding-assessment-sandbox-grading

_Spec: GitHub [#42](https://github.com/rings0fsaturn/study-planner/issues/42) (copy: specs/phase2-tickets/10-coding-assessment-sandbox-grading.md) · Plan: active/issue-42-coding-assessment-sandbox-grading/plan/PLAN.md · STATUS row: issue-42-coding-assessment-sandbox-grading · Status: active — plan written, P0 unstarted · Updated: 2026-09-16_

## Current state & next

- #42 claimed 2026-09-16 (self-assigned on `gh`); its only blocker #39 is CLOSED, so frontier-ready.
- Plan written: P0 (branch+folder) → P1 (contracts + migration 031) → P2 (Judge0 + grading arm) → P3 (generation arm) → P4 (client) → P5 (live spec + AC sweep). Rounds 1+2 locked as D-01…D-11.
- Next: P0 — cut `phase2/issue-42-coding-sandbox-grading` off refreshed `project/phase-2`, verify tree state, commit the plan.

## Done so far

- 2026-09-16: wayfinder grilling rounds 1 (Q1–Q6) + 2 (Q7–Q11) resolved with the user; three fact surveys (generation gates, grading-pipeline attach, coding-format state) landed and confirmed the plan's citations.
- 2026-09-16: sandbox decision confirmed unchanged — self-host Judge0 CE per #11 (`research/external/code-sandbox-comparison.md`); Piston stays the documented fallback.

## Flow trace

1. Generation chain coding must join: router gate `routers/assessments.py:31,36-57` → `assessment_generate` queue → `generation/worker.py` family dispatch (`:59-68,250-252,392-461`) → `questions` row (service-role-only `answer_block`).
2. Grading chain coding must join: `AttemptTaker` → `attemptFlow` → `POST .../attempts` → migration `027` submit gate (`:123-126`) → `assessment_grade` queue → `grading/worker.py:_process` (`:142-237`) → `QuestionGraded` (`grader: 'judge0'` already in all three contract sites).
3. Contract already allows coding (`openapi.yaml:141` formats, `:153` grader, `:146` practice mode); gaps are `AttemptRecord.answer` oneOf, `Question` coding fields, `testCases` on the grade.
4. Storage already allows `format='coding'` (`018:64-65`); missing are the visible columns (`language`, `starter_code`, `visible_tests`), the widened subtype CHECK, and the RPC re-creations (all migration 031).

## Files affected

- `.work/active/issue-42-coding-assessment-sandbox-grading/plan/PLAN.md` – the plan (new 2026-09-16).
- `.work/active/issue-42-coding-assessment-sandbox-grading/state.md` – this doc.
- `.work/STATUS.md` – one Active row.

## Pitfalls & rules

- Must follow rule 35 (new migration, never rewrite 027) and rule 36 (dry-run push, verify live grants) for migration 031.
- Must follow rule 17 (logging contract) per D-11: every new failure path logs with `request_id`/`trace_id`; learner source, hidden tests, and `answer_block` never log.
- Must follow rule 22 (centralized fetch normalization) for the Judge0 client errors and the new coding submit path.
- Judge0 is GPL-3.0: over-the-wire only, never embedded (comparison doc §Final Recommendation).
- `PracticeThis` stays disabled until #45 (D-08) — no drive-by enablement in P4.
- WSL staleness (rule 53): restart runtime after edits; demand-start Judge0 + worker + sidecar for live work, stop after.

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

## Open

- P0 unstarted: branch cut + tree verification + plan commit.
- Live unknowns (P2 steps, not decisions): `isolate` under this Docker backend; Judge0 Python language id.
