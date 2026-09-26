# Verification - jev-integration #76 Phase B (slice-2 worker passage filter)

_Issue [#76](https://github.com/rings0fsaturn/study-planner/issues/76) (map [#69](https://github.com/rings0fsaturn/study-planner/issues/69)) · Verified 2026-09-26 · Plan: `plan/PLAN.md`_

Commits: `99f409b` (conflict split + sweep runner + evidence), `76b139e` (RED), `575190b` (GREEN), `a31f25e` (code-review follow-up).

## AC ledger

| AC | Verdict | Evidence |
|---|---|---|
| Conflict-routing gate resolved on a premise-denying-heavy split | PASS | 12 authored pairs (6 sweep / 6 final), 12 calls, $0.000223, 0 errors, p50 659 / p95 882 ms. 11/12 route `conflicting_evidence`; `injection_gated` 0/12; `injection_max` 0.90 identical to defaults, so no threshold loosening. Decision D-01: keep-set is `include` only. Posted to #76 (comment 5842297344). |
| Thresholds locked on both axes | PASS | Phase A's 12-cell grid (44 real rows) + this split's grid; both hold the defaults. Pinned by `test_locked_passage_thresholds_and_enforce_verdicts`. |
| Prompt variants locked | PASS | No v2 wording exists for slice 2 and `batch_passage_questions` is derived from `passage_questions` (`app/jev/questions.py`), so batched and single shapes cannot drift. No code change needed. |
| Worker filter enforces behind a floor | PASS | `_jev_filter_passages` returns the applied window; `PASSAGE_ENFORCE_VERDICTS` is the single declaration the filter and the log both read; the floor skips injection-flagged chunks and falls back to the whole window only when none qualify. 16 slice-2 tests. |
| Citation enum agrees with the prompt | PASS | `context_ids` / `chunk_texts` are rebuilt after filtering; asserted through `_citation_enum(adapter)` in four tests rather than only through prompt text. |
| Rollback is independent of slice 1 | PASS | `JEV_SLICE2_ENFORCE` (default false) is its own switch; `test_enforce_runs_with_slice1_flag_off` proves the filter works with the slice-1 gate off, `test_flag_off_makes_zero_shadow_calls` proves zero calls when both are off. |
| Fail-open preserved | PASS | `test_enforce_fail_open_on_jev_error`; the warning carries `trace_id` (rule 17). |
| No retrieval-path change | PASS | The retrieval router, `context.py`, and the `rerank` opt-in are untouched; nothing in the diff can move the frozen 754-corpus dense baseline (r@1 0.60 / r@3 0.7333 / MRR 0.7033). |
| Latency ceiling | PASS | Phase A p50 ~650 / p95 ~1127 ms; this split p50 659 / p95 882 ms, against the 15 s client ceiling and the 90 s visibility window. |
| Live flag-on generation with a request-id log join | PASS | Two live objective generations on `grokking-algorithms` with both flags on. Steered: `kept=5/5`, `applied=5`, `ready`. Unsteered: `kept=0/5` floor to `applied=1`, `ready`, citing the floor chunk. Log join via the assessment's `correlationId` (the worker traces by that, not the HTTP `X-Request-ID`). Details in "Live run". |

## Offline verification (run 2026-09-26)

| Check | Command | Result |
|---|---|---|
| Imports / config default | `uv run python -c "from app.generation.worker import ..."` | OK; `GenerationWorkerConfig().jev_slice2_enforce is False` |
| Target suites | `uv run pytest tests/test_generation_jev_slice{1,2}.py tests/test_jev.py tests/test_jev_slice2_measure.py tests/test_generation_worker.py tests/test_worker_main.py -q` | **84 passed** (16 in the slice-2 file) |
| Full backend | `uv run pytest -q` | **18 failed / 799 passed**; failure set byte-identical to the pre-change baseline (`diff` empty), so 0 new failures and 787 -> 799 = +12 net new tests |
| Lint | `uv run ruff check .` | clean |
| Format | `uv run ruff format --check` on the 5 touched files | clean (43 pre-existing unformatted files left alone) |
| Type check | `uv run pyright ...` | not run: pyright is not installed and the repo carries no pyright config |
| Security | diff scan for keys/secrets; exact-substring scan of both new evidence files | no secrets; 0 hits for `referenceSolution` / `hiddenTests` / `acceptedValue` |

Pre-existing-failure note: the 18 are the same ones recorded on 2026-09-25 - order-dependent v1-golden fixtures plus `test_retrieval_probe`. They fail on a clean tree too, so the baseline is historical debt rather than a regression from this change.

## Conflict split (D-05 evidence)

| split | n | conflicting_evidence | include | exclude | injection_gated |
|---|---|---|---|---|---|
| sweep | 6 | 6 | 0 | 0 | 0 |
| final | 6 | 5 | 1 | 0 | 0 |

Grid on this split: `injection_max 0.90` is identical to defaults; `0.50` costs 1 sweep + 2 final conflicts; `contradicts_min 0.90` costs conflicts; `relevant_min` / `evidence_min` are inert (the contradiction check fires first). Recorded ceiling: one row with a question-shaped query (no stated premise) routes `include` - a query without a premise cannot express a contradiction, and the passage filter is a relevance/abuse filter, not a fact-checker.

## Code review

`/ecc:code-review` on the three commits: **APPROVE**. One MEDIUM (dead `_index_answers` helper) and one LOW (a test constructing `GenerationWorker` inline) found and fixed in `a31f25e`. Three findings were investigated and cleared: the loop-variable reassignment is safe because `retrieved_ids` deliberately captures the pre-filter window for resample exclusion; a starved window cannot produce an empty prompt because `_summarize_passage` always floors when the window is non-empty (a defensive branch was written, then removed as dead and replaced by a per-window-size assertion); and no new exception path was introduced.

## Live run

Run 2026-09-26 on the shared dev account against the real stack (intelligence :8000, app :5173, worker), started with `JEV_SLICE1_ENABLED=true JEV_SLICE2_ENFORCE=true` in the shell so both flags reached the worker's real environment. Confirmed by reading `/proc/<worker-pid>/environ` (values not printed, rule 53). The GPU sidecar was demand-started for the steered case and stopped immediately after (rule 54); no containers remain running.

Two objective generations on `grokking-algorithms` (`b5f51eab-...`); no Piston needed, since objective generation runs no self-check.

| run | recipe | suitability | passage enforce | outcome |
|---|---|---|---|---|
| unsteered (empty steer) | `{formats:[objective], difficulty:3, questionCount:1}` | `review` (not_derivable 0.78) | `kept=0/5`, `floor=982af624...`, **`applied=1`** | `ready`, 1 question, 0 warnings, cites `982af624...` |
| steered | same + `skillTags:["binary search"]` | `derivable` 0.98 | **`kept=5/5`, `floor=None`, `applied=5`** | `ready`, 1 question, 0 warnings, cites `68b37436...` |

Findings:

1. **The filter is a no-op on real steered windows.** `kept=5/5`, `floor=None`, `applied=5` - so the flagged risk (recall 0.846 dropping true includes) does not materialize on the production path. The real risk was narrower than reported: the empty steer.
2. **The empty-steer window starves, and the floor is exactly what keeps it alive.** `kept=0/5` → `applied=1` → the generation still completed `ready`. Enforce-off would have sent all 5 chunks (the Phase A `kept=0/5` shadow behaviour); enforce-on sends the top-by-relevance one. The floor's safety property is therefore exercised for real, not just in unit tests, and the documented ceiling stands: the floor is injection-aware, not relevance-aware.
3. **The applied window drives the schema and the citation.** The unsteered question cites the floor chunk `982af624...`, proving `context_ids`/`chunk_texts` were rebuilt from the filtered window: a stale enum would have offered all 5 ids.
4. **Redaction holds.** Both `/v1/assessments/{id}` reads contain no `referenceSolution` / `hiddenTests` / `acceptedValue`.
5. **Flag-off behaviour is unchanged** by construction (the flag defaults false and the filter returns the retrieved window untouched); covered by `test_flag_off_makes_zero_shadow_calls` and the no-client inert test rather than a third live run.

Log-join note for future sessions: the generation worker traces with the assessment's `correlationId`, so joining on the HTTP `X-Request-ID` returns nothing even though the service echoes the id in its own logs. Read the `correlation_id` column for the assessment, then grep the worker log with it.

Leftovers left on the shared account (both `ready`, safe): assessments `1647d38a-b52d-4c76-ae8e-ee108a10de0e` (unsteered) and `4dda8bfa-68db-49dc-9de1-f426873359fa` (steered). The 2026-09-25 coding leftovers and the known stuck `generating` row are still present and still need cleaning before any live spec run that uses strict-mode locators.
