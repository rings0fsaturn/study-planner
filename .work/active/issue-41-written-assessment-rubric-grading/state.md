# State – issue-41-written-assessment-rubric-grading
_Spec: specs/phase2-tickets/09-written-assessment-grading.md (ticket #41, parent #32, map #4) · Plan: active/issue-41-written-assessment-rubric-grading/plan/ · STATUS row: issue-41-written-assessment-rubric-grading · Status: active · Updated: 2026-09-10_

## Current state & next
- P1 done 2026-09-10: contract amendment landed — `WrittenAnswer`, `AttemptRecord.answer` oneOf Objective/Written, `Question.subtype` (optional), `QuestionGraded.rubricBreakdown` + `RubricCriterionResult`; 3 new fixtures; 6 new contract tests. Gate green 20/20 (RED first: 6 failed / 14 passed).
- Next: Phase 2 — written generation (`WRITTEN_SCHEMA` + written validation + worker format branch + recipe gate `['written']` + migration 027 format gate).
- Uncommitted: the user has not asked for a commit, so P1 changes sit in the worktree on branch `phase2/issue-40-41`.

## Done so far
- OPEN 2026-09-09: created `active/issue-41-written-assessment-rubric-grading/{plan,prompts,research}/`, claimed #41 on GitHub, refreshed STATUS (`_Last reconciled_` → 2026-09-10, phase2-wayfinder frontier now #41 claimed + #42 next).
- Planning 2026-09-10: single bounded scoping round (3 questions, no follow-ups); user answers 1.a/2.a/3.a; PLAN.md (D-01–D-06, P1–P5) + VERIFICATION.md written.
- P1 2026-09-10: openapi amendment + 3 fixtures + 6 contract tests; contracts gate green 20/20; plan P1 marked complete with its Notes block; VERIFICATION P1 ticked.

## Flow trace
1. Ticket #41 = Written Assessment and Rubric Grading (`wayfinder:phase2`, `ready-for-agent`, OPEN→claimed): written short-answer + long-form questions with server-authoritative rubric feedback.
2. AC1: written generation uses typed visible payloads + server-only rubric content. AC2: grading returns normalized score, rubric feedback, explanation, citations, warnings, per-skill observations. AC3: partial/timeout/provider/retry/no-leakage tested. AC4: results render through the shared #40 review surface.
3. Builds on the #39 chain (submit → grading worker → GET attempts → attemptFlow Dexie `assessmentAttempts`) and fills the #40 written extension point (shared grade shape + placeholder treatments in the review module).
4. Contract layering: `AttemptSubmit.answer` stays an untyped object (so written text rides it unchanged); `AttemptRecord.answer` is the client-visible union (`oneOf` Objective/Written) and the read route already echoes `row.answer` verbatim from `_attempt_record` (`routers/assessments.py:184`), so no service change is needed for written answers to round-trip.
5. AC2's "citations, warnings" ride the composed read path, not the grade object: citations = `Question.citations` (rendered by `CitationList`), warnings = `Assessment.warnings` (rendered by `SummaryBand`). `QuestionGraded` deliberately carries neither.
6. Exit = wayfinder resolution: resolution comment + close #41 + map #4 Decisions-so-far line + STATUS row → Done.

## Files affected
- `.work/STATUS.md` – issue-41 Active row; phase2-wayfinder frontier; `_Last reconciled_`.
- GitHub `rings0fsaturn/study-planner` issue #41 – assigned to `rings0fsaturn` (claimed).
- `.work/active/issue-41-written-assessment-rubric-grading/` – task folder (`state.md`, `SCRATCHPAD.md`, `plan/PLAN.md`, `plan/VERIFICATION.md`, `prompts/`, `research/`).
- `services/intelligence/contracts/phase2/openapi.yaml` (P1) – `WrittenAnswer`, `AttemptRecord.answer` oneOf, `Question.subtype`, `QuestionGraded.rubricBreakdown`, `RubricCriterionResult`.
- `services/intelligence/contracts/phase2/fixtures/written-question.json`, `written-attempt-submit.json`, `written-attempt-record.json` (P1, new) – visible written question, learner submission, graded written record.
- `services/intelligence/contracts/phase2/fixtures/README.md` (P1) – new "OpenAPI-validated fixtures" section (also lists the previously undocumented #39 attempt fixtures).
- `services/intelligence/contracts/phase2/tests/test_contracts.py` (P1) – 5 new tests + the `answer` assertion in `test_attempt_schemas_exclude_hidden_content` widened to the `oneOf` branch set.

## Pitfalls & rules
- Must honor map #4 capstone principle: feature-rich and complete, no MVP deferral.
- Redaction is a hard gate (extends #40 AC4): authored rubric text / reference answers must never reach the browser; `answer_block` stays service_role-only. The public written surface is criterion label + weight + score + met + feedback only.
- `openapi.yaml` uses YAML flow mappings: a colon-space inside an unquoted `description` scalar is a parse error. Write descriptions with semicolons (the file's existing style).
- Contract fixtures come in two kinds: `manifest.json`-mapped ones are JSON-schema files validated in bulk; OpenAPI-inline ones are validated per-fixture in `test_contracts.py` via `_validate_against_openapi`. The JSON-only manifest loader cannot reference `openapi.yaml`.
- Fixtures are read with `encoding="ascii"` — no em dashes or non-ASCII characters in fixture files.
- Retry = fresh observation (map #10): new clientAttemptId row, append-only history, never overwrite.
- #41 rendering is constrained by the #40 review surface — fill its written treatment, do not fork a second surface.
- Live grading needs the ingestion worker (`bash scripts/run-detached-ingestion-worker.sh`; `full` profile does not run it).
- Live mutation specs on the shared account must run `--workers=1` (rule 16 credentials + managed runtime).
- TS control-flow narrowing does not carry into hoisted nested functions inside effects — re-guard nullables inside async closures; annotate untyped `.map` arrays (e.g. `AttemptRecord[]`) or literal unions widen to string.

## Decisions in force
- Sequencing: #40 first, #41 after (user 2026-09-09); wayfinder one-ticket-per-session rule honored.
- Scoping locked 2026-09-10 (user 1.a/2.a/3.a): extend AttemptTaker with a written textarea branch rather than a second taking component; per-criterion rubric rather than holistic-only; full live pass with real LLM grades at both viewports.
- Written generation is in-slice (AC1): one family per assessment, count 1 (matches the existing objective slice).
- Taking stays in AttemptTaker per #40 D-04; its verified submit/poll/retry phases are reused, not re-implemented.

## Open
- P2 not started. P1 changes are uncommitted pending a user decision on committing per phase (repo convention from #38–#40 is one commit per phase).
- Pre-existing, unrelated: 7 service tests fail on a clean tree (`test_retrieval_probe.py` 2, `test_v1_integration.py` calibration goldens 5) — proven by stashing the contracts changes and re-running. Do not mistake them for #41 fallout when P3 runs `uv run pytest services/intelligence/tests`.
- `.git/index.lock` was stale (0 bytes, no live git process) and blocked git; removed 2026-09-10. If it reappears, check for a Windows-side git/IDE holding it.
- #42 (coding) untouched: OPEN, unclaimed, next after #41.
