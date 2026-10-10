# Plan - practice-gen-400 transient 400 retry fix

## Goal
Fix the proved transient OpenRouter 400 failure so one bounded retry absorbs it inside the adapter.
Keep every other 400 behavior unchanged.
Leave the working tree safe for the uncommitted `repair-validation-resilience` changes.

## Context for the new session
The reported practice run failed with `Generation was interrupted` plus `Error code: 400` provider text.
The live assessment `7084b42a-fda2-4150-89a6-c70dc6c09784` matches the screenshot byte-for-byte.
The material is CSAPP 2016 (`be7e88a0`), 2065 chunks, coding recipe, no scope.
The full proof lives in `.work/active/practice-gen-400-debug/research/400-debug-findings.md`.
Read that file first before touching code.
The failure path is `PracticeRun.tsx:526` to `worker.py:763-794` to `openrouter_client.py:158-178,333-345,365-367`.
The prompt was 6759 chars on the failing window and the same bytes succeeded on retry.
The raw provider was `Sail Research` with `invalid_request_error`.
Context-length and static-params were both disproved with executed code.
Do not re-litigate the root cause unless the code contradicts the findings.
Code is ground truth, so fix the doc if the code disagrees.

## Ground rules for all phases
Use `work-journal-orchestrator` at session start, after each phase, and at session end.
Use `tdd` and `ponytail` for every code change.
Keep the diff minimal and delete nothing unrelated.
Obey rules `10`, `17`, `22`, `42`, `53`, and `80` in every phase.
Never print secret values, compare only value lengths.
Never commit `.env` files, tokens, or raw provider payloads with user data.
Check `git status --short` before and after every phase.
Preserve the unrelated uncommitted changes from `repair-validation-resilience`.
Run the smallest relevant check first, then broaden verification in proportion to the change.
Restart the managed runtime before browser verification because Vite on WSL misses `/mnt/d` edits.

## Shared review and commit gate after every coding phase
Fan out exactly two review subagents in parallel with the Task tool.
Assign subagent A the `open-code-review-delegate` skill for correctness.
Assign subagent B the `thermo-nuclear-code-quality-review` skill for maintainability.
Require both verdicts to be PASS or APPROVE before proceeding.
If either review fails, fix every finding, re-run the focused tests, and re-review.
Repeat the fix plus re-review loop until both subagents pass.
Inspect `git status --short` and `git diff` before committing.
Stage only the files this phase intended to change.
Write one concise commit message in the repo style.
Verify with `git log --oneline -3` and a clean task-path status after committing.
Never amend a rejected commit, create a new commit for each fix round.

## Phase 0 - Orient and lock the baseline, no code
Use `work-journal-orchestrator` to RESUME `practice-gen-400-debug` from `state.md` and `SCRATCHPAD.md`.
Read `.work/STATUS.md`, the findings doc, and the four failure-path files at their cited lines.
Confirm `git status --short` still shows the expected uncommitted work plus this task folder.
Run the focused adapter suite once to lock the green baseline.
Do not change any production file in this phase.
Exit when the agent can restate the root cause and the retry boundary without guessing.

## Phase 1 - Retry one transient 400 in `generate`, with tests
Use `tdd` for the red-green loop and `ponytail` to keep the change to the smallest diff.
Edit only `services/intelligence/app/generation/openrouter_client.py` plus `services/intelligence/tests/test_generation_adapter.py`.
Add exactly one retry for `APIStatusError` 400 when the failure would classify as generic `provider_error`.
Never retry 400s that classify as `unsupported_request` for effort or reasoning text.
Never retry 401, 402, or 403.
Reuse `RETRY_DELAY_SECONDS` and the existing `_retry_sleep` log shape with `trace_id`.
Keep the second consecutive 400 on the current terminal path unchanged.
Add a failing test first that sends 400-provider_error then success and asserts two calls plus `ok`.
Add a second test that sends effort-400 and asserts one call plus `unsupported_request`.
Keep the existing 429 and 5xx tests green without copying their bodies.
Run `uv run pytest` on the adapter test file, then `ruff check` plus `ruff format --check` on touched files.
Apply the shared review and commit gate before leaving this phase.

## Phase 2 - Parity in `stream_text` plus provider observability
Use `tdd` and `ponytail`, and keep rule `17` intact for every new log line.
Mirror the Phase 1 retry boundary in `stream_text` without changing its yield contract.
Extract `provider_name` and `provider_error_code` from the error body only when present.
Log them with `trace_id` through the module logger on every terminal 400.
Keep the stored warning shape unchanged so no migration is needed.
Extend the adapter tests for stream retry parity and for the new log fields.
Run the adapter plus worker focused suites, then `ruff check` and `ruff format --check`.
Apply the shared review and commit gate before leaving this phase.

## Phase 3 - Honest learner-facing warning, raw detail stays in logs
Use `tdd`, `ponytail`, and `impeccable` for the user-visible copy.
Change the backend warning text for transient provider 400 to one short honest sentence.
Keep the raw provider string in server logs and telemetry only.
Update `PracticeRun.tsx` only if it currently depends on the raw prefix.
Update `PracticeRun.test.tsx` and `AssessmentDetail.test.tsx` in the same change if the copy changes.
Verify at desktop and mobile widths when any UI file changes.
Run the app focused tests plus `pnpm typecheck` and `pnpm lint` for touched surfaces.
Apply the shared review and commit gate before leaving this phase.

## Phase 4 - Regression guards and cheap live verification, no full runs
Use `tdd` for a strict-compatibility contract test across objective, written, and coding schemas.
Record the coding `oneOf` root as a known exception only if it still passes live after Phase 1.
Run the generation focused suites plus the worker and grading suites that touch the adapter.
Run one rule-`80` dry-run probe of at most three live calls on the CSAPP window-3 shape.
Confirm a former try0-fail plus try1-ok pair now returns `ok` inside a single `generate` call.
Never run a full matrix, bake-off, re-embed, or book-scale E2E in this phase.
Record the probe outcome in `plan/VERIFICATION.md` with request IDs but no secrets.
Apply the shared review and commit gate for the contract test, then close with `work-journal-orchestrator` SESSION END.
