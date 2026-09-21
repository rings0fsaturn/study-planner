# State – issue-48-generation-quality-harness
_Spec: https://github.com/rings0fsaturn/study-planner/issues/48 (parent #32, map #4) · Plan: active/issue-48-generation-quality-harness/plan/ · STATUS row: issue-48 · Status: done · Updated: 2026-09-21_

## Current state & next
- Done 2026-09-21. #48 resolved, closed, map #4 Decisions-so-far line appended, task archived.
- Deliverable: `services/intelligence/scripts/eval_harness.py` + gold registry + report, offline and hot-path-free.
- Next: none for this task. Follow-ups live on the map (rerank ablation when rerank wiring changes; difficulty calibration once K=5 questions span two authored bands).

## Done so far
- Step 0 branch hygiene: committed the #45 deliverable (`dfa126e`), pushed `phase2/issue-45-coding-practice-runs`, fast-forwarded + pushed `project/phase-2`, cut `phase2/issue-48-generation-quality-harness`, claimed #48.
- P1 skeleton: `scripts/eval_harness.py` + `eval_golds.json` (corpus, 3 fold SHA-256s, K=5, judge, baselines, thresholds) + `--verify-golds` (resolves all written snippets against 754 real chunks) + `--limit` dry-run flags + `configure_logging` (rule 17). Commit `c66215e`.
- P2 metrics: objective (from recorded #56 evidence), groundedness LLM judge, retrieval sidecar arm, difficulty calibration, diversity/dedup, mastery candidates (reuses `py_progress.mastery.bkt_forward`), coding suitability. New `eval_golds_written.json` (6) + `eval_golds_coding.json` (3).
- P3 gates: thresholds explicit with a `baselines` provenance block; activation default off; `--activate` fails closed (exit 1) with the failing gate named; report to `research/doc/generation-quality-harness/`; live arms cached to `live.json` so a plain `--summarize` reproduces the last full report.
- P4 telemetry: redacted reader only (task/outcome/counts/repair flag); no `hidden_block`, answer key, or raw text.
- P5 verification: 11 new unit tests green; ruff clean; full intelligence suite 693 passed / 7 pre-existing failures (see plan/VERIFICATION.md).
- Review: open-code-review delegate over the session diff found 2 defects in the harness (pending `generating` coding attempts counted as derivable; unused token columns in the redacted telemetry read). Both fixed in `3d955a6`.
- Wayfinder exit: resolution comment, #48 closed, map #4 line, STATUS Done row, archive.

## Flow trace
- #48 was unblocked (blocked-by #38 and #43 both CLOSED). #56 was the pre-implementation probe; #48 owns the durable harness.
- Reused rather than reimplemented: `generation_probe.metric_row/normalize_mcq/cosine/sanitize/make_client`, `retrieval_probe.fetch_chunks/rank_with_rpc/embed_query_sidecar/load_env_file`, `py_progress.mastery.bkt_forward`.
- ECE and AUC mirror the #43 bake-off definitions (10 bins; rank AUC with half ties) because that script is archived and the harness is their durable home.
- Data sources: recorded #56 probe (`research/doc/deepseek-generation-probe/`), `generation_telemetry`, and owner-scoped `assessments`/`questions`/`question_attempts` via PostgREST service-role reads.

## Files affected
- `services/intelligence/scripts/eval_harness.py` – the harness (pure metrics, gold verification, live arms, gates, report).
- `services/intelligence/scripts/eval_golds.json` – gold registry: corpus, fold hashes, K, judge, baselines, thresholds.
- `services/intelligence/scripts/eval_golds_written.json` – 6 authored written golds grounded in the ACCA corpus.
- `services/intelligence/scripts/eval_golds_coding.json` – 3 labeled coding golds (2 code-bearing true, 1 prose false).
- `services/intelligence/tests/test_eval_harness.py` – 11 unit tests for the pure metrics.
- `services/intelligence/tests/test_grading_grader.py` – pre-existing import-sort lint fix.
- `research/doc/generation-quality-harness/` – report.md, summary.json, live.json (durable evidence).

## Pitfalls & rules
- Offline only: evaluation stays outside the online generation hot path (AC3). No hot-path file changed.
- Rule 42: one family per generation call; the coding arm reuses that contract.
- Rule 80: dry-run before full runs. The retrieval arm dry-ran at `--limit 2` before the full 30; the judge dry-ran at 2 before 30.
- Rule 17: `configure_logging()` + module logger; no bare `print`/`basicConfig`; broad excepts log via `sanitize` and fail closed.
- Rule 54: the GPU sidecar is demand-started for the retrieval arm and stopped after.
- Never select or emit hidden grading content, answer keys, reference solutions, or raw material text.
- A `--verify-golds` run early-returns, so it does not run live arms in the same invocation.

## Decisions in force
- Harness lives in a new `scripts/eval_harness.py`, reusing probe helpers rather than extending `generation_probe.py` (2026-09-21).
- Gold set v1 = #56 30-question multi-gold + 754-chunk corpus, extended with 6 written and 3 coding golds (2026-09-21).
- Activation gate defaults off; the harness cannot block ordinary generation (2026-09-21).
- Retrieval thresholds are pinned to the current 754-chunk corpus measurement (r@3 0.70 / MRR 0.67) with a regression tolerance; rule 54's 0.83/0.79 is recorded as the older 788-chunk baseline (2026-09-21).
- Difficulty calibration reports `unmeasured` below two distinct authored bands instead of a false band error (2026-09-21).

## Open
- Rerank ablation deliberately not built: hybrid and dense rank identically on this query set, so it would not move a gate. Add when rerank wiring changes.
- Coding suitability 0.0 and difficulty calibration unmeasured are data/model findings, not harness defects; both are recorded in the resolution comment.
- Pre-existing unrelated test failures: `test_retrieval_probe.py` (2, stale `services.*` import) and `test_v1_integration.py` calibration goldens (5, TZ/time-of-day flake).
