# State – repair-validation-resilience
_Spec: plans/2026-09-27-repair-validation-resilience.md · Plan: active/repair-validation-resilience/plan/ · STATUS row: repair-validation-resilience · Status: active (code complete, uncommitted) · Updated: 2026-09-27_

## Current state & next
- All four plan phases implemented and verified; code is complete but uncommitted (do not commit unless the human asks).
- Review gate passed: two rounds of fanned-out `opencode` agents (correctness + thermo-nuclear) ended APPROVE; see `plan/VERIFICATION.md`.
- Next: human decides whether to commit; otherwise this task can be wrapped via work-journal.

## Done so far
- Phase 1: `_repair_once` (`worker.py`) no longer returns the dead-end `repair validation failed`; it names the adapter outcome/error. 3 new/strengthened tests.
- Phase 2: `MAX_PLAIN_WINDOWS = 2`; a repair that did not resolve validation resamples a fresh window for every family before failing closed. 5 new/updated tests.
- Phase 3: every previously silent terminal/retry branch logs with `trace_id` (context deferred/failed-closed, both repair paths, provider, safety, malformed terminal, self-check) plus adapter retry sleeps via `_retry_sleep`. 8 new/updated caplog tests.
- Review-driven fixes: (a) a no-steer coding resample could empty the window and mislabel repair exhaustion as `validation_failed`/`partial` (D-04 violation); (b) critical pre-existing leak where a self-check-failed candidate could be persisted `ready` after a resample emptied the window. Fixed by resetting `accepted` each window and carrying one `resample_failure` sentinel. 2 regression tests.
- Refactor from review: `_resample(...)` backs all four resample sites; `_fail_malformed(...)` backs all malformed terminals; the two sticky sentinels collapsed into one `resample_failure`.
- Phase 4: broader suite 838 passed (18 pre-existing unrelated failures); live coding generation on grokking-algorithms exercised the new log lines with `trace_id`; sidecar + Piston stopped after the run.

## Flow trace
1. Window loop `worker.py:426-905`: reset `accepted` each window; build context -> optional Jev gates -> generate -> validate -> at most one `_repair_once`.
2. Repair failure (format): `resample_failure = warnings`; `_resample(...)` excludes tried chunks and continues, else falls through to `_fail_malformed`.
3. Coding self-check failure: `resample_failure = [failure]`; resample else `_fail_malformed`.
4. Refusal (jev-unsuitable / code_not_derivable): `resample_failure = <reason str>`; resample else break to the `code_not_derivable` terminal.
5. Empty context after a resample: break on `resample_failure`; post-loop dispatches `list` -> malformed terminal, `str` -> refusal terminal.
6. Adapter `_retry_sleep` logs `attempt/delay/reason` with `trace_id` before `time.sleep`.

## Files affected
- `services/intelligence/app/generation/worker.py` – `MAX_PLAIN_WINDOWS`, `_repair_once` reason, `_resample`, `_fail_malformed`, `resample_failure`, `accepted` per-window reset, `_retry_sleep` callers, all new trace logs.
- `services/intelligence/app/generation/openrouter_client.py` – `_retry_sleep` helper + logging at all generate/stream retry sites.
- `services/intelligence/tests/test_generation_worker.py` – repair-reason, resample, terminal, and caplog tests.
- `services/intelligence/tests/test_generation_coding.py` – coding resample + two out-of-candidates regression tests.
- `services/intelligence/tests/test_generation_adapter.py` – 429 retry-sleep log test.

## Pitfalls & rules
- `error_code` and telemetry `outcome` stay `malformed_output` after every window is exhausted (D-04); only the warning `message` changed.
- Citation-gate drops never repair and never resample (D-07).
- Never log or prompt-inject reference solution, hidden tests, stdin/stdout, or source excerpts (D-08, rule 42).
- Every new backend log line carries `trace_id` via `extra={...}` (rule 17).
- `skillTags` is optional (`routers/assessments.py:104`), so coding can run with no steer; only then does the spread path apply `exclude_chunk_ids`. A steered retrieval RPC ignores the exclusion, so a steered resample is a fresh draw, not a fresh window.
- The working tree also holds unrelated pre-existing changes (college deletions, rules 10/51/54, `test-login-cred.txt`, research/scripts); do not revert them.

## Decisions in force
- D-01..D-08 from the plan in force.
- Kept the plan's Phase-1 sketch (`reason` from the adapter `message`); the review's LOW D-08-hardening note (raw provider text can reach the warning for a provider-error repair) is recorded in Open, not changed, because the plan chose that string.
- Review follow-ups declined as out of scope: splitting the 1400-line `worker.py` / the coding self-check block into modules, and the Jev-gates extraction.

## Open
- LOW (D-08 hardening): `_repair_once`'s fallback embeds `repaired.error.message`, which for a `provider_error`/`quota_failure` repair is raw adapter/SDK text. Consider using `error.code` instead when this path is revisited.
- Pre-existing: `worker.py` is ~1400 lines; the window loop + self-check block are the natural next decomposition (not this bug-fix plan).
- Pre-existing: `test_v1_integration.py` 16 golden failures + `test_retrieval_probe.py` 2 `ModuleNotFoundError` failures on the clean tree; unrelated.
- Commit decision belongs to the human.
