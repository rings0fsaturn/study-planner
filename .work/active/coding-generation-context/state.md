# State – coding-generation-context
_Spec: https://github.com/rings0fsaturn/study-planner/issues/67 (parent #32, map #4) · Plan: active/coding-generation-context/plan/PLAN.md · STATUS row: coding-generation-context · Status: done · Updated: 2026-09-21_

## Current state & next
- Done 2026-09-21: P0-P5 all complete and live-verified; AC1-AC6 all pass (see `plan/VERIFICATION.md`).
- Committed as `b6e286b` on `project/phase-2` (code + tests + `eval_golds_coding.json` + `.work` record).
- Next: wrap the task via work-journal (archive the folder + flip the STATUS row to Done).

## Done so far
- P0: issue #67 opened (child of #32, map #4), task folder + STATUS Active row, plan moved to `plan/PLAN.md`.
- P1: pure `code_proximity(text) -> float` scorer beside `scan_code_blocks` in `app/ingestion/code_signal.py`; signals that survive PDF extraction (keywords, call/assignment shapes, operators), density-scaled 0..1.
- P2: `build_context(..., *, code_seeking=False, exclude_chunk_ids=frozenset())`; code-seeking picks the top-proximity chunk per ordinal band; `ContextBuilder` is now a Protocol; worker threads the coding flag via `_build_context` and `_widen_thin_context`.
- P3: `CODING_PROMPT_TEMPLATE_VERSION = "coding-v2"`; system prompt gains the derivation rule and the narrower codeless refusal.
- P4: `MAX_CODING_WINDOWS = 3`; the context->generate->validate step is a bounded resample loop; tried chunk ids excluded between windows; terminal refusal preserved with the last reason; each window logged with `trace_id`.
- P5: cheap checks green; live coding/objective/written generations verified; codeless refusal verified; harness re-run gold agreement 2/2, derivable rate 0.333; redaction sweep clean; OCR delegate review done (one medium fix); sidecar + Piston stopped.
- Live-found production defects fixed: `worker_main.py` closure rejected the new kwargs (assessment stuck `generating`); Piston sandbox was stopped (self-check needs it).

## Flow trace
1. Coding no-steer context: `context.py:_spread_context` -> `_evenly_spaced` (default) or `_code_seeking_context` -> `_top_code_picks` (coding arm).
2. `_top_code_picks`: CONTEXT_TOP_K contiguous ordinal bands, highest `code_proximity` per band; ties take earliest ordinal, so all-prose degrades to the even spread.
3. Worker: `_process` loops windows 1..3 for coding (1 for objective/written); `break` on accepted or final unsuitable; post-loop handles accept/refuse.
4. Validation/prompt/citation gate unchanged; `coding-v2` flows to telemetry and the stored question row.

## Files affected
- `services/intelligence/app/ingestion/code_signal.py` – added `code_proximity` + `_CODE_SIGNAL_RE`.
- `services/intelligence/app/generation/context.py` – code-seeking spread, exclusion set, explicit select, `_retrieved_chunk` helper.
- `services/intelligence/app/generation/worker.py` – `ContextBuilder` Protocol, `MAX_CODING_WINDOWS`, `_build_context`, bounded resample loop.
- `services/intelligence/app/generation/prompts.py` – `coding-v2`, derivation rule.
- `services/intelligence/app/generation/models.py` – ruff UP037 (pre-existing lint, unrelated).
- `services/intelligence/app/worker_main.py` – thread `code_seeking`/exclude through the injected closure.
- `services/intelligence/scripts/eval_golds_coding.json` – ACCA re-pinned to `expectedDerivable=true`.
- Tests: `test_code_signal.py`, `test_generation_context.py`, `test_generation_coding.py`.
- Evidence: `research/doc/generation-quality-harness/summary.json` + `report.md` (re-run).
- `.work/active/coding-generation-context/plan/VERIFICATION.md` – AC ledger.

## Pitfalls & rules
- The injected `ContextBuilder` contract now carries keyword-only `code_seeking`/`exclude_chunk_ids`; any new production wiring must accept them (the live miss that unit doubles hid).
- Coding self-check needs the demand-started Piston sandbox on `:2000`; a stopped sandbox defers the self-check and leaves the assessment `generating`.
- Rule 42 (one family per call), rule 80 (dry-run first), rule 17 (logger + trace ids), rule 54 (demand-start/stop sidecar + sandbox).
- Never record raw material text, reference solutions, or hidden tests in evidence.

## Decisions in force
- D-01..D-08 from the plan all in force; no schema change, refusal path kept, objective/written untouched.
- ACCA gold re-pinned to `expectedDerivable=true` with the user 2026-09-21: a worked computational procedure is an implementable technique under `coding-v2`.
- Window count is logged with `trace_id`, not stored in telemetry, to honor AC3 (no migration); telemetry contract is `additionalProperties: false`.

## Open
- Wrap the task (archive + STATUS Done); commit is `b6e286b`.
- The durable coding gold set no longer has a negative case; AC2's refusal path is guarded by unit tests + the live codeless run.
- Low: code-seeking fetches all candidate text in one request; PostgREST row cap could truncate very large materials.
