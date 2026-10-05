# repair-validation-resilience - implementation plan

_Written 2026-09-27. Status: complete (all four phases implemented + verified, code uncommitted; awaiting human commit decision). Baseline commit: `1d6fddb` plus an uncommitted coding self-check fix in the working tree (see Baseline below)._

## How to use this plan

You are an AI agent asked to implement one or more phases below.
Read this whole preamble and the Decisions log before touching code.
Each phase is a vertical slice that a fresh context window can implement and verify on its own.
Work phases in order: phase 2 builds on phase 1, and phase 3 is independent but easiest to test once 1 and 2 land.
Follow the repository rules in `.agents/rules/`, above all rule 17 (logging and tracing) and rule 42 (assessment and practice generation).
Run the smallest relevant check first, then broaden verification in proportion to the change.
Do not commit unless the human explicitly asks.
Update the phase status marker as you go.

## TL;DR

Assessment generation dies with a dead-end `malformed_output: repair validation failed` whenever the model fails two validation passes in a row (initial plus one repair).
The failure is terminal for every family (objective, written, coding), and the terminal branch writes no worker log line, so the trace is silent.
Fix both: make the failure message name the real validation gate and give every family a small bounded window resample before failing closed, and log every currently-silent terminal and retry branch with its `trace_id`.

## Context and evidence

Assessment `5f4f6676-a1c0-460e-8973-23b9560e88dc` (`trace_id=1445b1ef-c8b5-4df5-8d44-13b36b8eb4b9`, job `6c5d41ee-c64f-4c39-95a7-8ec270a9286c`, material `grokking-algorithms`, coding family) failed on screen with:

```
malformed_output: repair validation failed
```

The worker log for that trace shows:

- `01:06:25` Jev suitability `not_derivable conf=0.42` (advisory, did not block) and passage filter kept `4/5`.
- `01:06:28` OpenRouter `chat/completions 200` (initial generation).
- `01:08:22` OpenRouter `chat/completions 200` (repair generation).
- `01:10:23` terminal writes: `PATCH assessments`, `PATCH ingestion_jobs`, `POST generation_telemetry`, `ingestion_complete`.
- Zero Piston calls for `attempt=5f4f6676`, so the coding self-check never ran.

Two defects are visible in that trace.

1. The product failure: `_repair_once` (`services/intelligence/app/generation/worker.py:1094-1120`) discards the real validation failures and returns the generic `{"code": "malformed_output", "message": "repair validation failed"}`. The specific gate (for example `difficulty_mismatch`, `visible_tests_count`, `rubric_weights_not_normalized`, `citation_missing`) is lost, and the learner sees a dead-end message.
2. The tracing gap: the terminal path after repair failure (`worker.py:741-759`) calls `_fail_assessment` with no preceding log line. Several other terminal and retry branches are silent too, so a trace like this cannot be diagnosed from `worker.log` alone.

The two roughly two-minute gaps between the LLM calls and the DB writes are unexplained by worker logs and are consistent with invisible adapter retry backoff in `services/intelligence/app/generation/openrouter_client.py:127-207`.

## Baseline (do not re-do)

The working tree already contains an uncommitted fix for a different coding-generation failure.
It moved the coding self-check inside the window loop and added one bounded repair plus a resample on unresolved self-check.
Files: `services/intelligence/app/generation/worker.py` and `services/intelligence/tests/test_generation_coding.py`.
The self-check repair log line is the pattern to copy for the new logging work.
Verify with `git diff services/intelligence/app/generation/worker.py` before starting so you build on it and do not revert it.

## Decisions log

