# State – coding-generation-context
_Spec: https://github.com/rings0fsaturn/study-planner/issues/67 (parent #32, map #4) · Plan: archive/coding-generation-context/plan/PLAN.md (complete) + `.work/plans/2026-09-28-coding-generation-context-residuals.md` (complete) · STATUS row: coding-generation-context · Status: done · Updated: 2026-09-28_

## Current state & next
- Original build done 2026-09-21: P0-P5 complete and live-verified; AC1-AC6 all pass (see `plan/VERIFICATION.md`); committed as `b6e286b` (code + tests + `eval_golds_coding.json` + `.work` record).
- Continued 2026-09-28: issue #67 is still OPEN because the wayfinder exit never ran. Residual hardening + exit plan written at `.work/plans/2026-09-28-coding-generation-context-residuals.md` (D-01..D-06).
- Two residuals to fix first: (1) the coding gold registry has no negative case (all three `expectedDerivable: true` after the ACCA re-pin) and (2) the no-steer listing truncates at the hosted PostgREST 1000-row cap (measured 2026-09-28; DDIA has 1094 chunks, so 94 are invisible).
- Next: none - closed 2026-09-28; open frontier is #49 alone.

## Done so far
- P0: issue #67 opened (child of #32, map #4), task folder + STATUS Active row, plan moved to `plan/PLAN.md`.
- P1: pure `code_proximity(text) -> float` scorer beside `scan_code_blocks` in `app/ingestion/code_signal.py`; signals that survive PDF extraction (keywords, call/assignment shapes, operators), density-scaled 0..1.
- P2: `build_context(..., *, code_seeking=False, exclude_chunk_ids=frozenset())`; code-seeking picks the top-proximity chunk per ordinal band; `ContextBuilder` is now a Protocol; worker threads the coding flag via `_build_context` and `_widen_thin_context`.
- P3: `CODING_PROMPT_TEMPLATE_VERSION = "coding-v2"`; system prompt gains the derivation rule and the narrower codeless refusal.
- P4: `MAX_CODING_WINDOWS = 3`; the context->generate->validate step is a bounded resample loop; tried chunk ids excluded between windows; terminal refusal preserved with the last reason; each window logged with `trace_id`.
- P5: cheap checks green; live coding/objective/written generations verified; codeless refusal verified; harness re-run gold agreement 2/2, derivable rate 0.333; redaction sweep clean; OCR delegate review done (one medium fix); sidecar + Piston stopped.
- Live-found production defects fixed: `worker_main.py` closure rejected the new kwargs (assessment stuck `generating`); Piston sandbox was stopped (self-check needs it).
- 2026-09-28: residual + exit plan written (`.work/plans/2026-09-28-coding-generation-context-residuals.md`); ground truth re-measured (PostgREST collection cap 1000: `content-range: 0-999/4175`; DDIA 1094 chunks; the codeless fixture `ac8e4730-...` still live with its `code_not_derivable` assessment); focused baseline 29 passed.
- 2026-09-28: residual plan Phases 1-4 done + wayfinder exit run. Phase 1: `verify_golds` negative-case guard + codeless gold item (`coding.gold` 3/3/1.0). Phase 2: `_fetch_listing` paged listing, `_code_seeking_context` deleted (live DDIA probe 1094 rows). Phase 3: OCR delegate APPROVE + verification-loop READY. Phase 4: fresh live AC1 (coding `ready`, `coding-v2`), AC2 (`failed` `code_not_derivable`), AC4 (objective + written `ready`), redaction CLEAN; #67 ACs ticked + resolution comment + CLOSED; map #4 decision line (remote + local snapshot); STATUS Done; task archived. Changes left uncommitted per the no-commit default (plan step 4.6.8).

## Flow trace
1. Coding no-steer context: `context.py:_spread_context` -> `_fetch_listing` (paged at the hosted cap) -> `_evenly_spaced` (default) or `_top_code_picks` (coding arm).
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
- `.work/archive/coding-generation-context/plan/VERIFICATION.md` – AC ledger (original AC1-AC6 + 2026-09-28 continuation).
- `.work/plans/2026-09-28-coding-generation-context-residuals.md` – residual hardening + wayfinder exit plan (2026-09-28).

## Pitfalls & rules
- The injected `ContextBuilder` contract now carries keyword-only `code_seeking`/`exclude_chunk_ids`; any new production wiring must accept them (the live miss that unit doubles hid).
- Coding self-check needs the demand-started Piston sandbox on `:2000`; a stopped sandbox defers the self-check and leaves the assessment `generating`.
- Hosted PostgREST caps collections at 1000 rows even with `limit=10000` (measured 2026-09-28: `content-range: 0-999/4175`); the no-steer listing pages via `_fetch_listing` (residual plan Phase 2).
- The mandatory negative gold is checked only while the codeless fixture `ac8e4730-00eb-447d-bffd-81e81dd43bb4` and its `code_not_derivable` assessment row live: do not clean it up.
- The worktree carries the uncommitted `repair-validation-resilience` code + task folder and the pre-existing `college/` deletions: stage only the paths the residual plan names, never `git add -A`.
- Rule 42 (one family per call), rule 80 (dry-run first), rule 17 (logger + trace ids), rule 54 (demand-start/stop sidecar + sandbox), rule 52 (gh bounded retry).
- Never record raw material text, reference solutions, or hidden tests in evidence.

## Decisions in force
- D-01..D-08 from the original plan all in force; no schema change, refusal path kept, objective/written untouched.
- ACCA gold re-pinned to `expectedDerivable=true` with the user 2026-09-21: a worked computational procedure is an implementable technique under `coding-v2`.
- Window count is logged with `trace_id`, not stored in telemetry, to honor AC3 (no migration); telemetry contract is `additionalProperties: false`.
- 2026-09-28 residual plan D-01..D-06 in force: fix both residuals then exit; the negative gold pins the live codeless material; `verify_golds` makes the negative case mandatory; page with the repo's offset idiom at the measured cap; the exit re-verifies AC1/AC2/AC4 live; review fanout = `open-code-review-delegate` + `verification-loop`.

## Open
- None - task closed 2026-09-28 (see Done so far). The negative gold depends on the live codeless fixture row; if the shared account is ever cleaned, the gold silently stops being checked (candidate follow-up: report unchecked golds).
- Low (out of scope): `code_proximity`'s assignment regex can match prose; density scaling keeps its weight small.
