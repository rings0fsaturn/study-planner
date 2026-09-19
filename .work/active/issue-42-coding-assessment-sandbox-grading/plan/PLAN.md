# PLAN — Coding Assessment and Sandbox Grading ([#42](https://github.com/rings0fsaturn/study-planner/issues/42))

**Date written:** 2026-09-16 · **Ticket:** [#42 Coding Assessment and Sandbox Grading](https://github.com/rings0fsaturn/study-planner/issues/42) (OPEN, claimed 2026-09-16 — self-assigned) · **Parent:** implementation spec [#32](https://github.com/rings0fsaturn/study-planner/issues/32) · Wayfinder map [#4](https://github.com/rings0fsaturn/study-planner/issues/4)
**Branch:** `phase2/issue-42-coding-sandbox-grading` (cut off refreshed `project/phase-2` in P0 — not cut yet)
**Plan status:** 🟡 Draft for implementation — rounds 1+2 locked (§Decisions). Map is clear; no further grilling.
**Trigger:** user ask 2026-09-16 — "Commit and push work done for #39, then use /wayfinder to discuss and plan issue #42" + "Write the plan. Use ponytail for smart implementation, make use of logging infra for clear traceability and debugging."

> Runbook convention inherited from the #38/#39/#40/#41/#44 plans: **one phase per session**, records committed in the same commit as the work, STOP on any reality-mismatch and record it.
>
> **Vitest invocation:** the app `test` script is already `vitest run`; `pnpm --filter app test <path>` — an extra `--run` makes vitest read the path as a name filter.
>
> **WSL/drvfs staleness (rule 53):** Vite misses edits under `/mnt/d`; `./full-app restart full` + hard-reload before judging UI. Env vars load at process start — restart after `.env` changes.
>
> **Ponytail (full):** YAGNI, reuse the #39/#41 three-arm shape, shortest diff. Every deliberate ceiling is marked `ponytail:` with its upgrade path. No new abstraction with one consumer, no dependency for what a lazy import or a column does.
>
> **Logging (rule 17) is not a garnish here — it is how a sandbox is trusted.** Every phase below carries its log lines: what is logged, with which id, and what never is. Join key is `X-Request-ID` on HTTP paths and `correlation_id`/`trace_id` on worker paths; `./full-app logs <service> --grep <id>` is the operator join.

## TL;DR

Coding questions ride the exact three-arm shape #39 (objective) and #41 (written) already verified: generation authors a coding question + hidden tests + reference solution → `questions.answer_block` (service-role-only, unchanged boundary) → learner submits `{language, source, config}` → the same `assessment_grade` queue → a third grading arm executes against **self-hosted Judge0 CE** (compose service, internal-only, Python-only Day 1) → `QuestionGraded` with `grader: 'judge0'`. The fourth subtype, `output_prediction`, never touches the sandbox: it reuses deterministic `grade_objective` with an `acceptedValue` key. Client advisory feedback is Pyodide (offline, hidden-test-free by construction); the taking editor is minimal CodeMirror, lazily loaded so objective/written bundles do not move. LLM words stay out of the grading path entirely (deterministic templates Day 1) — all coaching language belongs to #46.

## Acceptance criteria → where they are met

| AC (#42) | Meaning | Met by |
|---|---|---|
| AC1 | Coding formats generate only when the material supports code-bearing content | P1 (deterministic `has_code`/`code_languages` on the material read) + P3 (generation prompt is the judge: question+tests or `code_not_derivable` warning carrying the LLM reasoning; conceptual material stays buildable per Q4/Q7) |
| AC2 | Client execution advisory, server execution authoritative | P4 (Pyodide visible-tests-only runner, badged advisory; grade arrives only from the server poll) |
| AC3 | Compile/runtime/timeout/test-case normalize into the public grading contract | P2 (Judge0 statuses → `score` = hidden pass rate, `correct @ 0.6`, shared `per_skill_observations`, `testCases` verdict table; compile/runtime/timeout fail-closed 0) |
| AC4 | Sandbox isolation, hidden-test protection, failure behavior tested | P2 (unit: isolation checklist §P2 + verdict mapping + retryable-vs-terminal) + P5 (live: `implement_fn` + `output_prediction` end-to-end, redaction grep over responses + DOM, Judge0-infra failure drill) |

## Context — live-tree facts (verified 2026-09-16; trust these over older notes)

### Generation gates coding today (three layers, all must move)

- Router (`services/intelligence/app/routers/assessments.py`): `SUPPORTED_FORMATS = (["objective"], ["written"])` (`:31`); `_validate_recipe` (`:36-57`) 400s anything else (`invalid_request`); `questionCount != 1` rejected (`:41-43`); difficulty 1–5; scope shape (`:60-79`) + page-count fit (`:86-100`). `generate_assessment` (`:131-181`) is otherwise family-agnostic. Submit (`:255-316`) validates only the written `{text}` shape (`:283-297`, ≤20000); a coding `{language, source, config}` passes the generic object gate today and dies later at the RPC.
- Worker (`services/intelligence/app/generation/worker.py`): family consts (`:55-56`), `_recipe_format` defaults anything non-written to objective (`:59-68`); build/validate/schema picked binary (`:250-252`); `_repair_once` (`:392-419`); `_accept_question` writes only written/objective rows (`:421-461`); `_written_answer_block` copies 3 keys (`:71-88`). Blueprint `question_format` defaults `"objective"` (`generation/models.py:83`).
- Schemas (`generation/prompts.py`): `mcq_schema` (`:49-63`), `written_schema` (`:73-113`), shared enum-bound `_citation_schema` (`:21-46`); `META_BLOCKLIST` (`:115-128`, D-02 verbatim on every arm); `WRITTEN_PROMPT_TEMPLATE_VERSION = "written-v1"` (`:18`). Validation (`generation/validation.py`): MCQ gate (`:30-56`), written gate (`:89-121`), shared citation gate (`:124-166`, format-agnostic, reused as-is).

### The grading chain the Judge0 arm plugs into (no new queue)

`AttemptTaker.tsx:74-97` → `attemptFlow.ts` (Dexie row + answer-free `QuestionAttempted`, `pollGrade` 20×1s) → `routers/assessments.py:255-316` (201 new / 200 replay) → migration `025` RPC `submit_assessment_attempt` (gate at `027:123-126`: `NOT IN ('objective','written')` → 400) → `assessment_grade` pgmq → `grading/worker.py:_process` (`:142-237`, `_is_written` dispatch `:102-103`) → `grade_objective` (`grading/grader.py:72-140`, `CORRECT_THRESHOLD = 0.6` `:19`, `per_skill_observations` `:32-42`) or `_grade_written` (`:239-272`, adapter protocol `rubric_grader.py:89-100`, fail-closed `_ungradable` `:79-99`, retryable-vs-terminal split `:178-233`) → `QuestionGraded` (`score∈[0,1]`, per-skill binary, `grader` enum already includes `judge0` in all three contract sites: `types.ts:193`, `sync/types.ts:139`, `openapi.yaml:153`).

### Contract facts that bite

- `openapi.yaml:141` recipe `formats` enum already includes `coding`; `:153` grader enum already includes `judge0`; `:146` practice mode already includes `coding|mixed`. **No envelope change for the grade.**
- Gaps to close in P1: `:152` `AttemptRecord.answer` oneOf is Objective/Written only (standalone `coding-answer.schema.json` exists: language enum 8 langs, `source` ≤100000, `config{stdin, timeLimitMs≤30000, memoryLimitMb≤1024}`); `:144` `Question` has no coding payload fields and `subtype` is documented written-only; `:148` `AttemptSubmit.answer` is generic `{}` (no change needed).
- `execution-result.schema.json` exists (`NormalizedExecutionGradingResult`: outcome enum, compile/runtime, publicFeedback, score, correct) but has **no per-test array** — P1 adds `testCases[{name, passed, visible}]` there or on `QuestionGraded`, never carrying hidden stdin/expected.
- `test_contracts.py:11` `SECRET_FIELDS` already reserves `hiddentests`/`hiddenanswer`/`referencesolution` — new field names must keep passing it.

### Storage facts that bite

- `questions.format` CHECK already includes `'coding'` (`018:64-65`); `answer_block` is JSONB (carries hidden tests + reference with **no schema change**); `answer_block` is service-role-only (`018:85-91`, `022`, `027:36-39`); browser reads only `QUESTION_PUBLIC_COLUMNS` (`userrest.py:24-27`).
- `027` CHECK forces `subtype` NULL on non-written rows (`:30-32`) and `complete_assessment_generation` (`023`/`027`) enumerates accepted columns — both must be touched to carry coding payload (P1, migration `031`, following the 027 pattern exactly).
- `materials` (`004:11-32`) has no code flag; ingestion stores text+chunks only. No `has_code`/`code_bearing`/`language` detection exists anywhere in `ingestion/` or `generation/` (verified by grep 2026-09-16).

### Client facts that bite

- `types.ts:9` `AssessmentFormat` already includes `'coding'`; `LearnerAnswer` is Objective|Written only; no `CodingAnswer`, no `submitCodingAttempt` (`attemptFlow.ts:414-441` has objective/written only); `AttemptTaker.tsx:41` `isWritten` is a boolean — coding today falls into the objective branch and would misgrade (submit + `pollGrade('objective')`).
- `PracticeThis.tsx:18-28` hard-codes `FOCUS='Written'`/`FORMAT='written'`, chips disabled (`:257-268`); `AssessmentConfig.tsx:20-28` omits coding from `FAMILY_OPTIONS` entirely; `ReviewSurface.tsx:452-469` `CodingFeedback` is an explicit placeholder ("Execution results arrive with coding grading"), pinned by `ReviewSurface.test.tsx:285`.
- No editor dep (`apps/app/package.json:14-36` — no monaco/codemirror/pyodide). `#44` D-05 deferred the editor question to the coding slice; this slice answers it (CodeMirror minimal, Q6/Q10).

### Infra facts that bite

- `docker-compose.yml`: `web` + `intelligence` + `ingestion-worker`; no sandbox service. Judge0 CE v1.13.1 needs web+worker+Postgres+Redis (`research/external/code-sandbox-comparison.md`, 2026-07-31 — the decision record; GPL-3.0 over-the-wire, Piston documented fallback).
- Worker env (`worker_main.py`): `_build_openrouter_adapter("GENERATION"|"GRADING"...)` (`:72-96`), `_build_grading_worker` (`:128-146`, `GRADING_*` env); `.env.example` carries `GENERATION_*` (`:14-19`) — `JUDGE0_*` follows the same pattern.
- Logging infra (rule 17, landed): backend `logging_config.py` (`configure_logging()`, JSON lines, `extra={request_id|trace_id}`); frontend `lib/logger.ts` (no direct `console.*` in `apps/app/src`); `./full-app logs <service> --grep <id>` join; `e2e/fixtures.ts` error capture. Every new failure path below logs through these or it does not land.

## Decisions log (rounds 1+2 — locked 2026-09-16 unless a reality-mismatch reopens)

### D-01: All four subtypes behind one Judge0 harness
`implement_fn`, `debug`, `complete_code` grade through the Judge0 arm; `output_prediction` grades deterministically by reusing `grade_objective` with an `acceptedValue` key (no sandbox call — it is a value match with a code snippet in the prompt). Once hidden-test plumbing exists, `debug`/`complete_code` are prompt shapes over the same harness, not new infrastructure. Capstone standing principle (map #4 Notes): no MVP slicing inside the ticket.

### D-02: Judge0 CE as a compose service, internal-only, Python-only Day 1
Official image, `127.0.0.1:2358:2358` loopback-published (host worker reaches it; LAN does not). Language allowlist `["python"]` enforced in our code, not a custom image (`ponytail:` no image build for a list). Judge0 language id resolved live (`GET /languages`), pinned in `JUDGE0_PYTHON_LANGUAGE_ID` (default 71). `ponytail:` if `isolate` fails under this host's Docker backend, fall back to self-hosted Piston per the comparison doc — the grading arm talks verdicts, not Judge0 internals, so the swap is one client module.

### D-03: Pyodide advisory, visible tests only
Lazy `import('pyodide')` inside the coding taker (never the main bundle; verify dist). Runs the question's **visible** tests only, badged "Advisory — the server grade is authoritative." Hidden-test-free by construction (the payload has none). `ponytail:` no server "Try it" endpoint — a round-trip per keystroke-test buys quota/load accounting for zero trust benefit.

### D-04: Hybrid code-bearing gate — deterministic flag + in-generation LLM judge
Ingestion computes `has_code` + `code_languages[]` (fenced-block scan over `full_text`, language hints) once, stored on the material row, exposed on the material read. UI chips enable on any ready material; when `has_code` is false the hint reads "No code blocks detected — the generator will judge from concepts." The generation prompt is the judge: it returns question+tests or a `code_not_derivable` warning carrying the LLM's reasoning, rendered verbatim. No standalone classifier call, no suitability cache (`ponytail:` zero extra model calls; the warnings channel from the #13 generation decision already exists). Conceptual material stays buildable — the ticket AC1's "supports code-bearing content" means *judged suitable*, not *contains fences*.

### D-05: Fail-closed normalization, hidden-rate score
Compile error / runtime error / timeout (code's fault) → deterministic score 0, `correct: false`, never retried. `score` = hidden-test pass rate, `correct @ 0.6`, shared `per_skill_observations`. Only Judge0-infra errors (5xx, queue loss, `Internal Error` verdict) redeliver via the existing pgmq visibility-timeout path, mirroring the `llm_rubric` retryable-vs-terminal split. Per-test caps (2 s CPU / 256 MB) travel in `CodingAnswer.config`; pins live in `JUDGE0_*` env, not code. Max 3 visible + 10 hidden tests per question.

### D-06: Minimal CodeMirror now, Monaco never in this ticket
`codemirror` + `@codemirror/lang-python`, Python highlight + line numbers + sane indent, Marginalia theme via CSS vars. `React.lazy` the coding editor so objective/written bundles do not move (assert in build). No autocomplete/lint/vim. Written stays textarea. Monaco waits for #46's inline-widget needs, if ever.

### D-07: The silent judge — deterministic template words, no LLM in the grading path
Judge0 decides the grade; `publicFeedback`/`explanation` are deterministic templates ("Passed 7/10 hidden tests. Failed: empty-input, large-n timeout."). No model call per attempt (cost, latency, untrusted-input prompt surface — the #9 abuse rule). All LLM coaching words belong to #46, whose streaming/reveal contract is already specified.

### D-08: Assessments-only — PracticeThis stays disabled until #45
#42 enables the `Coding` family in `AssessmentConfig` (assessments flow) only. `PracticeThis` Coding/Mixed chips stay disabled; its hint is repointed from "the coding slice" to #45. Wiring practice runs to coding generation is #45's slice (it needs run-shell coding semantics), not a drive-by here.

### D-09: Reuse `subtype` for the coding subtype; new nullable columns for the rest
Wire `subtype` carries `implement_fn|debug|output_prediction|complete_code` for coding rows (027's CHECK widens; contract doc line "absent for coding" updated). Visible payload needs real columns, not JSON packing: `language TEXT`, `starter_code TEXT`, `visible_tests JSONB` (all nullable; NULL = pre-coding rows). Hidden side (tests + reference) rides `answer_block` JSONB untouched. `ponytail:` columns over clever — parsing starter code out of prompt markdown in the client is a 3am bug factory; the 027 pattern (column + grant + RPC enumeration + public-columns + serializer) is proven and copied verbatim.

### D-10: `has_code` NULL means unknown, and that is fine
Migration `031` adds nullable `has_code`/`code_languages` with no backfill job: existing ready materials read NULL → UI treats as false (the "will judge from concepts" copy). Fresh ingestions fill it. `ponytail:` a backfill over the whole corpus pays only when someone measures unsuitable-material waste.

### D-11: Logging contract for the sandbox (rule 17, load-bearing)
- Backend (`configure_logging` + module loggers, `extra={"request_id":...}` on HTTP paths, `extra={"trace_id":...}` = attempt `correlation_id` on worker paths): generation logs coding-judge verdict (`code_not_derivable` + reason, never the material text); Judge0 client logs per-submission `attempt_id + test_index + status_id + duration_ms` (never source/stdin/expected); grading worker logs the composed outcome (`grader=judge0`, score, outcome) at the same points it logs the other two arms.
- What never logs: learner source, hidden tests, reference solutions, expected outputs, `answer_block` in any form (same boundary as #39/#41).
- Frontend: all new warnings/errors through `logger`; `X-Request-ID` minted per logical call on the submit path (already is — reused, not re-minted per retry); the typed error surfaces `requestId` for the `./full-app logs --grep` join.
- Every phase updates the logger-adjacent tests in the same commit (`test_hardening.py`, client logger tests, e2e fixtures) — rule 17's "same change" clause.

## Architecture overview

```
AssessmentConfig (+Coding family, gated on ready — D-08)
  └─ generateAssessment {formats:['coding']} ─► router gate admits (P1)
       └─ assessment_generate queue ─► generation worker, coding branch (P3)
            ├─ context (unchanged, text steer; code-bearing is a flag, not a filter — D-04)
            ├─ coding_schema + build_coding_messages (subtype-aware; output_prediction has no tests)
            ├─ validate_coding (format gate + shared citation gate)
            ├─ LLM judge: unsuitable → code_not_derivable warning + reasoning (AC1, honest, no row)
            └─ reference solution MUST pass all tests via Judge0 (P2 client) or the question drops
                 └─ questions row {format:'coding', subtype, language, starter_code, visible_tests,
                                   answer_block:{hiddenTests, referenceSolution, acceptedValue?}} (P1 031)

AttemptTaker, coding branch (P4): CodeMirror (lazy) + Pyodide visible-tests (advisory badge)
  └─ submitCodingAttempt {language, source, config} ─► submit RPC (gate widened, P1)
       └─ assessment_grade queue (unchanged) ─► grading worker, judge0 arm (P2)
            ├─ output_prediction → grade_objective {acceptedValue} (no sandbox — D-01)
            ├─ else Judge0 per hidden test → score = hidden pass rate, correct @0.6,
            │   per_skill_observations, testCases verdict table (no hidden content)
            ├─ compile/runtime/timeout → fail-closed 0 (D-05); infra errors → redeliver
            └─ QuestionGraded {grader:'judge0'} ─► attempts poll (unchanged)
                 └─ CodingFeedback execution table (P4): compile/runtime rows + per-test
                     verdicts (hidden tests named "Hidden test N" + passed, never content)
```

## Files touched (index — indicative, not a contract)

- `apps/app/supabase/migrations/031_coding_questions_and_code_signal.sql` — **new**: questions `language`/`starter_code`/`visible_tests` + widened subtype CHECK + public-column grant; materials `has_code`/`code_languages`; `complete_assessment_generation` + `submit_assessment_attempt` re-created with the widened gates (the 027 pattern).
- `services/intelligence/contracts/phase2/openapi.yaml` — `CodingAnswer` schema + `AttemptRecord.answer` ref; `Question` coding fields (`language`, `starterCode`, `visibleTests`, coding `subtype` enum); `QuestionGraded.testCases`; contract tests extended (no secret-field regressions).
- `services/intelligence/contracts/phase2/execution-result.schema.json` — per-test verdict shape (if housed here rather than openapi).
- `services/intelligence/app/routers/assessments.py` — `SUPPORTED_FORMATS` += `["coding"]`; coding answer-shape validation (language allowlist, source ≤100000, config caps); `_question` serializes the coding columns; errors through `service_error` with `request_id` (D-11).
- `services/intelligence/app/grading/judge0_client.py` — **new**: submit-per-test + poll, status→outcome map (3/4/5/6), timeouts, typed errors, latency/status logging without source (D-11). The only module that knows Judge0 exists (D-02 swap surface).
- `services/intelligence/app/grading/coding_grader.py` — **new**: `grade_coding` (hidden-rate score, fail-closed, `testCases` table, template words — D-05/D-07) + `output_prediction` routing note; reuses `per_skill_observations`, `_ungradable`.
- `services/intelligence/app/grading/worker.py` — three-way dispatch (`_is_coding` beside `_is_written`); infra-vs-code failure split; outcome logging (D-11).
- `services/intelligence/app/worker_main.py` + `.env.example` — `JUDGE0_URL`, `JUDGE0_*` limits, `JUDGE0_PYTHON_LANGUAGE_ID`; client construction (the `_build_openrouter_adapter` pattern).
- `services/intelligence/app/generation/prompts.py` — `coding_schema` (subtype-aware, enum-bound citations) + `build_coding_messages` + `CODING_PROMPT_TEMPLATE_VERSION`; META_BLOCKLIST verbatim (D-02 of #41's plan).
- `services/intelligence/app/generation/validation.py` — `coding_format_failures` + `validate_coding` (shared citation gate reused).
- `services/intelligence/app/generation/worker.py` + `models.py` — `CODING_FORMAT`, dispatch, `_coding_answer_block` (copies authored keys only — the `_written_answer_block` rule), generation-time Judge0 self-check (drop-with-warning on failure — D-05/Q9).
- `services/intelligence/app/ingestion/` (chunking/extraction stage) — fenced-block scan → `has_code`/`code_languages` on the material row (D-04/D-10).
- `services/intelligence/app/userrest.py` — `QUESTION_PUBLIC_COLUMNS` += coding columns.
- `apps/app/src/assessments/types.ts` — `CodingAnswer`, `CodingSubtype`, `Question` coding fields, `LearnerAnswer` += coding, `QuestionGradedResult.testCases`.
- `apps/app/src/assessments/attemptFlow.ts` — `codingAnswerProblem` client gate + `submitCodingAttempt` (the written-mirror precedent).
- `apps/app/src/pages/assessments/AttemptTaker.tsx` (+ new `CodingTaker.tsx`, lazy) — CodeMirror + Pyodide advisory + submit + `pollGrade(..., 'judge0')` (D-02/D-03/D-06).
- `apps/app/src/pages/assessments/AssessmentConfig.tsx` — Coding family option + copy; `PracticeThis.tsx` — hint repoint to #45 only (D-08).
- `apps/app/src/pages/assessments/review/ReviewSurface.tsx` — `CodingFeedback` execution table replaces the placeholder (D-07 templates).
- `docker-compose.yml` — `judge0-server`/`judge0-worker`/`judge0-db`/`judge0-redis`, loopback-only, `JUDGE0_*` env (D-02).
- `e2e/coding-assessment-live.spec.ts` — **new** (P5).

## Phase 0 (prerequisite, not a feature phase): git state, branch, task folder

**Status:** ⬜ Not started
**Depends on:** —

1. Verify clean tree (only expected untracked: `.claude/`, `.cursor/`, `graphify-out/`, `e2e/tmp-viewer-timings.spec.ts`, `college/mydeliverables/phase2-review-*/`, `.work/active/document-pipeline/`); `git status --short`.
2. `git fetch origin`; fast-forward `project/phase-2`; cut `phase2/issue-42-coding-sandbox-grading` off it. Confirm #42 assigned (done 2026-09-16).
3. Open the task folder (this plan + `research/` + STATUS row) and commit the plan (`docs(work): #42 open coding-assessment task — plan and STATUS row`).

**Stop conditions:** `project/phase-2` ahead of this plan's assumptions (re-verify the `:line` citations above — SHAs are stale); #44's wrap PR merged underneath (rebase the cut, do not stack on the #44 branch).

## Phase 1: Contracts + migration 031 (the ground everything stands on)

**Status:** ⬜ Not started · **Depends on:** P0 · **Scope:** 1 migration + openapi + serializer/grant plumbing + tests, no worker/client behavior.

### Steps

1. Migration `031_coding_questions_and_code_signal.sql` (rule 35: new file, never rewrite 027): questions `language TEXT NULL`, `starter_code TEXT NULL`, `visible_tests JSONB NULL DEFAULT '[]'`; widen `questions_subtype_valid` to also allow `(format='coding' AND subtype IN ('implement_fn','debug','output_prediction','complete_code'))`; materials `has_code BOOLEAN NULL`, `code_languages JSONB NULL`; re-create `complete_assessment_generation` (carries the new columns) and `submit_assessment_attempt` (gate `IN ('objective','written','coding')`); extend the authenticated column grant; RLS untouched (policies already owner-scoped).
2. `openapi.yaml`: `CodingAnswer` schema (mirror `coding-answer.schema.json`, Day-1 language enum narrowed to `["python"]` — the other seven arrive with their Judge0 packs, not as untested enum members); `AttemptRecord.answer` oneOf += CodingAnswer; `Question` += `language`/`starterCode`/`visibleTests` + coding `subtype` enum + doc-line fix; `QuestionGraded` += `testCases[{name, passed, visible}]`.
3. `userrest.py` public columns += the three; `routers/assessments.py` `_question` serializes them (coding rows only, absent otherwise — the subtype pattern); `SUPPORTED_FORMATS` += `["coding"]` with the answer-shape validation stubbed to reject coding submits with `validation_failed("coding grading lands in P2")` — honest 400, never a silent queue death.
4. Contract tests: refs resolve, secret-fields still pass with the new names, fixtures for a coding question/grade round-trip.

### Tests

- `test_contracts.py` extended (12 cases: refs, secrecy, fixtures).
- New `031` verified per rule 36: `db push --dry-run` first, then push; service-role insert of a coding row + authenticated read of redacted columns; submit RPC still 400s coding attempts (P2 lifts it).

### Verification

```bash
uv run --package intelligence python -m pytest services/intelligence/contracts/phase2/tests/test_contracts.py -q
```

Live contract probe after push (rule 36: confirm wrapper signatures/grants, not just migration text).

### Logging (D-11)

Migration and contract work emits no runtime logs. The P1 commit message records the 031 contract (columns, gates, grant) so later phases grep it.

### Rollback

Revert the commit; nothing reads the new columns yet. If 031 already pushed remote, it stays (migrations never rewrite — rule 35); P2+ builds on it.

## Phase 2: Judge0 service + client + grading arm (the trust core)

**Status:** ⬜ Not started · **Depends on:** P1 · **Scope:** compose, client module, grader module, worker dispatch, env — no generation, no UI.

### Steps

1. `docker-compose.yml`: `judge0-server` + `judge0-worker` (official CE image, pinned tag) + `judge0-db` + `judge0-redis`, no published ports except `127.0.0.1:2358:2358` on the server; `JUDGE0_URL` default `http://127.0.0.1:2358`. Verify `isolate` inside the worker before any code depends on it: one trivial Python submission via the API → `Accepted`. If it fails, trigger the D-02 Piston fallback (recorded, not silent).
2. `grading/judge0_client.py` (**new**, the only Judge0-aware module): `submit(source, language_id, stdin, expected_output, limits)` + token poll with timeout; status map 3→passed, 4→failed, 5→timeout, 6→compile_error, anything else→sandbox_error; `httpx` timeouts; typed errors (`Judge0InfraError` retryable vs `Judge0Verdict` terminal). Isolation checklist verified and recorded (network off, CPU/wall/mem/proc/output caps, ephemeral fs, non-root, no host mounts, queue backpressure — the comparison doc §Security Must-Haves).
3. `grading/coding_grader.py` (**new**): `grade_coding(*, question, answer, verdicts, graded_at, attempt_id)` — hidden-rate score, `correct @ 0.6` via `per_skill_observations`, `testCases` table (hidden named `Hidden test N` + passed only), deterministic template words (D-07); `output_prediction` short-circuits to `grade_objective` with the `acceptedValue` key (D-01 — no sandbox, no new code path beyond routing). Malformed answer/tests → `GraderInputError` → existing fail-closed.
4. `grading/worker.py`: `_is_coding`, three-way dispatch; Judge0-infra errors → job failed retryable + redelivery (the RubricProviderError pattern `:192-207`); code-fault verdicts → graded 0 (D-05). `worker_main.py` constructs the client from `JUDGE0_*` env; `.env.example` gains the block.
5. Unit tests: verdict map (all six statuses), score math (all-pass / partial / zero), fail-closed shapes, infra-vs-code split, `output_prediction` determinism, redaction (grade carries no hidden content — assert against `test_contracts.SECRET_FIELDS`).

### Verification

```bash
uv run --package intelligence python -m pytest services/intelligence/tests/test_grading_coding.py -q
uv run ruff check services/intelligence/app/grading/
```

Dry-run rule 80: the Judge0 round-trip is first proven with a 1-test trivial submission before any multi-test matrix.

### Logging (D-11)

- `logger.info("judge0 submission %s test %d status %d in %dms", ...)` per test with `extra={"trace_id": correlation_id}` — attempt_id + status + duration only, never source/stdin/expected.
- `logger.warning("coding grading attempt %s infra failure: %s", ...)` on redelivery; grading outcome at the existing outcome log point with `grader="judge0"`.
- Update `test_hardening.py` in the same commit (rule 17).

### Rollback

Revert the commit; stop the Judge0 containers (`docker compose stop judge0-*`). Router still 400s coding submits (P1 stub), so no dangling path.

## Phase 3: Generation coding arm (authoring + self-check)

**Status:** ⬜ Not started · **Depends on:** P2 (self-check needs the P2 client) · **Scope:** schema/prompts/validation/dispatch/answer-block + `has_code` producer, no UI.

### Steps

1. `generation/prompts.py`: `coding_schema(context_ids)` — subtype-aware: `implement_fn|debug|complete_code` require `stem, subtype, language(="python"), starterCode, visibleTests[2-3], hiddenTests[≤10], referenceSolution, difficulty, skillTags, citations`; `output_prediction` requires `stem, subtype, codeSnippet, acceptedValue, difficulty, skillTags, citations` (no tests, no reference). `build_coding_messages` + `CODING_PROMPT_TEMPLATE_VERSION = "coding-v1"`; META_BLOCKLIST verbatim; judge clause: "if no grounded coding problem can be authored from these chunks, return `{"unsuitable": true, "reason": "..."}`" → worker maps to the `code_not_derivable` warning (D-04; reasoning rides the warning message).
2. `generation/validation.py`: `coding_format_failures` (subtype/Language/starter/tests/reference/acceptedValue shapes, weight-free) + `validate_coding` reusing the shared citation gate; unsuitable-judgement short-circuits before format checks.
3. `generation/worker.py` + `models.py`: `CODING_FORMAT`, three-way dispatch in `_recipe_format`/build/validate/schema/repair, `_coding_answer_block` copying authored keys only (`hiddenTests`, `referenceSolution` | `acceptedValue`), then the **mandatory self-check**: run `referenceSolution` against all authored tests through the P2 client — any failure drops the question with a warning (groundedness-over-count; the #13 self-check rule). `output_prediction` skips the sandbox (nothing to execute).
4. Ingestion: fenced-block scan (` ```lang `) over extracted `full_text` → `materials.has_code`/`code_languages` (NULL stays NULL when no text yet — D-10). Unit-tested pure function; wiring at the existing extraction point, no new stage, no new queue.
5. Unit tests: schema/validator cases (all four subtypes, unsuitable judgement, citation-enum binding), answer-block key whitelist, self-check pass/drop, `has_code` scan cases.

### Verification

```bash
uv run --package intelligence python -m pytest services/intelligence/tests/test_generation_coding.py -q
```

Dry-run rule 80: one `implement_fn` + one `output_prediction` generation on a code-bearing fixture material before any matrix.

### Logging (D-11)

- `logger.info("coding generation %s unsuitable: %s", assessment_id, reason)` with `extra={"trace_id": correlation_id}` on judge rejections (reason only, never chunk text).
- Self-check failures log `passed/total` + first failing test name (visible tests only — hidden names are safe too, never content).
- Telemetry: existing record gains nothing new except `prompt_template_version="coding-v1"` (the blueprint field already exists).

### Rollback

Revert the commit; router admits `["coding"]` but the worker dispatch falls back to objective (the `_recipe_format` default) — so also revert the P1 `SUPPORTED_FORMATS` line in the same revert, or coding generates MCQ-shaped rows. Recorded here so the revert is one command, not a discovery.

## Phase 4: Client — take, advise, review, configure (assessments only)

**Status:** ⬜ Not started · **Depends on:** P2 (grade shape), P3 (question shape) · **Scope:** `types`, `attemptFlow`, taker, review, config chips. **PracticeThis stays disabled (D-08).**

### Steps

1. `types.ts`: `CodingSubtype`, `CodingAnswer {language, source, config}` (caps mirror the contract: source ≤100000, timeLimitMs ≤30000, memoryLimitMb ≤1024), `Question` += `language?/starterCode?/visibleTests?`, `LearnerAnswer` += coding, `QuestionGradedResult` += `testCases?`.
2. `attemptFlow.ts`: `codingAnswerProblem` (empty source / over-budget / unlisted language never leave the browser — the `writtenAnswerProblem` precedent) + `submitCodingAttempt` (fresh `clientAttemptId` per retry, same semantics). Normalization through the central client path (rule 22); new `AbortError`/`TypeError`/unknown-value cases in the client tests.
3. `CodingTaker.tsx` (**new**, `React.lazy`): CodeMirror (python, line numbers, indent, Marginalia theme) + "Run visible tests" via lazily-imported Pyodide (advisory badge, D-03) + submit → `pollGrade(..., 'judge0')` (grading takes seconds, not milliseconds — poll window honors that). `AttemptTaker` gains the third branch; objective/written paths untouched. Assert the main bundle does not move (`vite build` chunk report vs P3 baseline).
4. `ReviewSurface.tsx`: `CodingFeedback` becomes the execution table (compile row, runtime row, per-test verdicts from `testCases`, template words, `PerSkillList`, citations) — the placeholder and its test pin are replaced, not extended.
5. `AssessmentConfig.tsx`: `Coding` family option + honest copy (needs a ready material; conceptual material judged at generation with reasoning shown). `PracticeThis.tsx`: hint repoint to #45, chips stay disabled (D-08 — one-line copy change, asserted by the existing disabled-chips test).
6. Unit tests: `codingAnswerProblem`, flow submit/poll, taker phases (advisory vs graded split: Pyodide output never sets the grade), review table (redaction DOM gate: no hidden content rendered), config chips.

### Verification

```bash
pnpm --filter app test src/assessments src/pages/assessments
pnpm --filter app typecheck && pnpm --filter app lint && pnpm --filter app build
```

Mobile + desktop render check of the taker and the execution table (rule 13: `gap` rhythm, `.field-group` primitive; overflow at 375×812 fails the phase).

### Logging (D-11)

- `logger.warn` on advisory-run failures (Pyodide load/test error — advisory, never blocking); `logger.error` on submit/grade observation failures with the error's `requestId` (the `./full-app logs --grep` join).
- No source code in logs beyond what the learner already sees on screen; Pyodide stdout stays in component state, never in `logger`.

### Rollback

Revert the commit; coding questions already graded still render (the review table reverts to the placeholder — prior grades keep history, display degrades honestly).

## Phase 5: Live verification, AC sweep, records

**Status:** ⬜ Not started · **Depends on:** P4 · **Scope:** live spec + docs + ticket hygiene, no product code.

### Steps

1. `e2e/coding-assessment-live.spec.ts` (model on `practice-run-live.spec.ts`; rules 10/11/16): creds gate + backtick strip; `test.skip` inside the owning describe; phone viewport in its describe + one desktop-only assertion; `getByRole` first. Scenarios (each at 1280×720 + 375×812, `--project=app --workers=1`): (a) `implement_fn` on a code-bearing fixture material — submit via the taker, grade through Judge0, execution table asserts, reload-mid-grading resume; (b) `output_prediction` — deterministic grade, no sandbox contact (assert via Judge0 access log absence or submission-count delta). Redaction: extend the `REDACTION_RE` precedent with hidden-test/reference keys over **responses + DOM**; hidden tests named in `testCases` assert veil (`Hidden test N`, no content). Failure drill: a submission that cannot compile → fail-closed 0 with honest copy; (if cheap) Judge0 stopped mid-grade → retryable redelivery observed.
2. Prereqs (demand-started, stopped after — the sidecar rule-54 pattern): `./full-app restart full`, Judge0 compose up + trivial-submission health check, worker running (P-recovery is landed, so `full` owns it — verify, do not assume).
3. Window-scoped service-role cleanup (the #44 P4 lesson: `material_id` + `created_at >= test start`, cascade-verified empty); pre-existing shared-account rows untouched.
4. AC sweep on #42 (tick with evidence links), resolution comment, map #4 line; `.work` records (`plan/VERIFICATION.md`, `state.md`, STATUS row); per-phase commits already landed, so this commit is spec + evidence + records.

### Verification

```bash
pnpm exec playwright test -c e2e/playwright.config.ts e2e/coding-assessment-live.spec.ts --project=app --workers=1 --reporter=list
```

Plus the full gates (`app` suite modulo the 2 known WSL TZ flakes, `typecheck`, `lint`, `build`, backend suite, `ruff`, contract tests).

### Rollback

The spec is additive; reverting it reverts nothing the product uses.

## Open questions

None — the map is clear. Rounds 1+2 settled scope, hosting, advisory, gate, normalization, editor, and verification. The two live unknowns (isolate under this Docker backend; Judge0 Python language id) are P2 verification steps with recorded fallbacks/defaults, not decisions.

## Out of scope

- Coding practice runs (**#45** — owns PracticeThis enablement, run-shell coding semantics, mixed-mode runs).
- Socratic guide + gated reveal (**#46** — owns all coaching language, hint triggers, `/v1/guide/*` implementation).
- Mastery/adaptive (**#43** — consumes `QuestionGraded` observations incl. `judge0`; no work here beyond the already-present grader enum).
- Mixed-family assessments (one family per call stands — the #41 D-01 slice limit, unchanged).
- Languages beyond Python (enum + Judge0 pack + Pyodide story per language, each its own slice).
- Monaco, autocomplete, lint-in-editor (D-06 ceiling).
- LLM-verbalized grading feedback (D-07 ceiling — belongs to #46's prompt budget).
- Server "Try it" execution endpoint (D-03 ceiling).
- Cross-material synthesis (the #44 D-12 boundary, unchanged).
- `/v1/practice-runs*` (the #44 D-01 deviation, unchanged).

## References

- Ticket: [#42 Coding Assessment and Sandbox Grading](https://github.com/rings0fsaturn/study-planner/issues/42) · spec copy: `.work/specs/phase2-tickets/10-coding-assessment-sandbox-grading.md`
- Parent spec: `.work/specs/phase2-assessments-practice.md` · map: `.work/active/phase2-wayfinder/research/map-4.md`
- Sandbox decision: [#11 Code execution sandbox selection](https://github.com/rings0fsaturn/study-planner/issues/11) (closed) · `research/external/code-sandbox-comparison.md`
- Grilling record: rounds 1+2 locked 2026-09-16 (subtypes Q1, hosting Q2, advisory Q3, hybrid gate Q4/Q7, normalization Q5/Q8, editor Q6/Q10, silent judge Q11, verification Q11, reasoning-in-generation Q4-amendment)
- Surveys (2026-09-16, subagent): generation gates · grading-pipeline attach · coding-format state
- Precedents: `.work/active/issue-44-written-practice-runs/plan/PLAN.md` (plan shape, live-spec model `e2e/practice-run-live.spec.ts`), `.work/active/practice-generation-recovery/plan/PLAN.md` (worker ownership), `.work/active/logging-tracing/` (rule-17 infra)
- Contract pack: `services/intelligence/contracts/phase2/{openapi.yaml,coding-answer.schema.json,execution-result.schema.json,tests/test_contracts.py}`