- **D-01 - Resample on repair failure for every family.** The dead-end lives in the shared validation and repair path, so objective, written, and coding all get the bounded resample. Confirmed with the human 2026-09-27.
- **D-02 - Surface the specific gate to the learner.** The user-visible warning changes from `repair validation failed` to the real reasons, joined. Confirmed with the human 2026-09-27.
- **D-03 - Window budget.** Coding keeps `MAX_CODING_WINDOWS = 3` (`worker.py:278`). Objective and written move from 1 to 2 total windows. Rationale: bounded worst-case LLM spend, and a second window is the cheapest way out of a bad JSON draw. This is an assumption, flagged in Open questions.
- **D-04 - Keep the public error code and telemetry outcome stable.** `error_code` stays `malformed_output` and the telemetry `outcome` stays `malformed_output` after all windows are exhausted. Only the warning `message` changes. This preserves rule 42 and the telemetry contract (`additionalProperties: false`).
- **D-05 - Log every currently-silent terminal and retry branch** with `trace_id` via `extra={...}`, per rule 17.
- **D-06 - Log adapter retry sleeps** (429, 5xx, timeout) with the delay and the correlation id, so the silent multi-minute gaps become explainable.
- **D-07 - Citation-gate drops stay unchanged.** `citation_missing` returns without repair (`worker.py:531` requires `malformed_output`), and that behavior is preserved. Do not route citation drops into the resample.
- **D-08 - Redaction holds.** Never log or prompt-inject the reference solution, hidden tests, stdin, stdout, or source excerpts. The self-check repair passes only test name and outcome, and the new logs carry codes, gate names, counts, and `trace_id` only. See rule 42 and the D-11 note in `piston_client.py`.

## Architecture overview

The generation worker runs one grounded question per `assessment_generate` message.
A window loop (coding up to `MAX_CODING_WINDOWS`, others one iteration) builds context, generates, validates, and applies at most one repair.
Today a repair that also fails validation falls through to a terminal `malformed_output` with the generic message.
The change makes that path resample a fresh window (excluding chunks already tried, for coding) before failing, and makes every terminal and retry exit log its reason.
Nothing changes in the response schema, the completion RPC, or the public warning code.

## Files-touched index

- `services/intelligence/app/generation/worker.py` - `_repair_once` return value, `max_windows` budget, resample on repair failure, logging on silent branches.
- `services/intelligence/app/generation/openrouter_client.py` - retry-sleep logging.
- `services/intelligence/tests/test_generation_worker.py` - objective and written repair-exhausted and resample tests.
- `services/intelligence/tests/test_generation_coding.py` - coding repair-validation-failure resample test.
- `services/intelligence/tests/test_generation_adapter.py` - optional retry-sleep log assertion.

## Phases

### Phase 1 - `_repair_once` returns the real reasons

Status: Complete (2026-09-27) - `_repair_once` names the adapter outcome/error; 3 new/strengthened tests green.

Goal: the terminal warning names the actual gate instead of `repair validation failed`.

Change `_repair_once` (`worker.py:1094-1120`) so the failure return carries the validator's own failures.
Today line 1120 is:

```python
        return None, [{"code": "malformed_output", "message": "repair validation failed"}]
```

Replace it with a return that, when the repair response is unusable, still names what failed.
Two sub-cases:

- The repair response is well-formed but fails validation: return the validator warnings unchanged (they already carry the specific gate in `message`).
- The repair response is itself malformed or empty: keep a `malformed_output` warning, but include the adapter outcome or error message so it is not generic.

Sketch:

```python
        if repaired.outcome == "ok" and repaired.structured_output is not None:
            return validate(repaired.structured_output, blueprint, context_ids, chunk_texts)
        reason = str((repaired.error or {}).get("message") or repaired.outcome or "unknown")
        return None, [
            {"code": "malformed_output", "message": f"repair did not yield valid output ({reason})"}
        ]
```

Tests (TDD, write first):

- `services/intelligence/tests/test_generation_worker.py:418` (`test_malformed_output_repair_exhausted_fails_assessment`): after the change the exhausted assessment warning message must be non-generic and must not equal `repair validation failed`.
- `services/intelligence/tests/test_generation_worker.py:764` (`test_written_repair_exhausted_fails_assessment_malformed`): same expectation for the written family.
- Add one test where the initial output fails a named gate (for example `difficulty_mismatch`) and the repair also fails the same gate; assert the terminal warning message contains `difficulty_mismatch`.

