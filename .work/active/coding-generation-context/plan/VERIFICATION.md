# Verification - coding-generation-context

_Issue #67 (parent #32, map #4) · Verified 2026-09-21 · Plan: `plan/PLAN.md`_

Live stack: `./full-app` full profile (intelligence + app + worker) plus the demand-started GPU sidecar (`:8200`) and the Piston sandbox (`:2000`), both stopped after the run.
All live evidence below is redacted: no raw material text, reference solution, or hidden test content is recorded.

## AC ledger

| AC | Verdict | Evidence |
|---|---|---|
| AC1 - coding generation on `b5f51eab-...` produces a question whose reference solution passes the self-check | PASS | Assessment `55f6fc23-dc3d-45f6-8f0e-e03f40c6832c` reached `ready` with no warnings. Question shape: `format=coding`, `subtype=implement_fn`, `language=python`, 3 visible tests, `answer_block` keys `{hiddenTests, referenceSolution}` (server-only), cited one chunk at ordinal 22 of 260. Telemetry: `prompt_template_version=coding-v2`, `outcome=ok`, `questions_accepted=1`. |
| AC2 - a genuinely codeless draw still returns `code_not_derivable` | PASS | Codeless 1-chunk material `ac8e4730-...`: assessment `421aca54-...` failed with warning `code_not_derivable`, 0 questions. Also covered by unit test `test_coding_unsuitable_after_all_windows_fails_without_repair`. |
| AC3 - no schema change | PASS | No Supabase migration, no Dexie version, no `content_chunks` column. `git status` shows only app/test/script/`.work` changes. The code signal is computed in memory (D-03). |
| AC4 - objective and written generation unchanged | PASS | Live: objective on `b5f51eab-...` -> `ready` (assessment `3bdd41e6-...`); written -> `ready` (`c88d81ff-...`, subtype `short_answer`). Full intelligence suite 705 passed / 7 pre-existing unrelated failures; objective/written test suites green. |
| AC5 - harness flips `grokking-algorithms` to gold agreement and derivable rate > 0 | PASS | `eval_harness.py --summarize`: gold `checked=2, agreed=2, agreement_rate=1.0`; `grokking-algorithms` observed derivable (1 new ready vs 3 historical refusals) agrees with gold; `derivable_rate=0.3333 > 0`. |
| AC6 - no hidden grading content reaches the browser/cache/logs/telemetry | PASS | Redaction sweep: `/v1/assessments/{id}` response contains none of `referenceSolution`/`hiddenTests`/`acceptedValue` (only visible-test `expectedOutput`, which is intentional); `generation_telemetry` rows contain none; visible `questions` columns contain none; client source references are comments/test doubles only. |

## Live runs (all on the shared dev account)

| Run | Material | Recipe | Result |
|---|---|---|---|
| Coding | `b5f51eab-...` (grokking, 260 chunks) | `{formats:[coding]}` | ready, `coding-v2`, self-check passed (AC1) |
| Coding | `80c8b138-...` (ACCA, prose + worked procedure) | `{formats:[coding]}` | ready, grounded `implement_fn` (see gold decision below) |
| Coding | `ac8e4730-...` (1 chunk, codeless) | `{formats:[coding]}` | failed `code_not_derivable` (AC2) |
| Coding | `ef3abfa1-...` (DDIA, 1000 chunks) | `{formats:[coding]}` | window 1 unsuitable -> resampled -> window 2 `difficulty_mismatch` -> failed `malformed_output` (honest non-suitability failure; resample visible in logs) |
| Objective | `b5f51eab-...` | `{formats:[objective]}` | ready (AC4) |
| Written | `b5f51eab-...` | `{formats:[written]}` | ready (AC4) |

## Production defects found by live E2E (fixed in this task)

1. **Context-builder wiring** - `app/worker_main.py`'s `context_builder` closure accepted only three positional args, so the new `code_seeking` keyword raised `TypeError` on every live coding message. The generic handler redelivered it, leaving the assessment `generating`. Fixed by threading `code_seeking`/`exclude_chunk_ids` through the closure. This is exactly the gap unit tests with hand-written doubles cannot catch.
2. **Self-check needs Piston** - the generation-time self-check requires the demand-started Piston sandbox (`:2000`); it was stopped. Started with `docker compose --profile sandbox up -d piston`, stopped after.

## Decision recorded: ACCA coding gold re-pinned

`coding-v2`'s derivation rule ("refuse only when the chunks contain no code, no algorithm, and no implementable technique") lets ACCA's prose + worked formula produce a grounded, executable `implement_fn` question that passes the self-check. Under the #48 gold the material was labeled `expectedDerivable=false` because it has no code fences - the exact signal this task replaces.
Decided with the user 2026-09-21: accept the derivation as valid and re-pin `eval_golds_coding.json` ACCA to `expectedDerivable=true`, recording the new label `"acca-apm (prose + worked procedure)"` and concept `"linear trend forecast with seasonal adjustment"`.
Consequence: the durable gold set no longer holds a negative case; the refusal path is guarded by `test_coding_unsuitable_after_all_windows_fails_without_repair` plus the live codeless run (AC2).

## Deviations from the plan

- **Window count is logged, not stored in telemetry (P4.5).** The generation-telemetry contract is `additionalProperties: false` and persisting a new field needs a migration, which AC3 forbids. Each window is logged with `trace_id` (rule 17) and acceptance logs `window n/3`; no telemetry field was added. Revisit only if a telemetry migration is separately sanctioned.
- **AC2's live fixture is a 1-chunk codeless material**, not ACCA, because ACCA is legitimately derivable under the agreed rule (above).

## OCR delegate review

`ocr delegate preview` scoped to the seven changed source/script files (unrelated untracked `college/`, `graphify-out/`, `.claude/`, `.cursor/` excluded). One medium finding fixed:

- `context.py`: `_code_seeking_context` widened the listing query's `select` with a literal `str.replace`, which would silently no-op if the query shape changed and degrade to an even spread. Replaced with an explicit `select` built in `_spread_context`; the code-seeking path now receives the text-bearing query directly.

No critical or high findings. Residual low notes: the code-seeking fetch pulls all candidate text in one request (PostgREST row cap could truncate very large materials - the tail is then never scored); `code_proximity`'s assignment regex can match prose but density scaling keeps its weight small.

## Verification commands

```bash
uv run --package intelligence pytest services/intelligence/tests/ -q   # 705 passed, 7 pre-existing
uv run --package intelligence ruff check services/intelligence/        # clean
uv run --package intelligence ruff format --check <changed files>      # clean
```

Pre-existing unrelated failures (unchanged from the #48 baseline): `test_retrieval_probe.py` (2, stale import) and `test_v1_integration.py` (5, TZ/time-of-day golden flake).
