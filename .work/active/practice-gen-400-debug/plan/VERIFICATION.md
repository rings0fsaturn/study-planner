# Phase 4 verification - strict contract plus live dry run (2026-10-07)

## Contract test

- New file `services/intelligence/tests/test_generation_schema_contract.py`.
- Objective and written roots assert strict-shaped (object root, `additionalProperties: False` recursive).
- Coding `oneOf` root recorded as the known exception: each of the 3 branches asserts strict-shaped, and one sample per branch validates locally via `Draft202012Validator`.
- Suites: generation focused (adapter, contract, worker, coding, validation, prompts) 203 passed; grading worker, guide API, jev, worker-main 62 passed.
- `ruff check` plus `ruff format --check` clean on the new file.

## Live dry run (rule 80, 3 logical calls, CSAPP window shape)

- Material `be7e88a0`, coding arm, no scope, `code_seeking` spread rebuild each call.
- Every call rebuilt the identical window: 5 chunks, ordinals `[118, 451, 859, 1243, 1676]`, prompt 7596 chars, schema root `oneOf`.
- Call 1 (`phase4-probe-894ee2b8`): `ok`, prompt_tokens 2310, completion_tokens 935.
- Call 2 (`phase4-probe-c1670059`): terminal `provider_error`, retryable False, honest learner copy (`A temporary provider issue interrupted generation; please try again.`).
- Call 3 (`phase4-probe-d4c6fe1c`): `ok`, prompt_tokens 2310, completion_tokens 1026.
- Identical bytes returned ok, provider_error, ok across the three calls: the transient intermittency from the findings (H3) reproduces live.
- Call 2 detail: the honest copy plus `provider_error`/non-retryable proves the terminal attempt was a 400 `provider_error` (the only path that yields `_terminal_message`), and that class always takes the bounded in-adapter retry first, so a retry fired before the terminal 400. The first-attempt class is unknown (429, 5xx, timeout, connection, or an earlier 400 are all retryable; the probe's INFO-level retry counter missed the line through logger level filtering). The deterministic single-transient absorption is proved by `test_transient_400_provider_error_retries_once_then_ok`.
- Residual: a retry-then-terminal-400 still parks the assessment in `generating` with the honest message. That matches the Phase 1 boundary (second consecutive 400 stays terminal) and is out of scope for this fix.
- No full matrix, bake-off, re-embed, or book-scale E2E was run. No secrets, chunk text, or payloads recorded here.