Verify:

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_worker.py -q
uv run --package intelligence ruff check services/intelligence/app/generation/worker.py
uv run --package intelligence ruff format --check services/intelligence/app/generation/worker.py
```

Rollback: revert the `_repair_once` return change; no schema or contract impact.

### Phase 2 - Bounded resample on repair failure for every family

Status: Complete (2026-09-27) - `MAX_PLAIN_WINDOWS = 2`; repair-unresolved resample branch; 5 new/updated tests green.

Goal: before failing closed, try one more fresh window when the repair did not resolve validation.

Change the window budget at `worker.py:414` from:

```python
        max_windows = MAX_CODING_WINDOWS if coding else 1
```

to a named constant, for example `MAX_PLAIN_WINDOWS = 2`, and:

```python
        max_windows = MAX_CODING_WINDOWS if coding else MAX_PLAIN_WINDOWS
```

Then, after the validation and repair block (`worker.py:525-560`), add a resample branch when the repair was attempted and still produced no accepted candidate.
Placement matters: it must come after `_repair_once` has run and before the `code_not_derivable` handling at `worker.py:665`.
Condition: `accepted is None` and `repair_attempted` is true and the current warnings include `malformed_output` and `window < max_windows`.
Action: log `window N/M repair unresolved; resampling (<message>)` with `trace_id`, update `tried_chunk_ids` with `retrieved_ids` for coding, and `continue`.

Coding note: the loop top already rebuilds context and resets `accepted = None` before generation (`worker.py:520-523`), so `continue` is safe.
Objective and written context builders ignore `exclude_chunk_ids`, so excluding tried chunks only affects coding.

Do not resample when:

- The candidate was dropped by the citation gate (`citation_missing`), which never repairs (D-07).
- The response outcome was a retryable provider fault, which has its own path at `worker.py:703-725`.
- All windows are exhausted, in which case fall through to the existing terminal path.

Tests (TDD, write first):

- Objective: initial `malformed_output`, repair `malformed_output`, then a valid response on window 2; assert two generations plus one repair happened and the assessment is `ready`.
- Objective terminal: `malformed_output` on both windows; assert `len(adapter.calls) == 4` (two generations plus two repairs), terminal `failed`, and job `error_code == "malformed_output"`, `retryable is False`.
- Written: mirror the objective pair using `written_assessment()` and `VALID_WRITTEN`.
- Coding: initial validation failure, repair validation failure, then acceptance on window 2; assert the resample log line and `repo.questions == 1`.
- Ensure `test_citation_drop_fails_without_repair` (`test_generation_worker.py:476`) and `test_written_citation_drop_fails_without_repair` (`:791`) still assert exactly one adapter call.

Verify:

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_worker.py services/intelligence/tests/test_generation_coding.py -q
uv run --package intelligence ruff check services/intelligence/app/generation/worker.py
uv run --package intelligence ruff format --check services/intelligence/app/generation/worker.py
```

Rollback: restore `max_windows` to 1 for objective and written and remove the resample branch.

### Phase 3 - Close the tracing gap

Status: Complete (2026-09-27) - context/provider/safety/malformed terminals + both repair paths + adapter retry sleeps all log with `trace_id`; 8 new/updated caplog tests green.

Goal: every failure, retry, and terminal exit is visible in `worker.log` with its `trace_id`.

Add `logger` lines (`extra={"trace_id": correlation_id}`) to each currently-silent branch, mirroring the self-check repair line already in the file:

- Retryable context fault that leaves the assessment `generating` (`worker.py:454-463`): log the code and message before `_mark_job_retryable`.
- Non-retryable context fault that fails closed (`worker.py:464-478`): log the code and message before `_fail_assessment`.
- Retryable provider outcome that stays `generating` (`worker.py:703-725`): log outcome, error code, retryable, and `retryAfterSeconds`.
- `safety_block` (`worker.py:727-739`): log outcome before `_fail_assessment`.
- Generic malformed terminal (`worker.py:741-759`): log the joined warning messages before `_fail_assessment`.
- Repair lifecycle on the validation path (around `worker.py:531-544`): log `validation failed; attempting repair (<feedbacks>)` before `_repair_once`, matching the self-check repair line.
- Adapter retry sleeps in `openrouter_client.py:127-207`: on each `time.sleep(delay)` for a 429, 5xx, timeout, or connection retry, log a line with the attempt, delay seconds, and `correlation_id`. This is what explains the silent gaps.

The `_mark_job_retryable` helper (`worker.py:1238-1246`) can stay as is if each caller logs first.

