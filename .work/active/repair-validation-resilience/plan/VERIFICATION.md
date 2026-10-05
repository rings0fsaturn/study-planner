# Verification – repair-validation-resilience

_Plan: `plans/2026-09-27-repair-validation-resilience.md` · Verified 2026-09-27_

## Commands and results

| Check | Command | Result |
|---|---|---|
| Focused generation suites | `uv run --package intelligence pytest services/intelligence/tests/test_generation_worker.py services/intelligence/tests/test_generation_coding.py services/intelligence/tests/test_generation_adapter.py -q` | 101 passed |
| Broader backend suite | `uv run --package intelligence pytest services/intelligence/tests -q` | 838 passed, 18 failed (all pre-existing/unrelated: 16 `test_v1_integration` golden, 2 `test_retrieval_probe` `ModuleNotFoundError`) |
| Lint | `uv run --package intelligence ruff check services/intelligence/app/generation` | All checks passed |
| Format | `uv run --package intelligence ruff format --check services/intelligence/app/generation ...` | all formatted |
| Live E2E | one coding generation on `grokking-algorithms` via a throwaway Playwright spec | terminal status observed; new log lines present; temp spec deleted |

## TDD evidence (RED -> GREEN)

- Phase 1: 3 failing tests (generic `repair validation failed` message) -> `_repair_once` names the reason.
- Phase 2: 5 failing tests (no resample on repair failure) -> `MAX_PLAIN_WINDOWS` + resample branch.
- Phase 3: 8 failing caplog tests (silent branches) -> trace logs + `_retry_sleep`.
- Review fixes: 2 failing tests (D-04 `validation_failed` mislabel; self-check-failed candidate persisted `ready`) -> per-window `accepted` reset + `resample_failure`.

## Review gate (fanned-out `opencode` agents)

- Correctness review: first BLOCK (D-04 no-steer resample mislabel), second BLOCK (critical stale-`accepted` persist), third **APPROVE**.
- Thermo-nuclear review: first BLOCK (4 duplicated resample sites), second **APPROVE** after `_resample`/`_fail_malformed` extraction and sentinel collapse.
- Residual findings are LOW/INFO and recorded in `state.md` Open.

## Live evidence

- Assessment `46bc1df6-397d-4c15-940e-ee42729d4a0b`, trace `e67a344c-ffa2-4507-b5d0-52931b6e334a`.
- Worker log showed, each with `trace_id`: `coding self-check ... failed; attempting one repair`, `window 1/3 self-check unresolved; resampling`, `window 2/3 unsuitable; resampling`, and the terminal `malformed terminal: reference solution passed 3/8 tests; first failure: empty list (runtime_error)`.
- No silent terminal remains; the previous dead-end trace shape is gone.
- Sidecar and Piston were started for the run and stopped afterwards.