Tests (TDD, write first, using `caplog` at logger `generation.worker` and `generation.openrouter`):

- One assertion per new branch, following the pattern at `test_generation_coding.py:703-719`.
- Adapter test in `test_generation_adapter.py`: a 429 then success produces a retry-sleep log line carrying the correlation id.

Verify:

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_worker.py services/intelligence/tests/test_generation_coding.py services/intelligence/tests/test_generation_adapter.py -q
uv run --package intelligence ruff check services/intelligence/app/generation
uv run --package intelligence ruff format --check services/intelligence/app/generation
```

Rollback: the logging lines are additive and safe to revert independently.

### Phase 4 - Full verification and live end-to-end

Status: Complete (2026-09-27) - broader suite 838 passed (18 pre-existing unrelated: 16 test_v1_integration golden + 2 retrieval_probe import); live coding generation on grokking-algorithms exercised the new resample/self-check/malformed terminal log lines with `trace_id` (assessment `46bc1df6-397d-4c15-940e-ee42729d4a0b`, trace `e67a344c-ffa2-4507-b5d0-52931b6e334a`); sidecar + Piston stopped after the run. Two review-agent rounds (correctness + thermo-nuclear) ended APPROVE.

Goal: prove the fix on the real stack.

1. Run the broader backend suite and confirm no new failures.
Pre-existing and unrelated: `services/intelligence/tests/test_v1_integration.py` has 18 golden-fixture failures on the clean tree at `1d6fddb` (verified by stashing the generation changes). Do not chase them.
2. Ensure the managed runtime is up: `./full-app status full`, then `./full-app start full` if needed. Coding generation needs Piston on `:2000` and the sidecar on `:8200`.
3. Live reproduction: run a coding generation against `grokking-algorithms` (`b5f51eab-c11d-4505-80db-88bb3627801d`) with the `binary search` steer, or reproduce the exact failing scenario with the same material and skill tags as assessment `5f4f6676`.
Watch `worker.log` for the new resample and repair lines, then confirm the assessment reaches `ready` or, if it still fails, that the UI warning names the real gate.
4. Join the trace with `./full-app logs intelligence --grep <trace_id>` per rule 17.

```bash
uv run --package intelligence pytest services/intelligence/tests -q
./full-app status full
```

## Open questions

- **Window budget (D-03).** Is two total windows right for objective and written, or should they also get three? Two is the conservative default.
- **Repair-feedback strength.** After phase 1 ships and real warnings name the top failing gate, consider a targeted repair instruction for the repeat offender (for example a strict no-fences reminder). Do not guess this before the distribution is visible.
- **Message contract.** Confirm no client parses the warning `message` string. Phase 1 only changes the text; `code` stays `malformed_output`.

## Out of scope

- Changing the response schemas or adding new subtypes.
- Changing the completion RPC, migration, or any Supabase contract.
- Changing the coding self-check behavior already landed in the working tree.
- Fixing the pre-existing `test_v1_integration.py` golden failures.
- Frontend rendering changes. The UI already renders `warnings[].code: message` (`apps/app/src/pages/assessments/AssessmentDetail.tsx:477-495`); phase 1 only changes the string it displays.

## References

- `services/intelligence/app/generation/worker.py` - the window loop, repair, self-check, and terminal paths.
- `services/intelligence/app/generation/validation.py` - the gates whose names will surface.
- `services/intelligence/app/generation/openrouter_client.py` - retry backoff.
- `services/intelligence/app/generation/repo.py` - the persistence protocol.
- `.agents/rules/17-logging-and-tracing.agents.md` - the trace-id contract.
- `.agents/rules/42-assessment-and-practice-generation.agents.md` - generation and queue contracts.
- `.agents/rules/10-runtime-and-e2e.agents.md` - the managed runtime and log join.
- `.agents/rules/80-script-dry-run-before-full-runs.agents.md` - dry-run before paid or long runs.
- Evidence for this plan: assessment `5f4f6676-a1c0-460e-8973-23b9560e88dc`, `trace_id 1445b1ef-c8b5-4df5-8d44-13b36b8eb4b9`, `.dev/full-app/logs/worker.log` around line 664531.
